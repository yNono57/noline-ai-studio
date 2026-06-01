import type { VisualFormat } from "./visuals";

export type VisualRecord = {
  id: string;
  title: string;
  format: VisualFormat;
  width: number;
  height: number;
  svg: string;
  createdAt: string;
};

const STORAGE_KEY = "noline-visual-history";

export function readVisualHistory(): VisualRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VisualRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveVisualRecord(record: VisualRecord) {
  const next = [record, ...readVisualHistory()].slice(0, 30);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
