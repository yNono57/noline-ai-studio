# Revue de compatibilité runtime — Sprint 1.5

Date : 12 septembre 2026. Branche : `chore/security-production-readiness`, issue de `main` (`1cffe0cfb6052470cbf34b8366d31d5bb9085c22`). Revue indépendante des dépendances et des surfaces runtime. Aucun fichier applicatif, secret ou service distant modifié par cette vérification.

## Périmètre du correctif

Next.js et eslint-config-next passent de 16.2.6 à 16.3.3 ; sharp de 0.34.5 à 0.35.4 ; PostCSS de 8.5.15 à 8.5.23. Les versions React/React DOM 19.0.0, Daytona SDK 0.207.0, Supabase JS 2.114.0 et OpenAI 4.103.0 restent inchangées. Next 16.3.3 accepte Node >=20.9.0 et React 19.0.0. La validation locale utilise Node 24.15.0 sous Windows.

Le verrou conserve les familles majeures des dépendances transitives. Le passage 0.34 à 0.35 de sharp représente toutefois un changement mineur dans un package pré-1.0 : sa compatibilité doit être vérifiée comme un changement runtime significatif. Next 16.3.3 déclare lui-même sharp `^0.35.3` comme dépendance optionnelle. Le verrou choisit la version corrigée 0.35.4.

## Matrice de revue

| Surface | Constat | Couverture et limite |
| --- | --- | --- |
| App Router | Routes `app/`, `Request`/`NextResponse`, paramètres dynamiques attendus avec `await params`. Aucun changement applicatif requis. | Build/typecheck et réponses HTTP locales ; pas de parcours navigateur authentifié complet. |
| Nova | Routes et pipeline conservés, appels Supabase avec `cache: "no-store"`. | Tests safety/web search existants, refus HTTP des accès sans session. Les écritures réelles OpenAI/Supabase ne sont pas exécutées. |
| Auth | Bearer extrait avant accès distant, Auth Supabase consultée avec `no-store`. Pages login/récupération inchangées. | Tests de messages neutres et URLs de récupération, pages HTTP et refus API. Aucun email, signup, reset ou connexion réelle déclenché. |
| Forge/Daytona | SDK et code inchangés. Exécution du code utilisateur confiée au sandbox Daytona, pas à l'hôte Next. | Tests des transitions, ownership, chemins, limites et mocks provider. Aucun sandbox créé, détruit ou modifié. |
| GitHub publishing | Providers inchangés et `no-store`. Tests de confirmations, main/master protégées, idempotence, secrets et repository divergent. | Simulations/mocks de commit, push et PR. Aucun push ou PR Forge réel pour le smoke. |
| Middleware/Server Actions | Aucun middleware/proxy ni directive `use server` dans les sources inspectées. Manifest middleware vide. | Réduit les chemins spécifiques concernés par certains advisories ; ne dispense pas d'appliquer les correctifs framework. |
| Cache | Pas de Cache Components, `use cache`, ISR personnalisé ou cache handler. Les pages de shell sont statiques ; données privées chargées via API authentifiée. | Réponses HTTP observées : pages `s-maxage=31536000`, API 401 sans Cache-Control. Cela ne constitue pas un test cross-user authentifié du cache CDN Vercel. |
| Turbopack | Configuration existante limitée à `root: process.cwd()`, sans règle ou plugin personnalisé. | Build production pris en charge par la validation principale ; aucune réécriture de configuration. |
| Images | Aucun import `next/image` ni appel sharp applicatif trouvé, mais l'endpoint `/_next/image` est actif. Domaines distants non autorisés. | Vérifications HTTP des rejets et smoke natif décrit ci-dessous. |

## Images et advisories critiques

La vulnérabilité Windows [CVE-2026-75604 / GHSA-p293-qw3h-jr36](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) concerne notamment App Router sans Cache Components sur un système de fichiers Windows ; 16.3.3 est une version corrigée. L'environnement local correspond au critère plateforme. Aucune tentative d'exploitation n'a été faite.

