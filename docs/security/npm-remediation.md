# Sprint 1.5 — correctif npm du 12 septembre 2026

Branche dédiée depuis main `1cffe0cfb6052470cbf34b8366d31d5bb9085c22` : `chore/security-production-readiness`.
La PR Core #1 n'est ni modifiée ni mergée.

## Résultat

L'audit du lockfile initial retrouve 9 packages vulnérables : 1 critique, 6 high, 1 moderate et 1 low. Après installation et actualisation ciblée : **0 vulnérabilité npm connue** (production et développement).
Ce résultat est daté ; il ne garantit pas l'absence de vulnérabilité inconnue.

| Package | Avant | Après | Relation |
|---|---|---|---|
| next | 16.2.6 | 16.3.3 | direct, runtime |
| eslint-config-next | 16.2.6 | 16.3.3 | direct, outils |
| sharp | 0.34.5 | 0.35.4 | optional de Next |
| postcss | 8.5.15 | 8.5.23 | direct dev + Next/Tailwind |
| baseline-browser-mapping | 2.10.33 | 2.11.22 | Next + browserslist |
| browserslist | 4.28.2 | 4.28.9 | Autoprefixer + Babel |
| brace-expansion | 1.1.15 / 5.0.6 | 1.1.18 / 5.0.9 | minimatch/ESLint |
| js-yaml | 4.2.0 | 4.3.2 | ESLint |
| nanoid | 3.3.12 | 3.3.19 | PostCSS |
| postcss-selector-parser | 6.1.2 | 6.1.4 | Tailwind/postcss-nested |

Next et eslint-config-next sont épinglés à la même version. PostCSS est épinglé et son override référence la dépendance directe via `$postcss`.
Les deux familles brace-expansion restent dans leurs majors respectives.
Les autres transitifs sont résolus dans les plages compatibles des dépendances existantes ; aucune dépendance applicative Daytona, Supabase, OpenAI, React ou Tailwind n'est mise à niveau.
Les données browserslist et les binaires SWC/sharp suivent leurs parents. Pas de `npm audit fix --force`.

Commandes effectuées : `npm audit --json`, vérification `npm view` des versions/plages, édition ciblée de package.json, `npm install --ignore-scripts --no-audit`, `npm update baseline-browser-mapping browserslist brace-expansion js-yaml postcss-selector-parser --ignore-scripts --no-audit`, puis `npm install` et `npm audit`.
Le lockfile complet est committé, avec les variantes natives pour les plateformes supportées.
`tsx@4.20.6` et les scripts `test` / `typecheck` rendent la validation existante reproductible sur main ; aucune implémentation Nova/Forge n'est réécrite.

## Advisories et exposition

- Next critique Windows : [GHSA-p293-qw3h-jr36 / CVE-2026-75604](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36). App/Pages Router hébergé sur système Windows sans Cache Components ; patch 16.3.3. Environnement local Windows concerné potentiellement ; exploitation en production non démontrée.
- Next critique AVIF : [GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4). Patch 16.3.3, bypass du décodage/optimisation AVIF ; [sharp 0.35.4](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) corrige aussi libheif. L'optimiseur reste une route exposée même sans import next/image.
- Next autres : bypass middleware [6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24), Server Actions DoS [m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj), SSRF [89xv-2m56-2m9x](https://github.com/advisories/GHSA-89xv-2m56-2m9x), cache [68g3-v927-f742](https://github.com/advisories/GHSA-68g3-v927-f742) et [4633-3j49-mh5q](https://github.com/advisories/GHSA-4633-3j49-mh5q), payload Edge [4c39-4ccg-62r3](https://github.com/advisories/GHSA-4c39-4ccg-62r3), rewrite SSRF [p9j2-gv94-2wf4](https://github.com/advisories/GHSA-p9j2-gv94-2wf4), SVG DoS [q8wf-6r8g-63ch](https://github.com/advisories/GHSA-q8wf-6r8g-63ch), disclosure [955p-x3mx-jcvp](https://github.com/advisories/GHSA-955p-x3mx-jcvp). Aucune Server Action, middleware, rewrite ni custom server dans le dépôt inspecté.
- sharp : [libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) et [libheif](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), correction native minimale 0.35.4.
- PostCSS : [source map auto-loading](https://github.com/advisories/GHSA-r28c-9q8g-f849), [correctif incomplet](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp). Entrées CSS non fiables requises ; pas de traitement utilisateur prouvé sur l'hôte NØLINE.
- baseline-browser-mapping : [crash sur entrée invalide](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv).
- browserslist : [cache non borné](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [stats non fiables](https://github.com/advisories/GHSA-73wf-gq98-2v4g).
- brace-expansion : [expansion exponentielle](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [mémoire non bornée](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [contournement de mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895).
- js-yaml : [merge chains](https://github.com/advisories/GHSA-52cp-r559-cp3m), [omap](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [empty merges](https://github.com/advisories/GHSA-2883-xcg3-v3hh).
- nanoid : [taille négative](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [taille nulle](https://github.com/advisories/GHSA-2v37-7h3g-55p8).
- postcss-selector-parser : [récursion AST](https://github.com/advisories/GHSA-w9m9-85wc-3x92).

Les derniers packages concernent surtout la chaîne lint/build. Aucun chemin public vers des entrées YAML/globs/stats non fiables sur l'hôte n'a été prouvé ; l'exécution du code Forge dans Daytona ne suffit pas à démontrer cette exposition. Les correctifs restent nécessaires pour la chaîne de construction.

## Validation et intégration avec Core

Branche sécurité seule : 217 tests, lint, TypeScript et build production Next 16.3.3/Turbopack passent.
Une copie détachée de Core bb9ec93 avec les mêmes versions corrigées permet d'exécuter les 232 tests, sans toucher la branche Core. Voir le rapport de validation final pour ses résultats.
Le merge-tree local détecte un conflit dans package.json entre les deux PR. Le lockfile fusionne textuellement, mais devra être régénéré/vérifié à l'intégration autorisée.
Résolution attendue : conserver les versions sécurisées, server-only/PGlite de Core, ses deux scripts de tests et l'override PostCSS. Ne jamais remplacer package.json Core entier par celui de la sécurité.
Aucune résolution n'est appliquée à la PR #1 pendant ce sprint.

Risques de régression : nouveau mineur Next16.3, cache/routage, Turbopack, AVIF et binaires natifs sharp. React19 et Node24 locaux satisfont les contraintes publiées. Les tests et la Preview réduisent ces risques ; les parcours authentifiés vers Supabase, Daytona et GitHub demandent une validation staging avec ressources de test avant production.
