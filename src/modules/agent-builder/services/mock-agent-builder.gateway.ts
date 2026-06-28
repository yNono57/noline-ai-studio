import type { AgentBuilderGateway, AgentBuilderRequest } from "./agent-builder.service";
import type {
  AgentRoadmap,
  BusinessScore,
  GeneratedAgent,
  IdeaAnalysis,
  ProductRecommendation
} from "../types";

export class MockAgentBuilderGateway implements AgentBuilderGateway {
  async generate<TResult>(request: AgentBuilderRequest): Promise<TResult> {
    const input = readInput(request.userPrompt);

    switch (request.task) {
      case "analyze_idea":
        return asResult<TResult>(mockAnalysis(readIdea(input)));
      case "generate_business_score":
        return asResult<TResult>(mockBusinessScore());
      case "generate_agent":
        return asResult<TResult>(mockAgent(readAnalysis(input)));
      case "generate_roadmap":
        return asResult<TResult>(mockRoadmap());
      case "generate_recommendations":
        return asResult<TResult>(mockRecommendations());
    }
  }
}

function mockAnalysis(idea: string): IdeaAnalysis {
  const restaurantIdea = /\b(restaurants?|restauration|restaurateurs?)\b/i.test(idea);

  return {
    originalIdea: idea,
    summary: restaurantIdea
      ? "Un agent IA qui aide les restaurants dans leurs opérations et leur communication."
      : "Un agent IA spécialisé qui transforme un besoin métier en actions concrètes.",
    sector: restaurantIdea ? "Restauration" : "Secteur à préciser",
    targetAudience: restaurantIdea
      ? "Restaurants indépendants et petites chaînes"
      : "Professionnels concernés par l'idée",
    problem: "Les équipes manquent de temps et de méthode pour exécuter certaines tâches récurrentes.",
    need: "Un assistant simple qui structure les demandes et produit des livrables immédiatement utilisables.",
    valueProposition: "Réduire le temps de préparation tout en améliorant la régularité et la qualité.",
    assumptions: [
      "La cible utilise déjà des outils numériques.",
      "Une validation humaine restera nécessaire avant publication."
    ],
    confidence: restaurantIdea ? "high" : "medium",
    marketAssessment: {
      score: 78,
      marketSize: "Marché large mais fragmenté, à quantifier avec des données sectorielles locales.",
      maturity: "Maturité numérique intermédiaire avec une adoption croissante des outils SaaS.",
      competition: "Concurrence active entre logiciels spécialisés et assistants IA généralistes.",
      difficulty: "Difficulté moyenne : intégrations, confiance et simplicité d'usage seront déterminantes.",
      saasPotential: {
        score: 84,
        rationale: "Besoin récurrent et fonctionnalités standardisables par abonnement."
      },
      agencyPotential: {
        score: 76,
        rationale: "Accompagnement et personnalisation peuvent soutenir une offre premium."
      },
      licensingPotential: {
        score: 68,
        rationale: "La licence devient crédible après validation des workflows propriétaires."
      }
    }
  };
}

function mockBusinessScore(): BusinessScore {
  return {
    overall: 76,
    market: {
      score: 88,
      rationale: "La cible est nombreuse et le besoin de productivité est durable."
    },
    profitability: {
      score: 79,
      rationale: "Les coûts marginaux sont faibles après stabilisation du produit."
    },
    originality: {
      score: 71,
      rationale: "La différenciation viendra surtout de la spécialisation et des données métier."
    },
    easeOfSale: {
      score: 72,
      rationale: "La démonstration est simple, mais le retour sur investissement doit être prouvé."
    },
    scalability: {
      score: 86,
      rationale: "Le socle peut être répliqué avec des modèles et intégrations sectoriels."
    },
    marketNeed: {
      score: 82,
      rationale: "Le manque de temps et de ressources spécialisées est un besoin fréquent."
    },
    targetClarity: {
      score: 78,
      rationale: "La cible est identifiable, mais ses sous-segments devront être priorisés."
    },
    differentiation: {
      score: 64,
      rationale: "La spécialisation métier devra être visible dans les workflows et les modèles."
    },
    feasibility: {
      score: 84,
      rationale: "Une première version peut être construite avec des entrées et sorties structurées."
    },
    monetizationPotential: {
      score: 72,
      rationale: "Un abonnement est crédible si le gain de temps est démontré."
    },
    strengths: ["Besoin concret", "MVP rapide à tester", "Valeur facilement démontrable"],
    risks: ["Positionnement trop large", "Résultats dépendants de la qualité des informations"],
    nextValidationStep: "Interroger cinq utilisateurs cibles et tester trois cas d'usage prioritaires."
  };
}

