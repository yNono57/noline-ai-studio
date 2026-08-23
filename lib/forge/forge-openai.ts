import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { AIMessage, GenerationResult } from "@/lib/ai/contracts";
import type { ForgeMessage } from "./forge-store";
import type { ForgeModelProvider } from "./forge-runtime";
import { FORGE_V1_CONTEXT_LIMITS } from "./forge-runtime";

export const FORGE_SYSTEM_PROMPT = `Tu es NØLINE Forge, un ingénieur logiciel généraliste rapide et pragmatique intégré à NØLINE.
Tu aides à comprendre des bases de code, concevoir des architectures, expliquer et générer du code, corriger des bugs et préparer des plans d'implémentation sur plusieurs technologies.
Dans cette version, tu n'as aucun accès direct aux fichiers, au terminal, à GitHub ni à des outils d'exécution. Tu ne prétends jamais avoir lu, modifié ou exécuté un élément qui ne t'a pas été fourni explicitement dans la conversation.`;

export class ForgeGenerationError extends Error { constructor(message = "Forge n’a pas pu répondre pour le moment. Réessayez.") { super(message); this.name = "ForgeGenerationError"; } }
export function getForgeModel() { return process.env.FORGE_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"; }

export const openAIForgeProvider: ForgeModelProvider = {
  key: "openai",
  async generate(input): Promise<GenerationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ForgeGenerationError("Forge n’est pas configuré.");
    const messages: ChatCompletionMessageParam[] = input.messages.map((message) => ({ role: message.role, content: message.content })) as ChatCompletionMessageParam[];
    try {
      const completion = await new OpenAI({ apiKey }).chat.completions.create({ model: input.model, messages });
      const content = completion.choices[0]?.message.content?.trim();
      if (!content) throw new ForgeGenerationError("Forge a retourné une réponse vide.");
      return { message: { role: "assistant", content }, model: input.model, finishReason: completion.choices[0]?.finish_reason || undefined };
    } catch (error) {
      if (error instanceof ForgeGenerationError) throw error;
      console.error("[Forge/OpenAI] generation_failed", { model: input.model, status: (error as { status?: number }).status ?? "unknown", code: (error as { code?: string }).code ?? "unknown", type: (error as { type?: string }).type ?? "unknown" });
      throw new ForgeGenerationError();
    }
  }
};

export async function generateForgeReply(history: ForgeMessage[], provider: ForgeModelProvider = openAIForgeProvider) {
  const model = getForgeModel();
  const messages: AIMessage[] = [
    { role: "system", content: FORGE_SYSTEM_PROMPT },
    ...history.filter((message) => message.role === "USER" || message.role === "ASSISTANT")
      .slice(-FORGE_V1_CONTEXT_LIMITS.maxHistoryMessages)
      .map((message): AIMessage => ({ role: message.role === "USER" ? "user" : "assistant", content: message.content }))
  ];
  const result = await provider.generate({ model, messages });
  return { text: result.message.content, model: result.model };
}