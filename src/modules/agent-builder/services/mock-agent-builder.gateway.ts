import type { AgentBuilderGateway, AgentBuilderRequest } from "./agent-builder.service";
import type {
  AgentRoadmap,
  AIImplementationPlan,
  BrandingPack,
  BusinessScore,
  CompetitorAnalysis,
  DevelopmentPlan,
  ExecutiveSummary,
  FinancialForecast,
  GeneratedAgent,
  IdeaAnalysis,
  LegalCompliance,
  MarketingStrategy,
  PricingStrategy,
  ProductBacklog,
  ProductRecommendation,
  PromptPack,
  SalesPack,
  SEOStrategy,
  TechnicalDiagrams,
  UXStrategy
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
      case "generate_ux_strategy":
        return asResult<TResult>(mockUXStrategy());
      case "generate_pricing_strategy":
        return asResult<TResult>(mockPricingStrategy());
      case "generate_marketing_strategy":
        return asResult<TResult>(mockMarketingStrategy());
      case "generate_development_plan":
        return asResult<TResult>(mockDevelopmentPlan());
      case "generate_ai_implementation_plan":
        return asResult<TResult>(mockAIImplementationPlan());
      case "generate_executive_summary":
        return asResult<TResult>(mockExecutiveSummary());
      case "generate_financial_forecast":
        return asResult<TResult>(mockFinancialForecast());
      case "generate_competitor_analysis":
        return asResult<TResult>(mockCompetitorAnalysis());
      case "generate_legal_compliance":
        return asResult<TResult>(mockLegalCompliance());
      case "generate_sales_pack":
        return asResult<TResult>(mockSalesPack());
      case "generate_branding_pack":
        return asResult<TResult>(mockBrandingPack());
      case "generate_seo_strategy":
        return asResult<TResult>(mockSEOStrategy());
      case "generate_product_backlog":
        return asResult<TResult>(mockProductBacklog());
      case "generate_technical_diagrams":
        return asResult<TResult>(mockTechnicalDiagrams());
      case "generate_prompt_pack":
        return asResult<TResult>(mockPromptPack());
    }
  }
}

function mockExecutiveSummary(): ExecutiveSummary {
  return {
    score: 84,
    summary: "Un produit IA vertical qui transforme un besoin métier en livrable contrôlable.",
    vision: "Devenir le copilote opérationnel de référence du segment.",
    opportunity: "Monétiser un gain de temps récurrent avec une offre spécialisée.",
    keyFindings: ["Besoin identifiable", "MVP réalisable", "Différenciation à prouver"],
    priorities: ["Valider la cible", "Mesurer le temps gagné", "Signer des pilotes"],
    nextSteps: ["Interroger cinq prospects", "Tester le workflow principal"]
  };
}

function mockFinancialForecast(): FinancialForecast {
  return {
    score: 70,
    summary: "Projection indicative fondée sur une montée progressive des abonnements.",
    assumptions: ["Prix moyen de 129 € HT", "Acquisition progressive", "Churn à mesurer"],
    scenarios: ["Année 1", "Année 2", "Année 3"].map((year, index) => ({
      year,
      conservativeRevenue: `${15 + index * 25} k€`,
      targetRevenue: `${30 + index * 55} k€`,
      ambitiousRevenue: `${60 + index * 100} k€`
    })),
    costDrivers: ["API IA", "Développement", "Acquisition", "Support"],
    breakEvenHypothesis: "À estimer après validation du coût d'acquisition et de la marge réelle.",
    keyMetrics: ["MRR", "Marge brute", "CAC", "LTV", "Churn"],
    disclaimer: "Hypothèses indicatives, à valider avec un professionnel financier."
  };
}

function mockCompetitorAnalysis(): CompetitorAnalysis {
  return {
    score: 76,
    summary: "La concurrence combine assistants généralistes et logiciels métier.",
    marketPosition: "Spécialiste vertical centré sur des livrables immédiatement exploitables.",
    competitors: [
      {
        name: "Assistants IA généralistes",
        positioning: "Productivité polyvalente",
        strengths: ["Notoriété", "Large couverture"],
        weaknesses: ["Peu de contexte métier", "Configuration nécessaire"]
      }
    ],
    differentiationOpportunities: ["Workflows propriétaires", "Preuves de ROI", "Intégrations ciblées"],
    monitoringActions: ["Comparer les prix chaque trimestre", "Suivre les nouvelles fonctions"]
  };
}

function mockLegalCompliance(): LegalCompliance {
  return {
    score: 68,
    summary: "Le projet doit cadrer données personnelles, transparence IA et responsabilité.",
    riskLevel: "medium",
    obligations: ["Information des utilisateurs", "Base légale des traitements", "Gestion des droits"],
    keyRisks: ["Données sensibles dans les prompts", "Sorties erronées utilisées sans validation"],
    requiredActions: ["Cartographier les données", "Définir une politique de conservation", "Valider les CGU"],
    disclaimer: "Cette synthèse ne remplace pas un avis juridique adapté au pays et au cas d'usage."
  };
}

