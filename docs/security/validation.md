# Sprint 1.5 — validation finale

Date : 12 septembre 2026. Base main : `1cffe0cfb6052470cbf34b8366d31d5bb9085c22`.
Branche : `chore/security-production-readiness`.
Commit dépendances : `b8b712ff2cb8b5f8b3a758f9ac1221b63b574a15`.

## Résultats exécutés

| Contrôle | Branche sécurité seule | Copie locale Core + versions sécurité |
|---|---|---|
| Tests applicatifs | 217 PASS | 232 PASS (217 + 15 Core) |
| Lint | PASS, y compris scripts SQL auxiliaires finaux | PASS |
| TypeScript | PASS | PASS |
| Build production | PASS, Next16.3.3/Turbopack, 50 pages statiques | PASS, Next16.3.3/Turbopack |
| npm audit | 0 vulnérabilité, code0 | 0 lors de npm install |
| npm ls --all | PASS, code0 | installation validée |

La copie de compatibilité est détachée de Git au commit Core `bb9ec93a56b2b6206b719900448326babcf424b1`. Seuls ses fichiers de dépendances sont adaptés pour le test. Aucun commit ni modification de la branche Core.

Contrôles supplémentaires distincts du total applicatif :
- 15 smokes HTTP loopback PASS : shells App Router, refus API Nova/Forge/GitHub/Daytona, validation méthode/URL images.
- AVIF synthétique conservé sans optimisation ; PNG synthétique redimensionné en WebP : PASS.
- 8 contrôles PGlite de la proposition de durcissement des fonctions : PASS (signup, sept triggers historiques, ACL, rejouabilité, rollback et dérive).
- Snapshot SQL auxiliaire testé localement et sur production en READ ONLY : 3/9/55, zéro orphelin, ledger absent.

Aucun exploit malveillant, email Auth, sandbox Daytona ou publishing GitHub métier déclenché pour les tests.

## Vercel

La Preview Git de la branche sécurité est READY :
- commit applicatif `b8b712ff2cb8b5f8b3a758f9ac1221b63b574a15` ;
- déploiement `dpl_hq45bVwYnC2xF9tcz1uvvCXxyx4B` ;
- [Preview](https://noline-ai-studio-eri5j5cu8-nonolp57-4104s-projects.vercel.app) ;
- target null (preview), source git, branche sécurité ; aucune promotion production ;
- GET non authentifié /api/nova/projects via le connecteur Vercel : 401, message neutre, cache MISS.

La réussite du build Linux Vercel ne constitue pas à elle seule un test d'image native ni de providers authentifiés sur cette plateforme. La dernière révision documentaire est contrôlée séparément dans la PR.

## Supabase et déploiement

Production inchangée : Core n'est pas appliquée, ni la proposition sécurité.
Advisors inchangés : 4 WARN sécurité et40 performance (21WARN,19INFO).
Le plan Free est confirmé. Aucun backup privé, date de sauvegarde restaurable ou exercice de restauration n'a été vérifié ; les fonctions gérées Pro+/PITR ne peuvent pas être revendiquées.

La proposition SQL est conservée sous supabase/proposals, hors migrations actives. Elle fixe le search_path partagé et retire EXECUTE aux rôles API sur le trigger Auth tout en maintenant le rôle Auth. Ses changements doivent être approuvés et testés sur staging avant application.

Le runbook isole uniquement Core, conserve les fichiers historiques et démarre le registre prospectif à la version Core. Il décrit la fenêtre possible entre COMMIT du SQL inchangé et insertion de version, ainsi que les contrôles/réparations qui exigent une validation distincte.

## Risques et décisions restantes

1. Prouver une sauvegarde récente, protégée et restaurable ; valider sa couverture Auth/Forge et un exercice de restauration isolé.
2. Valider le runbook, la fenêtre de maintenance et les contrôles postflight exacts3/9/55 + empreintes ; aucun db push global.
3. Valider de vrais parcours sur staging : Auth, Nova avec deux utilisateurs, workspace Daytona et publishing GitHub sur ressources de test autorisées.
4. Revoir la proposition SQL indépendamment ; aucune obligation de toucher les fonctions historiques par automatisme.
5. La protection des mots de passe compromis nécessite Pro+ selon documentation ; décision de plan/option séparée.
6. Intégration future avec PR#1 : conflit package.json détecté par merge-tree ; conserver scripts/deps Core et versions sécurité, régénérer/vérifier lockfile. PR#1 inchangée.

Le correctif npm est prêt à revue, audit0 et validations vertes. La disponibilité d'une sauvegarde restaurable et les preuves staging de production readiness manquent encore ; aucune autorisation de production ne découle de ces résultats.

SECURITY READINESS : NO-GO

CORE DATA V1 APRÈS SECURITY : NO-GO

Ces verdicts portent sur la préparation globale à la production. Le volet correctif npm est PASS ; les deux NO-GO ne signalent pas un échec du patch Next ni des tests.
