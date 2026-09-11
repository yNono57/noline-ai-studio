# Sprint 1 — NØLINE Core Data V1

Branche : `feat/noline-core-data-v1`. Base auditée : `1cffe0cfb6052470cbf34b8366d31d5bb9085c22`.

Le Core conserve le modèle `projects → conversations → messages` et les contrats HTTP Nova. Les accès Core passent désormais par le jeton utilisateur vérifié, pour appliquer la RLS pendant chaque lecture et écriture. Aucun moteur Nova/OpenAI/safety/web search, composant UI ou fichier Forge n'a été réécrit.

## Diagnostic vérifié

- `PROPOSED_001_PROJECT_CONVERSATIONS.sql` contient le schéma attendu par le store, mais n'appartenait pas aux migrations et ne supportait pas une seconde exécution.
- Le store utilisait la Service Role : sa vérification de propriété précédait l'écriture, sans RLS lors de cette écriture. Une modification concurrente de propriété pouvait donc rendre ce contrôle périmé.
- Les routes vérifiaient déjà l'utilisateur et certains champs ; les identifiants non UUID atteignaient la base et l'authentification dépendait inutilement de la configuration Service Role.
- Forge utilise ses propres tables `forge_*`. Ses triggers dépendent de `public.set_updated_at()`, dont l'unique définition versionnée avant ce sprint se trouve dans le SQL proposé.
- Plusieurs migrations historiques ont le même préfixe de date (`20260824`, `20260825`, `20260826`). Leur ordre et leur historique distant doivent être réconciliés avant une reconstruction globale. Cette PR ne renomme ni ne rejoue les migrations Forge.
- La connexion Supabase disponible ne liste que deux projets cashless. Le schéma et l'historique effectivement déployés pour AI Studio n'ont pas pu être consultés. Aucune migration distante n'a été appliquée.

## Changements exacts

| Fichiers | Changement |
| --- | --- |
| `supabase/migrations/20260911204606_noline_core_data_v1.sql` | Migration transactionnelle, créée avec le CLI Supabase ; trois tables, defaults, validation de structure et données, contraintes, index, triggers, RLS par opération et droits explicites. |
| `supabase/PROPOSED_001_PROJECT_CONVERSATIONS.sql` | Mention de remplacement ; schéma historique conservé pour tester la compatibilité. |
| `supabase/core-data-preflight.sql` | Inventaire en lecture seule des colonnes, contraintes, politiques, index, triggers et privilèges du projet cible. |
| `lib/chat/core-supabase.ts` | Transport réservé au serveur : clé publique + Bearer utilisateur, aucun accès à la Service Role, pas de cache ni de détail d'erreur sensible propagé. |
| `lib/chat/conversation-store.ts` | Identité et jeton par requête ; vérifications de propriété conservées ; validation UUID, enums et types ; écriture devenue inaccessible signalée comme introuvable. |
| `app/api/nova/_shared.ts` | Bearer strict, vérification via Supabase Auth, identité vérifiée transmise au store, validation UUID de reprise, journaux sans détail de base. |
| Les cinq fichiers `route.ts` sous `app/api/nova` | Passage de l'identité complète au store ; réponses HTTP et génération existante préservées. |
| `tests/core-data-migration.test.cjs` | Sept scénarios PostgreSQL : création, rejeu, CRUD, RLS A/B, migration de données existantes, compatibilité Forge et refus atomique des incompatibilités. |
| `tests/core-nova.test.cjs` | Huit scénarios sur les véritables handlers/store, avec transport Auth/PostgREST simulé et requêtes exécutées dans PostgreSQL sous le rôle utilisateur. |
| `package.json`, `package-lock.json`, `eslint.config.mjs` | Scripts de tests/typecheck, dépendances exactes `server-only`, `tsx`, PGlite, lint des tests CommonJS. |

## Contrat et limites de la migration

La migration supporte une base sans tables Core et les tables du SQL proposé, même peuplées. Elle vérifie les colonnes attendues, leurs types/nullabilité et les clés primaires ; impose et valide les contraintes de domaine et de relations ; refuse les clés étrangères incompatibles ou les politiques inconnues. Les IDs, contenus, métadonnées et dates déjà enregistrés restent inchangés. Les defaults sont réaffirmés pour les nouvelles écritures.

Elle n'invente pas de propriétaire, ne remplit pas de colonne manquante et ne supprime aucune ligne. Une structure ou des données incompatibles doivent être corrigées après revue explicite. Un échec annule toute la transaction. Une seconde exécution réussit sans dupliquer les politiques ou triggers ; les contraintes propres à Core sont réaffirmées. Les contraintes historiques compatibles sont conservées et peuvent coexister avec celles de Core.