function mockSalesPack(): SalesPack {
  return {
    score: 82,
    summary: "Un discours commercial centré sur le résultat et la preuve de valeur.",
    elevatorPitch: "Transformez vos tâches répétitives en livrables prêts à valider en quelques minutes.",
    valuePropositions: ["Temps économisé", "Méthode homogène", "Expertise disponible à la demande"],
    discoveryQuestions: ["Quelle tâche ralentit le plus votre équipe ?", "Comment mesurez-vous sa qualité ?"],
    objectionHandling: [
      { objection: "L'IA fait des erreurs.", response: "Chaque sortie reste contrôlable et validée humainement." }
    ],
    closingSequence: ["Démonstration", "Pilote sur un cas", "Bilan chiffré", "Abonnement"]
  };
}

function mockBrandingPack(): BrandingPack {
  return {
    score: 80,
    summary: "Une marque experte, accessible et orientée action.",
    brandPositioning: "Le copilote métier qui transforme l'IA en résultat concret.",
    personality: ["Pragmatique", "Rassurante", "Experte"],
    nameIdeas: ["Noline Copilot", "AgentFlow", "Métier AI"],
    taglines: ["Votre expertise, accélérée.", "De l'idée au résultat."],
    visualDirection: ["Contraste premium", "Signalétique claire", "Accent énergique"],
    voiceGuidelines: ["Phrases courtes", "Preuves avant promesses", "Jargon limité"]
  };
}

function mockSEOStrategy(): SEOStrategy {
  return {
    score: 72,
    summary: "Une stratégie longue traîne centrée sur les problèmes métier.",
    keywords: [
      { keyword: "agent IA métier", intent: "Solution", priority: "high" },
      { keyword: "automatiser tâche métier", intent: "Information", priority: "medium" }
    ],
    contentPillars: ["Cas d'usage", "Automatisation", "ROI"],
    priorityPages: ["Page secteur", "Page cas d'usage", "Comparatif"],
    technicalActions: ["Métadonnées", "Données structurées", "Performance"],
    keyMetrics: ["Impressions", "Positions", "Conversions organiques"]
  };
}

function mockProductBacklog(): ProductBacklog {
  return {
    score: 85,
    summary: "Un backlog priorisé autour de l'activation et de la valeur mesurable.",
    epics: [
      {
        name: "Premier résultat",
        goal: "Activer un utilisateur en moins de dix minutes.",
        priority: "high",
        stories: ["Créer un brief guidé", "Prévisualiser la sortie", "Corriger avant validation"]
      }
    ],
    definitionOfDone: ["Testé", "Accessible", "Mesuré", "Documenté"],
    releaseCriteria: ["Aucun blocage critique", "Parcours principal validé"]
  };
}

function mockTechnicalDiagrams(): TechnicalDiagrams {
  return {
    score: 86,
    summary: "Une architecture modulaire séparant interface, orchestration, IA et données.",
    architectureDiagram: "flowchart LR\nUI[Interface] --> API[API]\nAPI --> AI[OpenAI]\nAPI --> DB[(Supabase)]",
    dataFlowDiagram: "sequenceDiagram\nUser->>API: Brief\nAPI->>AI: Prompt structuré\nAI-->>API: JSON\nAPI-->>User: Résultat",
    components: ["Interface Next.js", "Service Agent Builder", "Gateway OpenAI", "Supabase"],
    implementationNotes: ["Valider les schémas", "Journaliser sans données sensibles"]
  };
}

function mockPromptPack(): PromptPack {
  return {
    score: 88,
    summary: "Un pack initial couvrant qualification, production et contrôle qualité.",
    prompts: [
      {
        name: "Qualification du besoin",
        purpose: "Transformer un brief flou en demande exploitable.",
        systemPrompt: "Tu es un consultant métier. Clarifie sans inventer.",
        userTemplate: "Objectif: {{objective}}\nContexte: {{context}}",
        variables: ["objective", "context"]
      }
    ],
    usageGuidelines: ["Versionner les prompts", "Limiter le contexte", "Valider les sorties"],
    evaluationCriteria: ["Exactitude", "Utilité", "Conformité au format"]
  };
}

function mockUXStrategy(): UXStrategy {
  return {
    score: 84,
    summary: "Une expérience guidée centrée sur un premier résultat rapide et vérifiable.",
    designPrinciples: ["Une action principale par écran", "Transparence sur le rôle de l'IA"],
    primaryJourney: [
      {
        name: "Premier livrable",
        userGoal: "Obtenir un résultat utile sans configuration complexe.",
        interaction: "Brief guidé, aperçu puis validation.",
        friction: "Manque de contexte dans la demande initiale.",
        successSignal: "Premier livrable validé en moins de dix minutes."
      }
    ],
    onboarding: ["Choisir un objectif", "Importer un exemple", "Générer puis corriger"],
    keyScreens: ["Accueil orienté action", "Atelier de génération", "Historique"],
    accessibility: ["Navigation clavier", "Contrastes AA", "Libellés explicites"],
    retentionMechanisms: ["Modèles favoris", "Historique réutilisable", "Bilan de valeur"]
  };
}

