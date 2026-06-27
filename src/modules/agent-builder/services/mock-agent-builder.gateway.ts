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
    confidence: restaurantIdea ? "high" : "medium"
  };
}

function mockBusinessScore(): BusinessScore {
  return {
    overall: 76,
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
        priority: "high"
      },
      {
        order: 2,
        title: "MVP",
        objective: "Construire et tester le parcours principal.",
        deliverables: ["Prototype fonctionnel", "Jeu de tests métier"],
        estimatedDuration: "2 à 3 semaines",
        priority: "high"
      },
      {
        order: 3,
        title: "Lancement pilote",
        objective: "Mesurer l'usage et la valeur produite.",
        deliverables: ["Pilote utilisateurs", "Rapport de retours et métriques"],
        estimatedDuration: "2 semaines",
        priority: "medium"
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
