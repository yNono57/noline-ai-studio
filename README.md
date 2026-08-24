# NOLINE AI STUDIO

Webapp SaaS Next.js pour generer des contenus marketing et des visuels prets a publier pour clubs sportifs, associations, commerces et clients d'agence.

## Fonctionnalites

- Page d'accueil SaaS premium, dashboard, navigation laterale responsive
- Generateurs: Matchday, Victoire, Homme du match, Sponsor, Description Facebook, Script video, Devis, Proposition commerciale, E-mail de prospection, Calendrier editorial
- Createur de visuels type Canva simplifie: templates modifiables, logo client, photo de fond, couleurs, styles, previsualisation en direct
- Exports: PNG, PDF, Post Instagram, Story Instagram, banniere Facebook
- Mode agence: clients multiples, marque client, templates par secteur, creations liees a un client
- CRM simple pour suivre les prospects
- Historique des textes et visuels generes
- Authentification email/mot de passe avec Supabase
- Sauvegarde automatique des creations avec Supabase
- Dashboard professionnel avec statistiques, activité récente, raccourcis et favoris
- Agents officiels: Matchday Pro, Sponsor Pro, Community Manager Pro, Commercial Pro et Portfolio Builder
- Agents personnalisés avec fiches détaillées, variables, prompts et historique lié
- Clients enrichis: identité, coordonnées, couleurs, slogan et réseaux sociaux
- Historique filtrable avec favoris, copie et suppression
- Quotas préparés: Gratuit 20 générations/mois, Pro 100, Business illimité
- Architecture Stripe conservée mais paiement à activer ultérieurement
- Endpoint OpenAI cote serveur pour proteger la cle API

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- OpenAI API
- Supabase Auth + Database
- Stripe Checkout + Customer Portal + Webhooks
- SVG + Canvas HTML pour les visuels
- Vercel pour le deploiement

## Installation locale

Installer les dependances:

```bash
npm install
```

Creer le fichier d'environnement local:

```bash
cp .env.local.example .env.local
```

Sur Windows PowerShell, si `cp` ne fonctionne pas:

```powershell
Copy-Item .env.local.example .env.local
```

Remplir au minimum:

```env
OPENAI_API_KEY=sk-your-openai-api-key
NOVA_MODEL=gpt-5.4-mini
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Lancer le projet:

```bash
npm run dev
```

Ouvrir l'application:

```text
http://localhost:3000
```

Si `localhost` refuse la connexion sur Windows, essayer:

```text
http://127.0.0.1:3000
```

## Mode demo

Si `OPENAI_API_KEY` n'est pas configuree, l'application retourne un exemple de contenu. Cela permet de tester l'interface, les templates visuels et les exports sans cle API.

## Variables d'environnement

Toutes les variables sont listees dans `.env.example` et `.env.local.example`.

```env
OPENAI_API_KEY=sk-your-openai-api-key
NOVA_MODEL=gpt-5.4-mini
OPENAI_MODEL=gpt-4.1-mini

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

NEXT_PUBLIC_APP_URL=http://localhost:3000

STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_STARTER_PRICE_ID=price_starter_monthly
STRIPE_PRO_PRICE_ID=price_pro_monthly
```

## Supabase

1. Creer un projet Supabase.
2. Ouvrir `SQL Editor`.
3. Copier le contenu de `supabase/schema.sql`.
4. Executer le script.
5. Exécuter ensuite `supabase/migrations/20260606_professional_ai_agents_platform.sql`.
6. Ajouter les variables Supabase dans `.env.local` et dans Vercel.

Donnees stockees:

- utilisateurs via Supabase Auth
- marques clients
- textes generes
- agents officiels et personnalisés
- clients et favoris
- visuels generes
- générations et limites d’usage mensuelles
- abonnements

Sans Supabase configure, l'application continue de fonctionner avec un historique local dans le navigateur.

## Stripe

1. Creer un produit `Starter` avec un prix recurrent de 19 EUR/mois.
2. Creer un produit `Pro` avec un prix recurrent de 49 EUR/mois.
3. Copier les deux `price_id` dans les variables d'environnement.
4. Creer un webhook Stripe vers:

```text
https://votre-domaine.vercel.app/api/stripe/webhook
```

Evenements a activer:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Le plan actif et le quota sont verifies avant chaque generation.

## Scripts

```bash
npm run dev      # lancer en local
npm run build    # verifier le build de production
npm run start    # lancer le build en production locale
npm run lint     # verifier le code
```

## Architecture

```text
app/
  api/account/route.ts          Profil, quota et abonnement
  api/brand/route.ts            Sauvegarde marque client
  api/creations/route.ts        Historique Supabase
  api/generate/route.ts         Endpoint serveur OpenAI
  api/stripe/checkout/route.ts  Paiement Stripe Checkout
  api/stripe/portal/route.ts    Portail client Stripe
  api/stripe/webhook/route.ts   Synchronisation abonnements
  api/visuals/route.ts          Sauvegarde visuels
  page.tsx                      Page d'accueil
  dashboard/page.tsx            Tableau de bord SaaS
  generate/page.tsx             Studio texte + visuels
  generators/page.tsx           Catalogue des generateurs
  creations/page.tsx            Historique textes et visuels
  brand/page.tsx                Marque client
  clients/page.tsx              Clients agence
  templates/page.tsx            Bibliotheque templates
  presentation/page.tsx         Presentation client
  pricing/page.tsx              Tarifs
  settings/page.tsx             Parametres
  crm/page.tsx                  CRM prospects
  history/page.tsx              Historique local
  login/page.tsx                Connexion
components/
  Shell.tsx                     Layout SaaS
  GeneratorForm.tsx             Formulaires et generation IA
  VisualCreator.tsx             Templates visuels et exports
  ClientsView.tsx               Gestion clients agence
  TemplatesView.tsx             Bibliotheque de templates
  CreationsView.tsx             Mes creations
  SettingsView.tsx              Profil et abonnement
lib/
  generators.ts                 Configuration des generateurs
  prompts.ts                    Prompts OpenAI
  visuals.ts                    Formats et textes de templates visuels
  templates.ts                  Templates sectoriels
  supabase-client.ts            Auth Supabase cote navigateur
  supabase-server.ts            Acces Supabase cote serveur
  stripe.ts                     Appels Stripe et verification webhook
```

## Deploiement Vercel

Le projet est pret pour Vercel avec `vercel.json`.

Guide complet:

```text
VERCEL_DEPLOYMENT.md
```

Avant de deployer:

1. Pousser le projet sur GitHub.
2. Importer le repository dans Vercel.
3. Ajouter toutes les variables d'environnement dans Vercel.
4. Executer `supabase/schema.sql` dans Supabase.
5. Configurer le webhook Stripe.
6. Lancer le deploiement.
