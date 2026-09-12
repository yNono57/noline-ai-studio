# Core Data V1 : procédure de production proposée

Statut : préparation uniquement, aucune exécution de migration ni restauration.
Projet : `wkjdsdkoidkmheusbwop` / `noline-ai-studio` / `eu-west-1`.
État de référence approuvé : **3 projects / 9 conversations / 55 messages**.
PR Core #1 et branche `feat/noline-core-data-v1` conservées intactes.
L'autorisation du Sprint 1.5 ne constitue pas une autorisation d'exécuter cette procédure en production.

## 1. État initial et choix de stratégie

L'audit distant trouve un schéma applicatif déjà présent, mais aucun
`supabase_migrations.schema_migrations` et aucune migration listée.
Cela ne prouve pas que les anciens fichiers ont été exécutés, ni dans quel ordre.
Les préfixes `20260824` (5 fichiers), `20260825` (3) et `20260826` (2)
ne sont pas des identifiants uniques utilisables tels quels dans un registre
dont la version est la clé primaire.

**Décision proposée : démarrer un registre prospectif à Core V1 avec un
répertoire de déploiement isolé et une liste explicite de migrations.**
Les migrations historiques restent exactement à leur place dans Git et ne
sont ni renommées, ni rejouées, ni marquées artificiellement comme appliquées.

Un `db push`, `migration up`, `db reset` ou `db pull --yes` depuis la racine
actuelle du dépôt n'est pas une procédure autorisée pour cette production.
Un pull peut proposer de modifier l'historique ; il ne faut pas l'assimiler à
un audit SQL en lecture seule. Les commandes `--include-all`, `--include-seed`
et `--include-roles` sont exclues de cette opération.

## 2. Artefact exact et contrôle avant déploiement

Fichier source :
`supabase/migrations/20260911204606_noline_core_data_v1.sql`.

- Commit Core : `bb9ec93a56b2b6206b719900448326babcf424b1`.
- Blob Git : `11d538d87f9310ef307132ccb7df6c82cec6f206`.
- SHA-256 des octets du blob Git :
  `326e205a9c6add1c9b8fcf044104d7db1012103206be1f06b0fe599b3a030b62`.
- Version de registre attendue : `20260911204606`.
- Nom attendu : `noline_core_data_v1`.

Le checksum porte sur les octets Git, pas sur une copie Windows convertie
automatiquement en CRLF. Extraire le blob sans redirection PowerShell susceptible
de changer l'encodage. Conserver le commit et le checksum dans le dossier de
preuve du déploiement ; le registre Supabase ne constitue pas un contrôle
d'intégrité cryptographique du fichier local.

Après autorisation, préparer un nouveau répertoire local jetable, par exemple
`outputs/core-deployment/supabase/`, avec le CLI épinglé et sa configuration.
Son sous-répertoire `migrations/` doit contenir **uniquement le fichier Core
exact**. Aucun seed, rôle, fichier historique ou migration sécurité proposée
ne doit y être copié.

Avant d'utiliser un CLI, consulter `--version`, `--help`,
`db push --help`, `migration list --help`, `link --help`.
La référence source étudiée est **Supabase CLI v2.117.0** ; toute autre version
doit être vérifiée et répétée sur staging. Utiliser `--workdir` pour désigner
le répertoire isolé ; vérifier la référence liée avant toute commande distante.
Ne jamais mettre le mot de passe ou une URL contenant un secret dans un log,
une commande conservée, un commit ou une PR.

Une fois ces prérequis approuvés, la séquence CLI est :

1. Lier exclusivement le répertoire isolé au projet attendu.
2. Lire `migration list` et exécuter `db push --dry-run` depuis ce répertoire.
3. Vérifier que la liste annoncée contient exactement
   `20260911204606_noline_core_data_v1.sql`.
4. S'arrêter si le registre a changé, si une autre version apparaît ou si
   une proposition de réparation apparaît.
5. Ne passer à `db push` réel qu'après les autorisations et contrôles ci-dessous.

Ces commandes sont une procédure future, pas des actions exécutées pendant
l'audit en lecture seule. Un dry-run inspecte la liste des migrations ; il
ne valide ni les données, ni les policies, ni la réussite future des DDL.

## 3. Transaction SQL et registre : limite explicite

Le fichier Core contient son propre `BEGIN` et son propre `COMMIT`.
Ses modifications de schéma, contraintes, triggers, policies et grants
sont transactionnelles : une incompatibilité avant son COMMIT annule
l'ensemble des changements Core de cette tentative.