L'advisory [GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) concerne le traitement AVIF par libheif/sharp et indique que Next 16.3.3 contourne l'optimisation des entrées AVIF. Le code installé confirme que `BYPASS_TYPES` contient AVIF et retourne le buffer original avant `optimizeImage`.

Un smoke en mémoire, exécuté le 12 septembre, utilise des images unies synthétiques de 32 × 32 pixels générées par sharp et la fonction réelle `next/dist/server/image-optimizer` :

- AVIF demandé en largeur 16 / sortie WebP : **PASS**, type AVIF conservé et buffer strictement identique à l'entrée ; aucun décodage/redimensionnement par l'optimiseur.
- PNG demandé en largeur 16 / sortie WebP : **PASS**, conversion effective en WebP de largeur 16, sans erreur de fallback.
- Binaire local confirmé : **sharp 0.35.4, libvips 8.18.6, libheif 1.23.2**.

Le test appelle `imageOptimizer` avec la configuration images par défaut et `experimental: {}`. Il vérifie explicitement l'absence d'erreur de fallback. Aucun fichier public ni fixture malveillante créé. Une future image AVIF conservera sa taille originale sur ce chemin : régression fonctionnelle possible en bande passante, assumée par la mitigation du framework.

## Smoke HTTP du build production local

Commande : `npm run start -- --hostname 127.0.0.1 --port 3105`. Le serveur Next 16.3.3 a démarré et a été arrêté après le test. Toutes les requêtes étaient des GET sans cookie ni Authorization, sur loopback. Aucun appel à une API externe n'était nécessaire. Une URL `example.com` a uniquement été soumise à la validation d'images et rejetée avant récupération.

**15 vérifications PASS** :

| Route | Résultat |
| --- | --- |
| `/`, `/login`, `/auth/reset-password`, `/nova`, `/forge` | 200 HTML (5) |
| `/api/nova/projects`, `/api/nova/conversations/<UUID synthétique>/messages` | 401 JSON (2) |
| `/api/forge/projects`, `/api/forge/github/connection` | 401 JSON (2) |
| `/api/forge/conversations/<UUID synthétique>/workspace/runtime`, `/files`, `/git/status` | 401 JSON (3) |
| GET `/api/nova/projects/<UUID synthétique>` | 405 attendu : ce handler expose PATCH/DELETE, pas GET (1) |
| `/_next/image` sans paramètres | 400, paramètre URL requis (1) |
| `/_next/image?url=https%3A%2F%2Fexample.com%2Fsynthetic.png&w=64&q=75` | 400, URL non autorisée (1) |

Le résultat détaillé local est enregistré dans `outputs/runtime-http-smoke.json` (ignoré par Git). L'absence de session garantit que les routes privées sont refusées avant l'accès à Supabase, Daytona et GitHub. Ce smoke valide le dispatch Next et les gardes d'accès, pas les opérations métier authentifiées.

## Relation avec Core Data et validation restante

La branche sécurité issue de main ne contient pas les deux fichiers de tests Core ni les changements Core de `bb9ec93a56b2b6206b719900448326babcf424b1`. Elle possède 217 tests historiques ; les 15 tests Core doivent être vérifiés séparément sur une copie temporaire combinant le commit Core et les dépendances sécurité. Les scripts et dépendances de test des deux branches doivent être conservés lors de leur intégration future. Cela ne nécessite aucune modification de la PR #1 pendant ce sprint.

Le code historique de main conserve sa dépendance à la clé service role dans le helper partagé. Sa suppression du chemin Core appartient à la PR #1 ; cette branche sécurité ne doit pas être présentée comme contenant ce durcissement.

À compléter dans une Preview/staging dédiée avant production : connexion réelle, requêtes Nova authentifiées, lecture workspace Daytona autorisée et test de publishing GitHub dans un dépôt de test explicitement autorisé. Les mocks existants et le smoke local ne certifient ni les permissions réelles ni la disponibilité des providers. Vérifier aussi le runtime Node et les binaires sharp Linux dans le build Vercel. Aucun changement de ces intégrations n'est recommandé sur la seule base de cette montée de versions.
