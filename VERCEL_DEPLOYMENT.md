# Deployer NOLINE AI STUDIO sur Vercel

Ce guide permet de mettre l'application en ligne sans garder une fenetre locale ouverte.

## 1. Verifier le projet en local

```bash
npm install
npm run lint
npm run build
```

## 2. Creer le repository GitHub

1. Ouvrir GitHub.
2. Creer un repository, par exemple `noline-ai-studio`.
3. Envoyer le projet dans ce repository.

## 3. Importer dans Vercel

1. Aller sur `https://vercel.com`.
2. Cliquer sur `Add New...`.
3. Choisir `Project`.
4. Importer le repository GitHub.
5. Framework: `Next.js`.
6. Install command: `npm install`.
7. Build command: `npm run build`.
8. Output directory: laisser vide.

Le fichier `vercel.json` indique deja a Vercel que le projet est une application Next.js.

## 4. Ajouter les variables d'environnement

Dans Vercel:

```text
Project Settings > Environment Variables
```

Ajouter pour les environnements `Production`, `Preview` et `Development` selon le besoin:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_APP_URL=https://votre-domaine.vercel.app

STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
```

Important: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` ne doivent jamais etre exposees cote client.

## 5. Configurer Supabase

1. Creer un projet Supabase.
2. Aller dans `SQL Editor`.
3. Copier le contenu de `supabase/schema.sql`.
4. Executer le script.
5. Dans `Authentication > URL Configuration`, renseigner l'URL Vercel dans `Site URL`.
6. Ajouter aussi l'URL locale si besoin:

```text
http://localhost:3000
```

## 6. Configurer Stripe

Creer deux produits avec prix recurrents:

- Starter: 19 EUR/mois
- Pro: 49 EUR/mois

Copier les identifiants de prix dans:

```env
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
```

Creer ensuite un webhook Stripe:

```text
https://votre-domaine.vercel.app/api/stripe/webhook
```

Evenements a cocher:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copier le secret du webhook dans:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 7. Lancer le deploiement

1. Cliquer sur `Deploy`.
2. Attendre la fin du build.
3. Ouvrir l'URL fournie par Vercel.

## 8. Apres deploiement

Si Vercel donne une URL finale differente, mettre a jour:

```env
NEXT_PUBLIC_APP_URL=https://votre-domaine.vercel.app
```

Puis relancer un redeploiement.

Tester ensuite:

- inscription et connexion
- generation d'un texte
- creation d'un visuel
- sauvegarde dans Mes creations
- page Tarifs et redirection Stripe
- webhook Stripe apres un paiement test
