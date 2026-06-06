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
  const next = [record, ...readHistory()].slice(0, 30);
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