`core_set_updated_at()` est une fonction distincte, `SECURITY INVOKER`, avec un search path vide. La fonction partagée de Forge n'est pas remplacée. La migration prend des verrous exclusifs sur les trois tables ; elle abandonne après cinq secondes d'attente de verrou et limite chaque instruction à soixante secondes. Prévoir une fenêtre de maintenance pour une base volumineuse.

Les rôles `PUBLIC` et `anon` n'ont aucun droit sur Core. `authenticated` dispose des CRUD filtrés par propriété, y compris `WITH CHECK` pour empêcher transfert de propriété ou rattachement à une ressource tierce. Comme auparavant, un utilisateur peut modifier ses propres messages et métadonnées via la Data API : ce contenu ne constitue pas une preuve d'exécution serveur. La Service Role garde ses accès administratifs ; sa clé reste nécessaire aux autres sous-systèmes existants, notamment Forge, et ne doit pas être supprimée de leur environnement.

## Résultats locaux

Environnement : Windows, Node 24.15.0, Next 16.2.6, dépendances du lockfile.

| Vérification | Résultat |
| --- | --- |
| Tests existants avec le lanceur `tsx` | 217 réussis, 0 échec |
| `npm run test:core` | 15 réussis, 0 échec |
| `npm run lint` | Réussi, sans erreur ni avertissement |
| `npm run typecheck` | Réussi |
| `npm run build` | Réussi, 50 pages générées, routes Nova et Forge compilées |
| `npm audit` | 9 vulnérabilités : 1 faible, 1 modérée, 6 élevées, 1 critique |

Le PostgreSQL embarqué PGlite exécute réellement les contraintes, triggers, droits et politiques RLS. Les tests couvrent SELECT/INSERT/UPDATE/DELETE inter-utilisateurs, les refus `anon`, les cascades, les métadonnées, l'ordre stable des messages et un changement de propriétaire entre contrôle et mutation. Ils vérifient aussi que les données Forge et sa fonction partagée survivent à l'upgrade.

Les tests de routes simulent Supabase Auth et le transport PostgREST. Ils ne remplacent pas une validation sur une instance Supabase cible, avec de vrais JWT, le cache de schéma et la configuration Data API. Aucun appel payant OpenAI ni test avec données de production n'a été effectué. Le build s'exécute sans secrets de production.

Les neuf paquets signalés par l'audit (`next`, `postcss`, `sharp`, `nanoid`, `js-yaml`, `brace-expansion`, `browserslist`, `baseline-browser-mapping`, `postcss-selector-parser`) ont les mêmes versions que dans le lockfile de la base auditée. La criticité critique concerne Next. Leur mise à jour nécessite un chantier de sécurité dédié avant mise en production ; cette PR ne réalise pas d'upgrade global implicite.

## Avant déploiement

1. Identifier et rendre accessible le vrai projet Supabase AI Studio. Exécuter `supabase/core-data-preflight.sql` et consulter son historique de migrations en lecture seule.
2. Comparer les résultats au schéma attendu. Prendre une sauvegarde et valider l'upgrade sur une copie/préproduction. Exécuter les advisors Supabase sur ce projet ; ils n'ont pas pu être exécutés ici.
3. Réconcilier les préfixes historiques dupliqués et la dépendance Forge à `set_updated_at()` avant tout `db reset` ou déploiement global par le CLI. Ne pas lancer aveuglément toute la chaîne.
4. Appliquer cette migration Core contrôlée avant de déployer les nouvelles routes qui utilisent la RLS. Vérifier avec deux comptes réels que les CRUD et les refus cross-user fonctionnent via Auth/PostgREST.
5. Déployer le code après revue de la PR, puis vérifier la persistance, l'archivage, la suppression et la reprise Nova. Aucun merge ou déploiement n'est automatique.

En cas d'échec SQL, la transaction est annulée. Après succès, préférer une correction en avant ou un rollback du code ; ne pas supprimer les tables contenant des données. Les nouvelles autorisations et politiques restent compatibles avec les routes historiques à Service Role.

Autres limites préexistantes : pagination des grandes conversations non traitée ; deux requêtes de génération simultanées peuvent encore produire deux réponses au même message. La reprise séquentielle existante est testée, mais l'idempotence concurrente de génération n'est pas ajoutée dans ce sprint.

Référence utilisée : [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
