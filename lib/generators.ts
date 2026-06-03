import {
  Briefcase,
  Bot,
  CalendarDays,
  CalendarRange,
  FileText,
  Handshake,
  MailPlus,
  Megaphone,
  Star,
  Trophy,
  Video
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type GeneratorId =
  | "matchday"
  | "victory"
  | "player-of-match"
  | "sponsor"
  | "facebook-description"
  | "video-script"
  | "noline-quote"
  | "commercial-proposal"
  | "prospecting-email"
  | "editorial-calendar"
  | "agent-builder";

export type FieldType = "text" | "date" | "time" | "textarea" | "select" | "multiselect";

export type GeneratorField = {
  name: string;
  label: string;
  placeholder: string;
  type: FieldType;
  options?: string[];
};

export type GeneratorConfig = {
  id: GeneratorId;
  title: string;
  description: string;
  icon: LucideIcon;
  plan: "Gratuit" | "Premium";
  outputLabel: string;
  visual: boolean;
  fields: GeneratorField[];
};

export const generators: GeneratorConfig[] = [
  {
    id: "matchday",
    title: "Post Matchday",
    description: "Annonce de match claire, engageante et prete a publier.",
    icon: CalendarDays,
    plan: "Gratuit",
    outputLabel: "Texte Facebook, Instagram et hashtags",
    visual: true,
    fields: [
      { name: "clubName", label: "Nom du club", placeholder: "Ex. NOLINE FC", type: "text" },
      { name: "opponent", label: "Adversaire", placeholder: "Ex. AS Montreuil", type: "text" },
      { name: "date", label: "Date", placeholder: "", type: "date" },
      { name: "time", label: "Heure", placeholder: "", type: "time" },
      { name: "competition", label: "Competition", placeholder: "Ex. Championnat Regional", type: "text" },
      { name: "location", label: "Lieu", placeholder: "Ex. Stade Municipal", type: "text" }
    ]
  },
  {
    id: "victory",
    title: "Post Victoire",
    description: "Valorise le score, les joueurs cles et l'energie du club.",
    icon: Trophy,
    plan: "Gratuit",
    outputLabel: "Texte Facebook, Instagram et hashtags",
    visual: true,
    fields: [
      { name: "score", label: "Score", placeholder: "Ex. 3-1", type: "text" },
      { name: "opponent", label: "Adversaire", placeholder: "Ex. FC Horizon", type: "text" },
      {
        name: "keyPlayers",
        label: "Buteurs ou joueurs cles",
        placeholder: "Ex. Martin, Diallo, capitaine Lucas",
        type: "textarea"
      }
    ]
  },
  {
    id: "player-of-match",
    title: "Homme du match",
    description: "Met en avant le joueur cle avec un texte et un visuel impactant.",
    icon: Star,
    plan: "Gratuit",
    outputLabel: "Texte Facebook, Instagram et hashtags",
    visual: true,
    fields: [
      { name: "clubName", label: "Nom du club", placeholder: "Ex. NOLINE FC", type: "text" },
      { name: "playerName", label: "Nom du joueur", placeholder: "Ex. Lucas Martin", type: "text" },
      { name: "match", label: "Match", placeholder: "Ex. NOLINE FC vs AS Montreuil", type: "text" },
      {
        name: "performance",
        label: "Performance",
        placeholder: "Ex. 2 buts, 1 passe decisive, grosse activite",
        type: "textarea"
      }
    ]
  },
  {
    id: "sponsor",
    title: "Sponsor",
    description: "Remerciement professionnel pour partenaires et mecenes.",
    icon: Handshake,
    plan: "Premium",
    outputLabel: "Texte Facebook, Instagram et hashtags",
    visual: true,
    fields: [
      { name: "sponsorName", label: "Nom du sponsor", placeholder: "Ex. Orange Business", type: "text" },
      {
        name: "partnershipType",
        label: "Type de partenariat",
        placeholder: "Choisir",
        type: "select",
        options: ["Maillot", "Evenement", "Soutien financier", "Materiel", "Partenaire institutionnel"]
      }
    ]
  },
  {
    id: "facebook-description",
    title: "Description Facebook",
    description: "Optimise une page Facebook avec un positionnement lisible.",
    icon: Megaphone,
    plan: "Premium",
    outputLabel: "Texte Facebook, Instagram et hashtags",
    visual: true,
    fields: [
      { name: "activity", label: "Activite", placeholder: "Ex. Club de basket amateur", type: "text" },
      { name: "city", label: "Ville", placeholder: "Ex. Lyon", type: "text" },
      {
        name: "services",
        label: "Services",
        placeholder: "Ex. entrainements, stages, matchs, evenements",
        type: "textarea"
      }
    ]
  },
  {
    id: "video-script",
    title: "Script Video",
    description: "Produit un script court avec narration, scene et appel a l'action.",
    icon: Video,
    plan: "Premium",
    outputLabel: "Texte Facebook, Instagram, hashtags et script",
    visual: true,
    fields: [
      { name: "subject", label: "Sujet", placeholder: "Ex. Lancement de la nouvelle saison", type: "text" },
      { name: "duration", label: "Duree", placeholder: "Ex. 45 secondes", type: "text" },
      { name: "targetAudience", label: "Public cible", placeholder: "Ex. supporters, parents, sponsors", type: "text" }
    ]
  },
  {
    id: "noline-quote",
    title: "Devis NOLINE STUDIO",
    description: "Genere un devis clair, premium et structure pour une prestation creative.",
    icon: FileText,
    plan: "Premium",
    outputLabel: "Devis professionnel NOLINE STUDIO",
    visual: false,
    fields: [
      { name: "clientName", label: "Nom du client", placeholder: "Ex. FC Horizon", type: "text" },
      {
        name: "projectType",
        label: "Type de projet",
        placeholder: "Choisir",
        type: "select",
        options: [
          "Community management",
          "Identite visuelle",
          "Creation de contenus",
          "Site web",
          "Campagne sponsor",
          "Pack complet"
        ]
      },
      {
        name: "deliverables",
        label: "Prestations incluses",
        placeholder: "Ex. 12 posts, 4 reels, planning editorial, reporting mensuel",
        type: "textarea"
      },
      { name: "timeline", label: "Delai", placeholder: "Ex. 30 jours", type: "text" },
      { name: "price", label: "Montant estime", placeholder: "Ex. 1 200 EUR HT", type: "text" },
      {
        name: "notes",
        label: "Conditions ou remarques",
        placeholder: "Ex. 50% a la commande, 50% a la livraison",
        type: "textarea"
      }
    ]
  },
  {
    id: "commercial-proposal",
    title: "Proposition commerciale",
    description: "Transforme un besoin client en proposition claire, persuasive et premium.",
    icon: Briefcase,
    plan: "Premium",
    outputLabel: "Proposition commerciale structuree",
    visual: false,
    fields: [
      { name: "clientName", label: "Nom du client", placeholder: "Ex. AS Montreuil", type: "text" },
      {
        name: "clientNeed",
        label: "Besoin du client",
        placeholder: "Ex. Attirer plus de sponsors et professionnaliser la communication",
        type: "textarea"
      },
      {
        name: "solution",
        label: "Solution proposee",
        placeholder: "Ex. Strategie social media, creation de contenus, kit sponsor",
        type: "textarea"
      },
      {
        name: "benefits",
        label: "Benefices attendus",
        placeholder: "Ex. Plus de visibilite, image plus professionnelle, meilleur taux de conversion",
        type: "textarea"
      },
      { name: "offer", label: "Offre ou pack", placeholder: "Ex. Pack Croissance Sponsor", type: "text" },
      { name: "price", label: "Prix", placeholder: "Ex. 1 800 EUR HT", type: "text" },
      {
        name: "nextStep",
        label: "Prochaine etape",
        placeholder: "Ex. Rendez-vous de validation puis lancement sous 7 jours",
        type: "textarea"
      }
    ]
  },
  {
    id: "prospecting-email",
    title: "E-mail de prospection",
    description: "Genere un e-mail court, clair et oriente rendez-vous.",
    icon: MailPlus,
    plan: "Premium",
    outputLabel: "E-mail de prospection pret a envoyer",
    visual: false,
    fields: [
      { name: "targetName", label: "Nom du prospect", placeholder: "Ex. FC Horizon", type: "text" },
      { name: "activity", label: "Activite", placeholder: "Ex. Club de football amateur", type: "text" },
      {
        name: "painPoint",
        label: "Probleme identifie",
        placeholder: "Ex. Manque de visibilite pour attirer des sponsors",
        type: "textarea"
      },
      {
        name: "offer",
        label: "Offre proposee",
        placeholder: "Ex. Audit gratuit de communication et pack contenus",
        type: "textarea"
      },
      { name: "callToAction", label: "Appel a l'action", placeholder: "Ex. 15 minutes cette semaine", type: "text" }
    ]
  },
  {
    id: "editorial-calendar",
    title: "Calendrier editorial",
    description: "Prepare un planning de contenus clair pour les reseaux sociaux.",
    icon: CalendarRange,
    plan: "Premium",
    outputLabel: "Calendrier editorial structure",
    visual: false,
    fields: [
      { name: "structureName", label: "Nom de la structure", placeholder: "Ex. AS Montreuil", type: "text" },
      { name: "period", label: "Periode", placeholder: "Ex. Mars 2026", type: "text" },
      { name: "channels", label: "Reseaux sociaux", placeholder: "Ex. Facebook, Instagram, LinkedIn", type: "text" },
      {
        name: "goals",
        label: "Objectifs",
        placeholder: "Ex. Recruter, informer, vendre des places, valoriser les sponsors",
        type: "textarea"
      },
      {
        name: "keyDates",
        label: "Dates importantes",
        placeholder: "Ex. Match le 12, tournoi le 20, sponsor a annoncer",
        type: "textarea"
      }
    ]
  },
  {
    id: "agent-builder",
    title: "Agent Builder",
    description: "Cree une fiche complete d'agent IA concret, vendable et exploitable.",
    icon: Bot,
    plan: "Premium",
    outputLabel: "Fiche complete d'agent IA",
    visual: false,
    fields: [
      { name: "agentName", label: "Nom de l'agent", placeholder: "Ex. Sponsor Finder AI", type: "text" },
      { name: "clientType", label: "Type de client", placeholder: "Ex. club sportif amateur", type: "text" },
      {
        name: "mission",
        label: "Mission",
        placeholder: "Ex. aider le club a trouver et relancer des sponsors locaux",
        type: "textarea"
      },
      {
        name: "features",
        label: "Fonctionnalites",
        placeholder: "Ex. analyse du besoin, generation d'e-mails, suivi des relances",
        type: "textarea"
      },
      {
        name: "tone",
        label: "Tonalité",
        placeholder: "Choisir une ou plusieurs tonalités",
        type: "multiselect",
        options: [
          "Premium",
          "Directe",
          "Pédagogique",
          "Chaleureuse",
          "Institutionnelle",
          "Commerciale",
          "Sportive",
          "Dynamique",
          "Familiale",
          "Ultra / Supporters",
          "Associative",
          "Créative",
          "Corporate"
        ]
      },
      {
        name: "complexity",
        label: "Niveau de complexite",
        placeholder: "Choisir",
        type: "select",
        options: ["Simple", "Intermediaire", "Avance"]
      },
      {
        name: "businessGoal",
        label: "Objectif commercial",
        placeholder: "Ex. vendre un abonnement mensuel a 99 EUR aux clubs locaux",
        type: "textarea"
      }
    ]
  }
];

export function getGenerator(id: GeneratorId) {
  return generators.find((generator) => generator.id === id);
}
