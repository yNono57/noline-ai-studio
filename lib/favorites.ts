export type FavoriteType = "agent" | "generation";

export type FavoriteRecord = {
  id: string;
  type: FavoriteType;
  targetId: string;
  label: string;
  createdAt: string;
};

const STORAGE_KEY = "noline-favorites";

export function readFavorites(): FavoriteRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FavoriteRecord[]) : [];
  } catch {
    return [];
  }
}

export function isFavorite(type: FavoriteType, targetId: string) {
  return readFavorites().some((favorite) => favorite.type === type && favorite.targetId === targetId);
}

export function toggleFavorite(type: FavoriteType, targetId: string, label: string) {
  const current = readFavorites();
  const existing = current.find(
    (favorite) => favorite.type === type && favorite.targetId === targetId
  );
  const next = existing
    ? current.filter((favorite) => favorite.id !== existing.id)
    : [
        {
          id: crypto.randomUUID(),
          type,
          targetId,
          label,
          createdAt: new Date().toISOString()
        },
        ...current
      ];

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("noline:favorites"));
  return next;
}