Le CLI officiel crée le registre s'il manque, puis ajoute son INSERT de version
**après** les instructions du fichier. Avec le COMMIT explicite de Core, il
existe donc une fenêtre où le schéma est validé mais la version n'est pas
enregistrée. **Ne pas annoncer que le fichier inchangé et son enregistrement
forment une seule transaction atomique.** La création d'un registre vide
peut aussi persister après une tentative Core échouée.

Cette procédure choisit le fichier inchangé pour préserver exactement la PR #1,
avec contrôle obligatoire des deux résultats et arrêt en cas d'ambiguïté :

| État observé après erreur réseau/CLI | Action |
|---|---|
| Schéma baseline et version absente | Vérifier comptes/empreintes ; investiguer l'erreur avant une nouvelle tentative autorisée. |
| Schéma Core complet et version présente | Vérifier nom et contenu enregistrés ; terminer le postflight, sans rejouer. |
| Schéma Core complet et version absente | Maintenir le gel ; présenter les preuves et demander validation d'une réparation ciblée de cette seule version. |
| Version présente mais schéma incohérent | Stop ; aucune suppression de registre ni exécution automatique ; enquête et plan de réparation séparé. |

`migration repair --status applied 20260911204606` ne doit être envisagé que
dans le troisième cas, après preuve de tous les effets Core et autorisation
explicite. Il ne lance pas de SQL métier et ne répare pas un schéma. Ne jamais
l'utiliser pour les anciens préfixes dupliqués.

**Si une atomicité stricte schéma + version est exigée**, préparer et faire
approuver séparément un artefact d'exécution qui enlève uniquement les deux
délimiteurs transactionnels externes, conserve toutes les instructions Core,
et confie la transaction au batch du CLI. Le driver ne garantit sa transaction
implicite qu'en l'absence de contrôles transactionnels dans le SQL. Revoir
chaque instruction avec un parseur SQL, vérifier l'absence de commandes qui
scindent le batch, conserver les deux checksums et effectuer un test avec
échec volontaire d'insertion de registre sur staging. Ne pas faire cette
transformation silencieusement et ne pas modifier la PR #1. Cet artefact
alternatif n'est pas fourni ni validé pour production dans ce sprint.

