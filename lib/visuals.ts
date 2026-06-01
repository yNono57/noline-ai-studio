import type { GeneratorConfig, GeneratorId } from "./generators";

export type VisualFormat = "square" | "story" | "banner";
export type VisualStyle = "premium" | "sportif" | "moderne" | "minimaliste" | "evenementiel";

export type VisualText = {
  kicker: string;
  headline: string;
  subheadline: string;
  footer: string;
};

export const visualFormats: Record<VisualFormat, { label: string; width: number; height: number }> = {
  square: { label: "Carre 1080x1080", width: 1080, height: 1080 },
  story: { label: "Story 1080x1920", width: 1080, height: 1920 },
  banner: { label: "Banniere Facebook 1640x624", width: 1640, height: 624 }
};

export const visualStyles: VisualStyle[] = [
  "premium",
  "sportif",
  "moderne",
  "minimaliste",
  "evenementiel"
];

export function buildVisualText(
  generator: GeneratorConfig,
  values: Record<string, string>,
  output: string
): VisualText {
  const facebookLine = extractSection(output, "Facebook");

  if (generator.id === "matchday") {
    return {
      kicker: values.competition || "MATCHDAY",
      headline: `${values.clubName || "Votre club"} vs ${values.opponent || "Adversaire"}`,
      subheadline: [values.date, values.time, values.location].filter(Boolean).join(" - "),
      footer: facebookLine || "Rendez-vous pour soutenir l'equipe."
    };
  }

  if (generator.id === "victory") {
    return {
      kicker: "VICTOIRE",
      headline: values.score || "Score final",
      subheadline: `Face a ${values.opponent || "l'adversaire"}`,
      footer: values.keyPlayers || facebookLine || "Une performance collective solide."
    };
  }

  if (generator.id === "player-of-match") {
    return {
      kicker: "HOMME DU MATCH",
      headline: values.playerName || "Nom du joueur",
      subheadline: values.match || "Match",
      footer: values.performance || facebookLine || "Performance remarquable."
    };
  }

  if (generator.id === "sponsor") {
    return {
      kicker: "PARTENAIRE",
      headline: values.sponsorName || "Nom du sponsor",
      subheadline: values.partnershipType || "Partenariat",
      footer: facebookLine || "Merci pour votre confiance et votre soutien."
    };
  }

  if (generator.id === "facebook-description") {
    return {
      kicker: values.city || "FACEBOOK",
      headline: values.activity || "Votre activite",
      subheadline: "Description optimisee",
      footer: values.services || facebookLine || "Services, actualites et temps forts."
    };
  }

  if (generator.id === "video-script") {
    return {
      kicker: "VIDEO",
      headline: values.subject || "Sujet de la video",
      subheadline: `${values.duration || "Duree"} - ${values.targetAudience || "Public cible"}`,
      footer: facebookLine || "Un script clair, rythme et pret a produire."
    };
  }

  return {
    kicker: "NOLINE STUDIO",
    headline: generator.title,
    subheadline: "Template visuel",
    footer: facebookLine || generator.description
  };
}

export function visualFileName(
  generatorId: GeneratorId,
  format: VisualFormat,
  extension: string,
  clientName = ""
) {
  const date = new Date().toISOString().slice(0, 10);
  const client = slugify(clientName || "client");
  return `noline-${client}-${generatorId}-${format}-${date}.${extension}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractSection(output: string, section: string) {
  const lines = output.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim().toLowerCase() === section.toLowerCase());
  if (index === -1) return "";

  const next = lines.slice(index + 1).find((line) => line.trim());
  return next?.trim() || "";
}
