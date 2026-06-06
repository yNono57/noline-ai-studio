export type AgentVariable = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "time";
  placeholder: string;
  options?: string[];
};

export type OfficialAgent = {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  tones: string[];
  useCases: string[];
  systemPrompt: string;
  variables: AgentVariable[];
};

const sharedVariables: AgentVariable[] = [
  {
    name: "objective",
    label: "Objectif",
    type: "textarea",
    placeholder: "Décrivez le résultat attendu."
  },
  {
    name: "additionalContext",
    label: "Contexte complémentaire",
    type: "textarea",
    placeholder: "Informations, contraintes ou éléments à intégrer."
  }
];

export const officialAgents: OfficialAgent[] = [
  {
    id: "matchday-pro",
    name: "Matchday Pro",
    shortDescription: "Crée des contenus sportifs complets pour chaque temps fort d’un match.",
    description:
      "Matchday Pro V2 prépare des publications adaptées au sport, au moment du match et au canal de diffusion. Il exploite automatiquement l’identité du client sélectionné.",
    category: "Sport & communication",
    tones: ["Dynamique", "Sportive", "Fédératrice", "Institutionnelle"],
    useCases: [
      "Annoncer une rencontre et mobiliser les supporters",
      "Publier un score ou une victoire rapidement",
      "Valoriser l’homme du match",
      "Adapter un même message à plusieurs réseaux"
    ],
    systemPrompt:
      "Tu es Matchday Pro, expert en communication sportive francophone. Tu produis un contenu précis, énergique et prêt à publier, adapté au sport, au format et au type de publication choisis. Tu n’inventes aucun score, horaire ou fait. Tu valorises le collectif, les supporters et les partenaires avec mesure.",
    variables: [
      {
        name: "sport",
        label: "Sport",
        type: "select",
        placeholder: "Choisir un sport",
        options: ["Handball", "Football", "Basket", "Rugby", "Volley"]
      },
      {
        name: "format",
        label: "Format",
        type: "select",
        placeholder: "Choisir un format",
        options: ["Facebook", "Instagram", "Story", "LinkedIn", "Site web"]
      },
      {
        name: "publicationType",
        label: "Type de publication",
        type: "select",
        placeholder: "Choisir un type",
        options: [
          "Avant-match",
          "Jour de match",
          "Résultat",
          "Victoire",
          "Défaite",
          "Homme du match"
        ]
      },
      { name: "opponent", label: "Adversaire", type: "text", placeholder: "Ex. AS Montreuil" },
      { name: "matchDate", label: "Date", type: "date", placeholder: "" },
      { name: "matchTime", label: "Heure", type: "time", placeholder: "" },
      {
        name: "matchDetails",
        label: "Informations du match",
        type: "textarea",
        placeholder: "Lieu, compétition, score, joueur clé, billetterie..."
      },
      ...sharedVariables
    ]
  },
  {
    id: "sponsor-pro",
    name: "Sponsor Pro",
    shortDescription: "Structure les prises de contact et les contenus dédiés aux partenaires.",
    description:
      "Sponsor Pro aide les clubs, associations et entreprises à prospecter, relancer et valoriser leurs partenaires avec un discours professionnel.",
    category: "Partenariats",
    tones: ["Professionnelle", "Commerciale", "Institutionnelle", "Chaleureuse"],
    useCases: [
      "Écrire un premier e-mail sponsor",
      "Relancer un partenaire potentiel",
      "Préparer une proposition de partenariat",
      "Créer une publication de remerciement",
      "Structurer un dossier partenaire"
    ],
    systemPrompt:
      "Tu es Sponsor Pro, expert en partenariats locaux et sponsoring. Tu construis des messages crédibles, personnalisés et orientés bénéfices mutuels. Tu évites les promesses non vérifiables et proposes toujours une prochaine étape claire.",
    variables: [
      {
        name: "contentType",
        label: "Livrable",
        type: "select",
        placeholder: "Choisir un livrable",
        options: [
          "Email sponsor",
          "Relance sponsor",
          "Proposition partenaire",
          "Publication sponsor",
          "Dossier partenaire"
        ]
      },
      {
        name: "partnerName",
        label: "Partenaire ciblé",
        type: "text",
        placeholder: "Ex. Entreprise Horizon"
      },
      {
        name: "offer",
        label: "Offre de partenariat",
        type: "textarea",
        placeholder: "Visibilité, hospitalité, présence maillot, événement..."
      },
      ...sharedVariables
    ]
  },
  {
    id: "community-manager-pro",
    name: "Community Manager Pro",
    shortDescription: "Planifie et rédige une communication sociale régulière et engageante.",
    description:
      "Community Manager Pro transforme les temps forts d’une organisation en idées, calendriers et publications adaptées à chaque réseau.",
    category: "Réseaux sociaux",
    tones: ["Créative", "Dynamique", "Proche", "Premium"],
    useCases: [
      "Créer un calendrier éditorial",
      "Rédiger une publication Facebook ou Instagram",
      "Préparer une story",
      "Trouver des hashtags cohérents",
      "Générer une banque d’idées de contenus"
    ],
    systemPrompt:
      "Tu es Community Manager Pro, stratège social media francophone. Tu produis des contenus concrets, variés, adaptés au canal et à l’audience. Chaque proposition comprend une accroche forte, un message lisible et un appel à l’action naturel.",
    variables: [
      {
        name: "contentType",
        label: "Livrable",
        type: "select",
        placeholder: "Choisir un livrable",
        options: [
          "Calendrier éditorial",
          "Publication Facebook",
          "Publication Instagram",
          "Story",
          "Hashtags",
          "Idées de contenus"
        ]
      },
      {
        name: "topic",
        label: "Sujet",
        type: "text",
        placeholder: "Ex. Lancement de saison"
      },
      {
        name: "audience",
        label: "Audience",
        type: "text",
        placeholder: "Ex. Supporters, familles, clients locaux"
      },
      ...sharedVariables
    ]
  },
  {
    id: "commercial-pro",
    name: "Commercial Pro",
    shortDescription: "Produit des supports commerciaux clairs, convaincants et actionnables.",
    description:
      "Commercial Pro accompagne la prospection et la vente, du premier contact jusqu’à la proposition, avec des livrables directement exploitables.",
    category: "Vente",
    tones: ["Directe", "Commerciale", "Premium", "Pédagogique"],
    useCases: [
      "Écrire un e-mail de prospection",
      "Relancer un prospect",
      "Créer une proposition commerciale",
      "Préparer un devis simplifié",
      "Construire un argumentaire de vente"
    ],
    systemPrompt:
      "Tu es Commercial Pro, expert en vente B2B locale. Tu rédiges des supports courts, crédibles et centrés sur le besoin du prospect. Tu relies chaque caractéristique à un bénéfice et termines par une action simple à accepter.",
    variables: [
      {
        name: "contentType",
        label: "Livrable",
        type: "select",
        placeholder: "Choisir un livrable",
        options: [
          "Email de prospection",
          "Relance commerciale",
          "Proposition commerciale",
          "Devis simplifié",
          "Argumentaire de vente"
        ]
      },
      {
        name: "prospectName",
        label: "Prospect",
        type: "text",
        placeholder: "Ex. Maison Dupont"
      },
      {
        name: "offer",
        label: "Offre",
        type: "textarea",
        placeholder: "Décrivez la solution, le prix et les bénéfices."
      },
      ...sharedVariables
    ]
  },
  {
    id: "portfolio-builder",
    name: "Portfolio Builder",
    shortDescription: "Transforme les réalisations en présentations structurées et valorisantes.",
    description:
      "Portfolio Builder met en récit une organisation, un projet ou un résultat pour créer un support de présentation professionnel.",
    category: "Présentation",
    tones: ["Premium", "Narrative", "Corporate", "Inspirante"],
    useCases: [
      "Rédiger une étude de cas",
      "Créer un portfolio entreprise",
      "Présenter un club ou une association",
      "Préparer une présentation commerciale"
    ],
    systemPrompt:
      "Tu es Portfolio Builder, expert en storytelling de marque et études de cas. Tu structures les informations en contexte, enjeu, approche, réalisations, résultats et prochaine étape. Tu n’inventes aucun chiffre et mets en valeur les preuves fournies.",
    variables: [
      {
        name: "contentType",
        label: "Livrable",
        type: "select",
        placeholder: "Choisir un livrable",
        options: [
          "Étude de cas",
          "Portfolio entreprise",
          "Portfolio club",
          "Portfolio association",
          "Présentation commerciale"
        ]
      },
      {
        name: "project",
        label: "Projet ou organisation",
        type: "text",
        placeholder: "Ex. Refonte de la communication du club"
      },
      {
        name: "results",
        label: "Réalisations et résultats",
        type: "textarea",
        placeholder: "Actions menées, livrables, résultats observés..."
      },
      ...sharedVariables
    ]
  }
];

export function getOfficialAgent(id: string) {
  return officialAgents.find((agent) => agent.id === id);
}