Sources : [CLI v2.117.0 : exécution et insertion de version](https://github.com/supabase/cli/blob/v2.117.0/apps/cli-go/pkg/migration/file.go),
[création du registre](https://github.com/supabase/cli/blob/v2.117.0/apps/cli-go/pkg/migration/history.go),
[transaction du driver pgconn](https://github.com/jackc/pgconn/blob/master/pgconn.go).

## 4. Sauvegarde : preuves requises avant autorisation

Constat du Sprint 1.5 : l'organisation est sur le plan **Free** ; le projet
est ACTIVE_HEALTHY, PostgreSQL 17.6.1.155. Le connecteur accessible n'expose
pas l'inventaire des sauvegardes. Aucun dernier backup réussi, intervalle PITR
ou exercice de restauration n'a été vérifié. La production ne bénéficie pas
de la garantie documentée des sauvegardes quotidiennes des plans Pro et plus.
La préparation d'un export logique privé et sa restauration de contrôle
restent donc un prérequis réel, pas une formalité déjà satisfaite.

La possibilité générale de sauvegarder ne démontre pas qu'une sauvegarde
restaurable du projet existe. Le dossier de preuve doit contenir :

- plan courant, type de sauvegarde actif, rétention et statut ;
- identifiant/date de la dernière sauvegarde utilisable ou bornes PITR ;
- point de restauration antérieur à la migration et compatible avec le gel ;
- emplacement privé, chiffrement et accès à un export logique récent ;
- rapport de restauration dans un environnement isolé, jamais sur production ;
- temps mesuré de reprise et perte maximale de données acceptable.

Supabase documente des sauvegardes quotidiennes pour les plans payants et PITR
comme option. Vérifier les valeurs du projet via Dashboard > Database > Backups
ou le GET Management API `/v1/projects/{ref}/database/backups`. Une réponse
403 ou un connecteur sans capacité backups signifie **non vérifié**, pas
« aucune sauvegarde ». Ni changement de plan, ni activation PITR, ni
restauration ne font partie des autorisations de ce sprint.

Pour l'export logique, inspecter le `db dump --help` du CLI retenu. Le dump par
défaut n'inclut pas les données et exclut des schémas gérés : ce n'est pas à
lui seul une sauvegarde complète du projet. Préparer schema, données, rôles/ACL
nécessaires et dépendances `auth.users` avec une procédure de restauration
adaptée à Supabase. Stocker les exports hors Git et hors logs/artefacts publics.
Les trois tables seules ne suffisent pas : `projects.user_id` référence Auth.

Les sauvegardes de base ne restaurent pas les octets des objets Storage.
Répertorier aussi les objets Storage, Edge Functions/configuration, secrets
sans les exporter dans le dépôt, et artefacts externes Daytona/GitHub.
Une restauration de base entière peut faire reculer Forge et d'autres modules.
Elle requiert donc une autorisation d'incident distincte ; ce n'est pas le
rollback normal de Core.

Sources : [sauvegardes Supabase](https://supabase.com/docs/guides/platform/backups),
[référence db dump](https://supabase.com/docs/reference/cli/supabase-db-dump).

## 5. Préflight à effectuer sous gel d'écriture approuvé

Le gel applicatif doit couvrir toutes les écritures Core, y compris clients
déjà ouverts, API, jobs et accès administratifs. Le verrou de la migration
bloque les écritures durant sa transaction mais ne remplace pas ce gel :
une écriture légitime juste avant/après empêcherait de comparer 3/9/55.

1. Exécuter `scripts/security/core-readiness-snapshot.sql` en administrateur.
   Il utilise une transaction REPEATABLE READ READ ONLY, une limite de 30 s,
   et termine par ROLLBACK. Il capture comptes, empreintes, métadonnées Core
   et Forge, ACL, contraintes, policies, triggers et fonctions partagées.
2. Vérifier `read_only=on`, le rôle d'audit, les compteurs **3/9/55**, zéro
   orphelin et la présence/absence attendue du registre. Un résultat différent
   entraîne un arrêt : ne pas supprimer des données pour retrouver 3/9/55,
   ni modifier arbitrairement la référence.
3. Conserver l'export privé et le DDL complet de référence, avec grants de
   colonnes, privilèges PUBLIC, propriétaires et paramètres des fonctions.
   Les identifiants OID ne sont pas des critères de comparaison après restore.
4. Capturer aussi les fonctions appelées par les triggers de Forge et les event
   triggers qui peuvent réagir au DDL ; vérifier l'absence d'effet métier
   indirect. Refaire l'audit des types, CHECK, FK, index, policies et grants.
5. Vérifier que `public.set_updated_at()` est identique à la référence,
   que `public.core_set_updated_at()` est absent et que les deux triggers Core
   utilisent actuellement la fonction historique.
6. Lire une dernière fois l'historique distant et confirmer l'unique fichier
   en attente dans le répertoire isolé.
7. Valider la répétition sur staging, les tests réels avec deux JWT utilisateurs,
   le backup, le rollback et la fenêtre de maintenance.
8. Demander l'autorisation explicite d'appliquer uniquement Core à ce projet.

Les empreintes MD5 sont un indicateur de non-modification accidentelle,
pas une signature de sécurité ni une sauvegarde. À 3/9/55 lignes, elles sont
peu coûteuses ; reconsidérer la méthode si le volume évolue fortement.

## 6. Postflight avant réouverture

Rester sous gel. Refaire le snapshot dans une nouvelle transaction en lecture
seule et comparer les trois comptes **exactement à 3/9/55**, ainsi que les
empreintes de contenu à la capture immédiatement pré-migration. Cela vérifie
aussi les colonnes timestamps et métadonnées, sans afficher les messages.

Vérifier ensuite :

- les 12 policies Core ciblent `authenticated`, avec ownership et WITH CHECK
  pour les mises à jour ; aucun accès croisé entre les deux utilisateurs ;
- `anon`/PUBLIC n'ont aucun grant sur les tables Core, `authenticated`
  a seulement SELECT/INSERT/UPDATE/DELETE ; aucun grant de colonne inattendu ;
- toutes les contraintes sont validées, FK CASCADE inchangées et index valides ;
- les deux triggers Core visent `core_set_updated_at()`, fonction invoker
  à search_path fixe ; `set_updated_at()` et les objets Forge restent identiques ;
- le registre contient exactement la nouvelle version Core avec le nom attendu
  et les instructions attendues, sans versions historiques inventées ;
- relancer les advisors et comparer chaque résultat, sans corriger les résultats
  Forge par automatisme ;
- tester Auth, lectures Nova et Forge, isolation utilisateur, puis le CRUD
  complet uniquement sur staging avec des données de test.

Les tests CRUD production qui créeraient ou supprimeraient des objets sont
exclus tant qu'une autorisation distincte ne les couvre pas. Un test destructif
encapsulé dans ROLLBACK reste une écriture et n'est pas un test READ ONLY.

Si tous les critères passent, documenter le résultat, obtenir l'accord prévu
pour la remise en service et surveiller erreurs API/Auth et latence. Ne pas
déployer l'application Vercel production comme effet implicite de la migration.

## 7. Rollback

### Avant le COMMIT Core

Une erreur de validation ou timeout dans la transaction annule les DDL Core.
Fermer toute session en état d'erreur ou exécuter ROLLBACK sur cette session,
puis vérifier baseline, 3/9/55, empreintes, fonctions, policies et absence de
version Core. Un échec réseau ne permet pas de déduire si COMMIT a eu lieu :
inspecter d'abord l'état distant, en lecture seule.

### Après le COMMIT Core

Le premier choix est une correction ciblée en avant ou un retour applicatif
compatible, sous gel d'écriture, sans toucher aux données. Une compensation
de schéma doit être écrite à partir du **snapshot réellement capturé**, revue,
répétée sur staging et autorisée avant exécution.

La compensation doit :

1. contrôler les signatures de l'état Core déployé, arrêter sur toute dérive ;
2. rétablir les définitions exactes des deux anciens triggers Core ;
3. restaurer uniquement les defaults, policies et privilèges que le plan approuvé
   exige, sans copier aveuglément les anciens grants excessifs ;
4. retirer uniquement les contraintes/index dont l'absence baseline et la
   création par cette migration sont prouvées ; garder tous les anciens objets ;
5. laisser `core_set_updated_at()` en place si un autre objet en dépend ; sinon
   sa suppression sans CASCADE peut être proposée séparément ;
6. ne jamais DROP/TRUNCATE les tables, supprimer des lignes, réassigner les
   propriétaires des données, désactiver RLS ou utiliser DROP CASCADE ;
7. préserver intégralement `set_updated_at()` et les objets Forge ;
8. enregistrer la compensation comme une **nouvelle migration**, sans effacer
   la preuve d'application de Core, puis revérifier comptes et empreintes.

Restaurer à l'identique les ACL baseline réintroduirait notamment TRUNCATE pour
des rôles applicatifs. Ce retour de sécurité exige une décision explicite ;
une compensation fonctionnelle avec grants minimaux est préférable si elle
est compatible. Aucune migration « down » générique n'est fournie : elle serait
dangereuse sans snapshot confirmé et état post-déploiement.

Une restauration complète à partir d'une sauvegarde n'est envisagée qu'en
incident majeur, avec autorisation dédiée, acceptation de l'impact Forge/Auth,
gel global, traitement de toutes les écritures depuis le point de sauvegarde
et validation préalable sur une copie isolée.

## 8. Migrations futures sans rejeu historique

Après le premier déploiement validé, maintenir un manifeste versionné contenant
pour chaque migration autorisée : version unique sur 14 chiffres, nom, chemin,
commit, checksum, ticket/PR, environnement et preuve d'application.
Le manifeste commence à Core et ne prétend pas expliquer l'historique antérieur.

Le pipeline produit un répertoire `--workdir` neuf à partir de ce manifeste :
il contient les migrations déjà enregistrées **et** les nouvelles migrations
explicitement approuvées. Ne conserver que la prochaine migration ferait
échouer la comparaison avec les versions distantes antérieures. Une version
distante inconnue du manifeste est un arrêt, jamais un repair automatique.

Créer les nouveaux noms via `supabase migration new <name>`, vérifier l'unicité,
puis valider les migrations transactionnelles sur staging. Le dry-run doit
annoncer exactement les nouvelles versions autorisées. Un seul opérateur
déploie à la fois. Interdire les SQL à COMMIT interne lorsque l'atomicité du
batch et du registre est requise ; traiter les index CONCURRENTLY dans un
protocole spécifique, jamais sous une promesse de rollback global.

Pour construire une nouvelle base de développement, prévoir un chantier
séparé de baseline réelle complète et auditée couvrant Core, Forge et leurs
dépendances Supabase. Cette baseline sert au bootstrap d'une base vide ;
elle n'est pas rejouée en production et n'implique pas de marquer les anciennes
dates dupliquées comme appliquées. Tant que ce chantier n'est pas validé,
le dossier historique n'est pas une source de reconstruction fiable.

Le prochain changement de defaults d'exposition Data API renforce l'intérêt
des grants explicites déjà présents dans Core. Aucun objet des schémas
`auth`, `storage` ou `realtime` n'est à réécrire pour cette migration.

Sources : [suivi des migrations](https://supabase.com/docs/guides/deployment/database-migrations),
[CLI db push / dry-run](https://supabase.com/docs/reference/cli/supabase-db-push),
[changement des grants Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
