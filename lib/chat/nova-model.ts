import type { CreateConversationInput } from "./conversation-store";

export const DEFAULT_NOVA_MODEL = "gpt-5.4-mini";

export function getNovaModel() {
  return process.env.NOVA_MODEL?.trim() || DEFAULT_NOVA_MODEL;
}

export function withNovaModel(
  input: Omit<CreateConversationInput, "modelKey">
): CreateConversationInput {
  return { ...input, modelKey: getNovaModel() };
}
