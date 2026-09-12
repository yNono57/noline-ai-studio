# Supabase — audit sécurité Sprint 1.5

Audit distant du 12 septembre 2026, projet `wkjdsdkoidkmheusbwop` (`noline-ai-studio`, `eu-west-1`). Les accès SQL ont utilisé uniquement des lectures sous `BEGIN READ ONLY`. Aucune migration, modification de fonction, de grant, de configuration Auth, de donnée ou restauration n'a été exécutée en production.

## État réellement observé

| Vérification | Résultat |
| --- | --- |
| Projet | `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.155` |
| Organisation du projet | `rqunhujktsfmvjhkltrq`, abonnement **Free**, confirmé par `get_organization` |
| Données Core | **3 projects / 9 conversations / 55 messages** |
| Historique applicatif | `list_migrations = []`, `supabase_migrations.schema_migrations` absent |
| Fonction Core dédiée | `public.core_set_updated_at()` absente ; Core V1 non appliquée |
| Advisors sécurité | **4 WARN**, aucune ERROR retournée |
| Advisors performance | **21 WARN + 19 INFO**, soit 40 résultats |
| Sauvegarde/restauration exploitable | **NON VÉRIFIÉE** ; aucun inventaire de sauvegardes disponible via les outils connectés |

Les résultats Advisors portaient l'horodatage `2026-09-12T08:39:46Z`. Les comptes et catalogues ont été relus pendant ce sprint. `ACTIVE_HEALTHY` ne prouve ni la présence d'une sauvegarde récente ni sa restaurabilité.

## Analyse des quatre avertissements sécurité

### 1. `public.set_updated_at()` : search_path mutable

La définition réelle est une fonction PL/pgSQL `RETURNS trigger`, **SECURITY INVOKER**, propriétaire `postgres`, sans configuration locale de `search_path`. Son corps se limite à `new.updated_at = now(); return new;`. Aucun accès à une table, SQL dynamique ou traitement d'entrée utilisateur n'est présent. `anon` et `authenticated` n'ont pas `CREATE` sur le schéma `public`.

Le risque de détournement dépend d'une capacité supplémentaire à manipuler le chemin de recherche et à fournir une fonction concurrente. Une élévation via un appel HTTP ordinaire n'a pas été démontrée. Le caractère invoker et le corps très limité réduisent le risque, mais fixer le chemin de recherche supprime cette dépendance inutile.

**Correctif proposé :** `ALTER FUNCTION public.set_updated_at() SET search_path = '';`. PostgreSQL conserve l'accès implicite à `pg_catalog`, donc `now()` reste disponible. La proposition ne remplace ni le corps, ni le propriétaire, ni les triggers.

**Dépendances réellement inspectées :** `projects`, `conversations`, `forge_projects`, `forge_conversations`, `github_connections`, `forge_workspaces`, `forge_workspace_runtimes`, soit sept triggers d'UPDATE. Même une modification de configuration d'une fonction partagée impose une validation de Forge en staging avant autorisation. Core V1 détourne seulement les deux triggers Core vers sa fonction séparée ; cet avertissement persisterait pour la fonction historique après Core seul.

[Remédiation Supabase — search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)

### 2–3. `public.handle_new_user()` : EXECUTE pour anon et authenticated

La fonction réelle est **SECURITY DEFINER**, propriétaire `postgres`, retourne `trigger` et fixe déjà `search_path = ''`. Elle insère dans `public.profiles(id, email)` et `public.subscriptions(user_id, plan, status)`, avec `ON CONFLICT DO NOTHING`. Les valeurs proviennent de `NEW.id` et `NEW.email`, avec plan `free` et statut `active` constants. Elle ne lit pas `raw_user_meta_data` pour autoriser des opérations.

Le seul trigger observé pour cette fonction est `on_auth_user_created`, `AFTER INSERT ON auth.users FOR EACH ROW`, actif. Les ACL accordent EXECUTE à `PUBLIC`, `postgres`, `anon`, `authenticated`, `service_role`. `supabase_auth_admin` dispose actuellement d'EXECUTE par héritage de `PUBLIC`.

L'Advisor décrit une RPC privilégiée, mais sa conclusion doit être nuancée : une fonction qui retourne `trigger` ne s'exécute pas comme une fonction SQL ordinaire. Le test local reproduisant ce corps confirme le refus d'un appel direct, même avant durcissement. Aucun appel d'exploitation n'a été tenté sur la production. Le privilège reste superflu pour les rôles API et augmente les capacités d'un acteur qui obtiendrait un accès SQL permettant d'attacher un trigger.