function mockAgent(analysis: IdeaAnalysis | null): GeneratedAgent {
  const sector = analysis?.sector || "Secteur à préciser";
  const targetAudience = analysis?.targetAudience || "Professionnels ciblés";

  return {
    name: sector === "Restauration" ? "Restaurant Copilot" : "Business Copilot",
    description: "Un copilote IA spécialisé qui transforme un brief court en actions prêtes à valider.",
    sector,
    targetAudience,
    mission: "Faire gagner du temps sur les tâches récurrentes et guider les prochaines actions.",
    features: [
      "Qualification guidée du besoin",
      "Génération de livrables structurés",
      "Recommandations et prochaines étapes"
    ],
    tone: ["professionnel", "clair", "pragmatique"],
    complexity: "intermediate",
    businessGoal: "Créer un service récurrent à forte valeur perçue.",
    systemPrompt: `Tu es un copilote spécialisé dans le secteur ${sector}. Tu aides ${targetAudience} avec des réponses concrètes, fiables et directement actionnables.`,
    suggestedInputs: ["Objectif", "Contexte", "Contraintes", "Délai", "Format attendu"],
    expectedOutput: "Un livrable structuré accompagné d'actions prioritaires."
    ,
    premiumFeatures: [
      "Bibliothèque de workflows métier",
      "Historique et personnalisation par établissement",
      "Tableau de bord de performance"
    ],
    v2Features: ["Intégrations CRM et agenda", "Automatisations multicanales"],
    futureFeatures: ["Analyse prédictive", "Orchestration de plusieurs agents spécialisés"],
    differentiation: [
      "Spécialisation sectorielle",
      "Livrables directement exploitables",
      "Parcours guidé sans expertise technique"
    ],
    personas: [
      {
        name: "Responsable opérationnel",
        role: "Décideur et utilisateur principal",
        context: "Petite équipe avec peu de temps disponible.",
        painPoints: ["Tâches répétitives", "Outils dispersés"],
        expectedOutcome: "Gagner du temps sans complexifier les opérations."
      }
    ],
    customerObjections: [
      {
        objection: "Un outil supplémentaire sera trop complexe.",
        response: "Le parcours guidé se concentre sur quelques tâches à forte valeur."
      }
    ],
    salesArguments: [
      "Réduction mesurable du temps de préparation",
      "Expertise métier disponible à la demande"
    ],
    pricing: {
      recommendedPrice: "99 € à 199 € HT par mois",
      subscription: "Abonnement mensuel avec essai ou pilote encadré",
      upsell: ["Configuration personnalisée", "Connecteurs métier", "Formation d'équipe"],
      rationale: "Tarification à valider selon le temps économisé et le segment ciblé."
    }
  };
}

function mockRoadmap(): AgentRoadmap {
  return {
    objective: "Valider puis lancer une première version utile de l'agent.",
    phases: [
      {
        order: 1,
        title: "Validation du besoin",
        objective: "Confirmer les cas d'usage prioritaires.",
        deliverables: ["Entretiens utilisateurs", "Liste des trois cas d'usage principaux"],
        estimatedDuration: "1 semaine",
        priority: "high",
        stage: "MVP",
        difficulty: "low"
      },
      {
        order: 2,
        title: "MVP",
        objective: "Construire et tester le parcours principal.",
        deliverables: ["Prototype fonctionnel", "Jeu de tests métier"],
        estimatedDuration: "2 à 3 semaines",
        priority: "high",
        stage: "V1",
        difficulty: "medium"
      },
      {
        order: 3,
        title: "Lancement pilote",
        objective: "Mesurer l'usage et la valeur produite.",
        deliverables: ["Pilote utilisateurs", "Rapport de retours et métriques"],
        estimatedDuration: "2 semaines",
        priority: "medium",
        stage: "V2",
        difficulty: "medium"
      },
      {
        order: 4,
        title: "Industrialisation",
        objective: "Étendre les intégrations et préparer le passage à l'échelle.",
        deliverables: ["Connecteurs avancés", "Catalogue d'agents complémentaires"],
        estimatedDuration: "4 à 8 semaines",
        priority: "low",
        stage: "V3",
        difficulty: "high"
      }
    ],
    successMetrics: ["Temps économisé par tâche", "Taux de livrables validés", "Usage hebdomadaire"],
    dependencies: ["Accès à des utilisateurs pilotes", "Exemples de livrables de référence"]
  };
}

