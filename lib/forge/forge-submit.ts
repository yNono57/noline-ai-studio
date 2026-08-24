export type ForgeComposerMode = "chat" | "agent";

export function submitForgeComposer<TChat, TAgent>(
  mode: ForgeComposerMode,
  objective: string,
  handlers: { chat(value: string): TChat; agent(value: string): TAgent },
) {
  return mode === "agent" ? handlers.agent(objective) : handlers.chat(objective);
}