**Correctif proposé :** accorder explicitement EXECUTE à `supabase_auth_admin`, puis le révoquer de `PUBLIC`, `anon` et `authenticated`. Conserver SECURITY DEFINER pour l'insertion des lignes de profil et d'abonnement ; ne pas modifier les corps ni les triggers. Le grant existant de `service_role` reste inchangé. La proposition vérifie les privilèges effectifs et annule tout si un héritage non prévu laisse l'accès aux rôles API.

**Risque de régression :** inscription Auth et création de profil/abonnement. La simulation valide cet enchaînement avec `SET ROLE supabase_auth_admin`; un véritable signup Supabase sur staging reste nécessaire pour valider l'ensemble Auth, les permissions et la configuration hébergée.

[Remédiation anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) · [Remédiation authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) · [Fonctions trigger PostgreSQL](https://www.postgresql.org/docs/17/plpgsql-trigger.html)

### 4. Protection contre les mots de passe compromis désactivée

L'Advisor confirme la désactivation. Le compte actuel est **Free** ; la documentation réserve cette protection à **Pro et plus**. Il ne s'agit pas d'une migration SQL. Activer l'option requiert un changement de plan et de configuration explicitement approuvé.

**Impact :** les mots de passe connus comme compromis ne sont pas filtrés par cette protection. Cela favorise la réutilisation de mots de passe déjà divulgués ; aucune compromission des comptes NØLINE n'a été constatée. Le correctif recommandé est l'activation après validation du plan, puis test signup/changement de mot de passe et affichage des erreurs de mot de passe faible. Aucun achat ni changement Auth réalisé.

[Documentation Supabase — sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Proposition SQL séparée, non active

Fichier : [`supabase/proposals/20260912084200_security_function_hardening.sql`](../../supabase/proposals/20260912084200_security_function_hardening.sql).

Le nom a été généré avec Supabase CLI **2.117.0**, `supabase migration new security_function_hardening`, dans un répertoire local isolé puis déplacé sous `proposals`. **Ce fichier n'est pas une migration active et ne doit pas être copié/exécuté sans validation.** Avant promotion dans la chaîne approuvée, vérifier sa version par rapport aux migrations déjà enregistrées et générer une nouvelle version si nécessaire ; aucun fichier historique ni Core n'est renommé.

La proposition est transactionnelle, sans DML, sans table ou trigger recréé. Elle refuse les corps de fonctions non identiques aux corps examinés (empreintes normalisées), les types/configurations incompatibles et un trigger Auth inattendu. L'empreinte est une garde contre la dérive, pas une signature de sécurité. Les changements se limitent au `search_path` d'une fonction et aux ACL de l'autre.

La PR Core #1 n'est pas modifiée. La proposition de sécurité peut être revue indépendamment de Core ; elle ne doit pas être couplée à l'application de Core pour masquer un risque d'inscription Auth. Un déploiement approuvé doit relancer les Advisors, contrôler les grants effectifs et refaire les tests Auth/Forge.

### Validation locale de la proposition : 8 contrôles PASS

[`verify-security-functions.mjs`](../../supabase/proposals/verify-security-functions.mjs) utilise PGlite, sans réseau ni données réelles :

1. Appel ordinaire de la fonction trigger refusé avant durcissement.
2. Corps, identités, propriétaires, modes de sécurité et huit triggers conservés.
3. EXECUTE refusé à anon/authenticated, conservé pour Auth et service_role.
4. Insertion d'un utilisateur synthétique par le rôle Auth créant profil et abonnement gratuit actif.
5. Sept triggers d'UPDATE historiques encore opérationnels avec le rôle authenticated.
6. Deuxième application idempotente.
7. Incompatibilité d'ACL héritée détectée après les changements : rollback complet vérifié.
8. Dérive du corps historique : refus avant toute modification.

Exécution avec une installation locale de PGlite existante : `node supabase/proposals/verify-security-functions.mjs`. Si PGlite n'est pas installé dans cette branche, définir `PGLITE_MODULE` vers son module installé dans le checkout Core. Aucun package applicatif n'a été ajouté pour cette répétition locale. Ces contrôles sont distincts des tests applicatifs et ne prouvent pas à eux seuls l'intégration Supabase hébergée.

### Annulation de la proposition sécurité

Une erreur avant COMMIT annule toute la transaction. Après application validée, privilégier une correction en avant. Avant tout retour de configuration, capturer les ACL et `proconfig` exacts du moment précédent ; leur rétablissement doit être une migration séparée et approuvée. Le `search_path` historique était non fixé et PUBLIC disposait d'EXECUTE : rétablir cet état réintroduirait les avertissements, ce n'est donc pas un rollback automatique recommandé. Aucun DROP de fonction ou de table n'est nécessaire.

## Advisors performance : aucune correction automatique hors Core

### 21 WARN `auth_rls_initplan`

Les douze policies Core sont concernées : SELECT, INSERT, UPDATE et DELETE sur chacune de `projects`, `conversations`, `messages`. Core V1 les remplace par les expressions `(select auth.uid())`, avec propriété utilisateur et rôle `authenticated`.

Les neuf autres avertissements concernent les policies de `forge_agent_runs`, `forge_agent_steps`, `forge_projects`, `forge_conversations`, `forge_messages`, `github_connections`, `forge_workspaces`, `forge_workspace_runtimes`, `forge_run_artifacts`. Ils sont hors périmètre : une optimisation future devra conserver les mêmes prédicats de propriété, mesurer les plans et valider Forge. Ce ne sont pas neuf fuites de données démontrées.

[Remédiation Supabase — évaluation RLS](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)

### 10 INFO `unindexed_foreign_keys`

`crm_tasks.prospect_id`, `crm_timeline.user_id`, `forge_agent_runs.conversation_id`, `forge_agent_runs.forge_project_id`, `forge_agent_runs.workspace_id`, `forge_agent_steps.user_id`, `forge_run_artifacts.restored_runtime_id`, `forge_workspaces.conversation_id`, `forge_workspaces.forge_project_id`, `generations.client_id`.

Aucune FK Core dans cette liste. Les index sont à évaluer selon volume, opérations de suppression et requêtes réelles ; leur coût d'écriture et de stockage empêche de les ajouter mécaniquement pendant ce sprint.

[Remédiation Supabase — index FK](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)

### 9 INFO `unused_index`

`subscriptions_stripe_customer_id_idx`, `subscriptions_stripe_subscription_id_idx`, `clients_user_id_created_at_idx`, `generations_agent_id_idx`, `favorites_user_id_idx`, `workflows_user_updated_at_idx`, `forge_workspace_runtimes_owner_activity_idx`, `forge_agent_runs_owner_conversation_idx`, `forge_run_artifacts_owner_run_idx`.

Un index sans utilisation enregistrée peut servir une fonction rare ou refléter une période d'observation courte. Aucun index supprimé et aucune suppression recommandée sans analyse de trafic et de contraintes.

[Remédiation Supabase — index inutilisés](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

## Sauvegardes et restauration : limites confirmées

Le plan Free a été vérifié par le connecteur. Les sauvegardes quotidiennes administrables sont documentées pour Pro/Team/Enterprise ; PITR nécessite Pro ou plus, l'option correspondante et un compute compatible. **Ne pas considérer une sauvegarde quotidienne gérée ou PITR comme disponible pour ce projet Free.** Un export logique privé peut exister en dehors de Supabase, mais aucun export, rétention ou exercice de restauration n'a été fourni ou vérifié pendant cet audit.

Le connecteur actuel ne propose aucun outil de liste des sauvegardes. L'API officielle documente `GET /v1/projects/{ref}/database/backups`, mais aucun jeton Management API n'a été extrait ou demandé. L'accès navigateur n'était pas disponible pour consulter le Dashboard. Les dates du dernier backup réussi, le volume couvert et la durée de restauration restent inconnus.

Avant production, obtenir un export logique conservé hors dépôt et protégé, vérifier sa couverture des schémas/données/rôles nécessaires, puis valider sa restauration dans un environnement isolé. Les fichiers Storage ne sont pas inclus dans un backup PostgreSQL : les inventorier/sauvegarder séparément si le scénario de reprise les exige. Une restauration complète de production aurait une portée globale, notamment Forge, et nécessite une autorisation distincte ; elle ne sert pas de rollback automatique de Core.

La procédure ciblée Core, les captures avant/après, la conservation des comptes 3/9/55 et le rollback figurent dans [`core-production-runbook.md`](core-production-runbook.md). Pas de rejeu historique, pas de réparation du ledger pendant ce sprint.

[Documentation des sauvegardes](https://supabase.com/docs/guides/platform/backups) · [API de liste des sauvegardes](https://supabase.com/docs/reference/api/v1-list-all-backups)

## Conclusion d'audit Supabase

La proposition de durcissement est préparée et vérifiée localement ; **elle n'a pas été appliquée**. Les quatre avertissements sécurité restent donc présents en production. Les deux avertissements sur `handle_new_user` doivent être interprétés avec son type trigger, et le `search_path` partagé exige une validation de Forge. Le plan Free empêche d'annoncer une protection des mots de passe compromis ou des sauvegardes gérées comme actives.

La préparation SQL est exploitable pour revue, mais la disponibilité d'une sauvegarde restaurable et le test hébergé Auth/Forge restent des conditions non remplies pour un GO production. Aucune permission de déploiement ne découle de ce rapport.
