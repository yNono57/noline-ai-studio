"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { isFavorite, toggleFavorite, type FavoriteType } from "@/lib/favorites";

export function FavoriteButton({
  type,
  targetId,
  label,
  compact = false
}: {
  type: FavoriteType;
  targetId: string;
  label: string;
  compact?: boolean;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => setActive(isFavorite(type, targetId)), [targetId, type]);

  function toggle() {
    const next = toggleFavorite(type, targetId, label);
    setActive(next.some((favorite) => favorite.type === type && favorite.targetId === targetId));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-black transition ${
        active
          ? "border-noline-orange bg-noline-orange/15 text-noline-orange"
          : "border-white/10 text-white hover:border-noline-orange hover:text-noline-orange"
      }`}
    >
      <Heart className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
      {compact ? null : active ? "Favori" : "Favori"}
    </button>
  );
}