function mockPricingStrategy(): PricingStrategy {
  return {
    score: 79,
    summary: "Un abonnement par niveau d'usage, complété par des services d'activation.",
    recommendedModel: "Abonnement SaaS avec trois niveaux et options de service.",
    valueMetric: "Nombre de workflows ou livrables validés par mois.",
    tiers: [
      {
        name: "Essentiel",
        target: "Indépendants",
        monthlyPrice: "49 € HT",
        annualPrice: "490 € HT",
        features: ["Générations essentielles", "Historique limité"],
        limits: ["Un utilisateur", "Volume mensuel plafonné"]
      },
      {
        name: "Pro",
        target: "Petites équipes",
        monthlyPrice: "129 € HT",
        annualPrice: "1 290 € HT",
        features: ["Workflows premium", "Personnalisation"],
        limits: ["Cinq utilisateurs"]
      },
      {
        name: "Business",
        target: "Réseaux et agences",
        monthlyPrice: "Sur devis",
        annualPrice: "Sur devis",
        features: ["Multi-entités", "Connecteurs", "Support prioritaire"],
        limits: ["Cadre d'usage contractuel"]
      }
    ],
    trialStrategy: "Pilote de 14 jours centré sur un cas d'usage mesurable.",
    upsells: ["Configuration", "Formation", "Connecteurs métier"],
    validationTests: ["Test de disposition à payer", "Pilote accompagné"],
    keyMetrics: ["Conversion essai", "Revenu moyen", "Rétention à 90 jours"]
  };
}

function mockMarketingStrategy(): MarketingStrategy {
  return {
    score: 81,
    summary: "Une acquisition fondée sur la preuve métier et des démonstrations ciblées.",
    positioning: "Le copilote IA spécialisé qui livre un résultat exploitable, pas seulement du texte.",
    corePromise: "Transformer une tâche récurrente en livrable validable en quelques minutes.",
    channels: [
      {
        channel: "LinkedIn",
        objective: "Créer la demande",
        audience: "Décideurs de petites équipes",
        message: "Montrez le temps économisé sur un cas réel.",
        actions: ["Publier des avant/après", "Diffuser des démonstrations courtes"]
      }
    ],
    launchPlan: ["Recruter dix pilotes", "Publier trois études de cas", "Lancer un webinar"],
    contentPillars: ["Cas d'usage", "Preuves de valeur", "Méthodes métier"],
    acquisitionFunnel: ["Contenu", "Démonstration", "Pilote", "Abonnement"],
    keyMetrics: ["Demandes de démo", "Activation pilote", "Conversion payante"]
  };
}

function mockDevelopmentPlan(): DevelopmentPlan {
  return {
    score: 86,
    summary: "Un développement incrémental qui sécurise d'abord le workflow principal.",
    architecture: "Application modulaire avec API serveur, contrats typés et fournisseur IA interchangeable.",
    stackRecommendations: ["Next.js", "TypeScript", "Supabase", "OpenAI Structured Outputs"],
    phases: [
      {
        order: 1,
        name: "Socle MVP",
        objective: "Livrer le parcours critique.",
        duration: "2 semaines",
        difficulty: "medium",
        deliverables: ["Workflow principal", "Journalisation"],
        acceptanceCriteria: ["Parcours testable de bout en bout", "Erreurs maîtrisées"]
      }
    ],
    dependencies: ["Accès API", "Jeux de tests métier"],
    technicalRisks: ["Latence IA", "Évolution des contrats"],
    qualityGates: ["Lint et build", "Tests de schéma", "Revue sécurité"]
  };
}

function mockAIImplementationPlan(): AIImplementationPlan {
  return {
    score: 83,
    summary: "Une architecture IA évaluée, observable et indépendante du fournisseur.",
    modelStrategy: "Modèle économique par défaut, avec routage vers un modèle supérieur si nécessaire.",
    promptArchitecture: ["Prompt système versionné", "Contexte métier", "Sortie structurée"],
    dataRequirements: ["Exemples validés", "Règles métier", "Cas limites"],
    retrievalStrategy: "Ajouter un RAG uniquement si des connaissances privées et évolutives sont requises.",
    guardrails: ["Validation de schéma", "Refus explicites", "Limites de taille"],
    evaluationPlan: ["Jeu d'évaluation métier", "Score de fidélité", "Tests de non-régression"],
    observability: ["Latence", "Coût", "Erreurs", "Qualité utilisateur"],
    costOptimization: ["Réduire le contexte", "Mettre en cache les données stables", "Router par complexité"]
  };
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
