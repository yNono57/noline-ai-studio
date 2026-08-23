export type NovaSafetyDecision = "ALLOW" | "ALLOW_WITH_BOUNDARY" | "REFUSE";
export type NovaProviderMessage = { role: "system" | "user" | "assistant"; content: string };
export type NovaHistoryMessage = { role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL"; content: string };

export const NOVA_SYSTEM_PROMPT = `Tu es NØLINE Nova, l'assistant conversationnel généraliste de NØLINE AI. Tu aides l'utilisateur de manière claire, précise et utile. Tu tiens compte du contexte de la conversation et réponds dans la langue utilisée par l'utilisateur.
Privilégie l'aide concrète aux refus excessifs. Un sujet adulte, controversé, sexualisé ou potentiellement offensant n'est pas interdit en soi lorsqu'il reste légal et concerne des adultes. Les concepts de produits 18+, personnages adultes sexy ou hypersexualisés, romances adultes, gachas et microtransactions doivent être traités normalement. Préserve l'intention autorisée exprimée par l'utilisateur : ne remplace jamais silencieusement une direction artistique sexy ou hypersexualisée par un concept générique.
Quand seule une partie précise franchit une limite, limite uniquement cette partie en une phrase factuelle puis poursuis immédiatement avec le reste. N'ajoute pas de jugement général ni de sermon non demandé.
Ne produis jamais de contenu sexualisant des mineurs. Respecte toujours les garde-fous incompressibles du fournisseur; ne cherche jamais à les contourner, à masquer la demande ou à tromper une modération.`;

const SEXUAL_CONTENT = /(sexy|sexualis(?:e|er|é|ée|és|ées|ation)|sexuel(?:le|s)?|érotique|erotic|nudité|nude)/i;
const MINOR_WORDING = /\b(mineur(?:e|s)?|enfant(?:s)?|préadolescent(?:e|s)?|underage|child(?:ren)?)\b/i;
const EXPLICIT_MINOR_AGE = /\b(?:[0-9]|1[0-7])\s*ans?\b/i;
const MIXED_ALLOWED_WORK = /\b(adulte(?:s)?|gameplay|architecture|monétisation|microtransactions?|concept|personnages? adultes?|boucle de jeu|système de jeu)\b/i;
const MIXED_CONNECTOR = /\b(et|mais|aussi|également|en plus|tout en)\b/i;

export function classifyNovaRequest(prompt: string): NovaSafetyDecision {
  const requestsSexualContent = SEXUAL_CONTENT.test(prompt);
  const concernsMinor = MINOR_WORDING.test(prompt) || EXPLICIT_MINOR_AGE.test(prompt);
  if (!requestsSexualContent || !concernsMinor) return "ALLOW";
  if (MIXED_ALLOWED_WORK.test(prompt) && MIXED_CONNECTOR.test(prompt)) return "ALLOW_WITH_BOUNDARY";
  return "REFUSE";
}

export function buildNovaSafetyInstruction(prompt: string) {
  const decision = classifyNovaRequest(prompt);
  if (decision === "ALLOW") return "Décision NØLINE: ALLOW. Réponds directement et utilement. Préserve explicitement toutes les intentions autorisées de l’utilisateur au lieu de les remplacer par une version générique. Les contenus destinés à des adultes, y compris les personnages adultes sexy ou hypersexualisés, leur direction artistique, leurs archétypes, skins et animations, la romance adulte et la conception de microtransactions, sont autorisés. Si l’âge n’est pas précisé dans un projet manifestement adulte, ne suppose pas que les personnages sont mineurs; cadre simplement le casting comme exclusivement adulte. N’ajoute pas de jugement général, de sermon ni de mise en garde morale non demandée.";
  if (decision === "ALLOW_WITH_BOUNDARY") return "Décision NØLINE: ALLOW_WITH_BOUNDARY. Indique en une phrase factuelle que tu ne peux pas aider à sexualiser un personnage mineur, puis continue immédiatement avec toutes les parties autorisées de la demande. Ne refuse pas l’ensemble.";
  return "Décision NØLINE: REFUSE. Ne produis aucun contenu sexualisant un personnage mineur. Explique cette limite brièvement et factuellement, sans développer le contenu demandé.";
}

export function buildNovaMessages(history: readonly NovaHistoryMessage[]): NovaProviderMessage[] {
  const lastUserPrompt = [...history].reverse().find((message) => message.role === "USER")?.content || "";
  return [
    { role: "system", content: NOVA_SYSTEM_PROMPT },
    { role: "system", content: buildNovaSafetyInstruction(lastUserPrompt) },
    ...history.filter((message) => message.role === "USER" || message.role === "ASSISTANT")
      .slice(-40)
      .map((message): NovaProviderMessage => ({ role: message.role === "USER" ? "user" : "assistant", content: message.content }))
  ];
}