function mockRecommendations(): ProductRecommendation[] {
  return [
    {
      title: "Commencer par un cas d'usage unique",
      category: "positioning",
      rationale: "Une promesse précise facilite l'adoption et la mesure de la valeur.",
      expectedImpact: "Amélioration de la compréhension et du taux d'activation.",
      effort: "low",
      priority: "high",
      actionItems: ["Choisir la tâche la plus fréquente", "Définir un résultat mesurable"]
    },
    {
      title: "Créer une offre pilote",
      category: "validation",
      rationale: "Un pilote permet de confronter rapidement les hypothèses au terrain.",
      expectedImpact: "Retours qualitatifs et premiers signaux de disposition à payer.",
      effort: "medium",
      priority: "high",
      actionItems: ["Recruter cinq testeurs", "Organiser un bilan après deux semaines"]
    },
    {
      title: "Risque d'un positionnement trop générique",
      category: "risk",
      rationale: "Une promesse large réduit la perception d'expertise.",
      expectedImpact: "Clarifier la proposition de valeur et raccourcir le cycle de vente.",
      effort: "low",
      priority: "high",
      actionItems: ["Choisir un segment initial", "Formuler une promesse mesurable"]
    },
    {
      title: "Opportunité de distribution via des partenaires",
      category: "opportunity",
      rationale: "Les agences et intégrateurs possèdent déjà la relation avec la cible.",
      expectedImpact: "Accélérer l'acquisition avec un coût commercial plus faible.",
      effort: "medium",
      priority: "medium",
      actionItems: ["Identifier dix partenaires", "Préparer une offre de licence"]
    },
    {
      title: "Cartographier les concurrents spécialisés",
      category: "competitor",
      rationale: "Comparer les workflows métier permet d'éviter une différenciation superficielle.",
      expectedImpact: "Renforcer le positionnement et prioriser les fonctions distinctives.",
      effort: "low",
      priority: "high",
      actionItems: ["Analyser cinq solutions", "Comparer prix, cible et promesse"]
    },
    {
      title: "Ajouter une boucle d'apprentissage",
      category: "improvement",
      rationale: "Les retours utilisateur doivent améliorer les recommandations dans le temps.",
      expectedImpact: "Augmenter la qualité perçue et la rétention.",
      effort: "medium",
      priority: "medium",
      actionItems: ["Collecter une note après chaque livrable", "Analyser les corrections"]
    },
    {
      title: "Vendre un agent commercial complémentaire",
      category: "complementary_agent",
      rationale: "Les données produites peuvent alimenter la prospection et les relances.",
      expectedImpact: "Créer un upsell naturel et augmenter le revenu par client.",
      effort: "medium",
      priority: "medium",
      actionItems: ["Définir le workflow commercial", "Tester un bundle de deux agents"]
    }
  ];
}

function readInput(userPrompt: string): Record<string, unknown> {
  const payload: unknown = JSON.parse(userPrompt);
  if (!isRecord(payload) || !isRecord(payload.input)) return {};
  return payload.input;
}

function readIdea(input: Record<string, unknown>): string {
  return typeof input.idea === "string" ? input.idea : "Idée non précisée";
}

function readAnalysis(input: Record<string, unknown>): IdeaAnalysis | null {
  return isRecord(input.analysis) ? (input.analysis as unknown as IdeaAnalysis) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asResult<TResult>(value: unknown): TResult {
  return value as TResult;
}
