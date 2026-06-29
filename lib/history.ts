import type { GeneratorId } from "./generators";

export type GenerationRecord = {
  id: string;
  generatorId: GeneratorId | string;
  title: string;
  createdAt: string;
  values: Record<string, string>;
  output: string;
  clientId?: string;
  clientName?: string;
  userPrompt?: string;
};

const STORAGE_KEY = "noline-generation-history";

export function readHistory(): GenerationRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GenerationRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveRecord(record: GenerationRecord) {
  const next = [
    record,
    ...readHistory().filter((item) => item.id !== record.id)
  ].slice(0, 30);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearHistory() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function deleteHistoryRecord(id: string) {
  const next = readHistory().filter((record) => record.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function normalizeGenerationRecord(
  item: Record<string, unknown>
): GenerationRecord {
  const values = normalizeValues(item.input_values || item.values);
  const generatorId =
    textValue(item.agent_id) ||
    textValue(item.generator_id) ||
    textValue(item.generatorId) ||
    "unknown";
  const createdAt =
    textValue(item.created_at) ||
    textValue(item.createdAt) ||
    new Date().toISOString();

  return {
    id: textValue(item.id) || `${generatorId}-${createdAt}`,
    generatorId,
    title: textValue(item.agent_name) || textValue(item.title) || "Agent",
    createdAt,
    values,
    output:
      textValue(item.result) ||
      textValue(item.output) ||
      "Contenu indisponible pour cette génération.",
    userPrompt:
      textValue(item.user_prompt) ||
      textValue(item.userPrompt) ||
      values.input ||
      values.prompt ||
      undefined,
    clientId: textValue(item.client_id) || undefined,
    clientName: textValue(item.client_name) || undefined
  };
}

export function mergeGenerationRecords(
  ...collections: GenerationRecord[][]
): GenerationRecord[] {
  return Array.from(
    new Map(collections.flat().map((record) => [record.id, record])).values()
  ).sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

function normalizeValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      typeof item === "string" ? item : JSON.stringify(item)
    ])
  );
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
