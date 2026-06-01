import type { VisualStyle } from "./visuals";

export type SectorTemplate = {
  id: string;
  name: string;
  sector: string;
  style: VisualStyle;
  primaryColor: string;
  secondaryColor: string;
  kicker: string;
  headline: string;
  subheadline: string;
  footer: string;
};

export const sectorTemplates: SectorTemplate[] = [
  {
    id: "sport-club-impact",
    name: "Impact Sport",
    sector: "Club sportif",
    style: "sportif",
    primaryColor: "#FF6B00",
    secondaryColor: "#FFFFFF",
    kicker: "MATCHDAY",
    headline: "RENDEZ-VOUS AU STADE",
    subheadline: "Match, supporters, energie collective",
    footer: "Un visuel fort pour annoncer, celebrer ou engager."
  },
  {
    id: "association-community",
    name: "Communaute",
    sector: "Association",
    style: "moderne",
    primaryColor: "#2DD4BF",
    secondaryColor: "#FFFFFF",
    kicker: "ASSOCIATION",
    headline: "MOBILISER LA COMMUNAUTE",
    subheadline: "Evenements, adhesion, benevoles",
    footer: "Une communication claire pour rassembler."
  },
  {
    id: "local-commerce-offer",
    name: "Offre Locale",
    sector: "Commerce local",
    style: "premium",
    primaryColor: "#FF6B00",
    secondaryColor: "#FFFFFF",
    kicker: "LOCAL",
    headline: "OFFRE A DECOUVRIR",
    subheadline: "Commerce, proximite, nouveaute",
    footer: "Un post net pour attirer du passage."
  },
  {
    id: "restaurant-menu",
    name: "Menu Signature",
    sector: "Restaurant",
    style: "premium",
    primaryColor: "#D97706",
    secondaryColor: "#FFFFFF",
    kicker: "RESTAURANT",
    headline: "SAVEURS DU MOMENT",
    subheadline: "Menu, reservation, experience",
    footer: "Un rendu appetissant, lisible et premium."
  },
  {
    id: "beauty-clean",
    name: "Beauty Clean",
    sector: "Salon de coiffure / beaute",
    style: "minimaliste",
    primaryColor: "#F472B6",
    secondaryColor: "#FFFFFF",
    kicker: "BEAUTE",
    headline: "NOUVELLE PRESTATION",
    subheadline: "Soin, coiffure, bien-etre",
    footer: "Un template elegant pour valoriser le service."
  },
  {
    id: "event-wedding",
    name: "Evenementiel Chic",
    sector: "Mariage / evenementiel",
    style: "evenementiel",
    primaryColor: "#FACC15",
    secondaryColor: "#FFFFFF",
    kicker: "EVENEMENT",
    headline: "UN MOMENT A MARQUER",
    subheadline: "Mariage, reception, annonce",
    footer: "Un visuel emotionnel, clair et memorisable."
  },
  {
    id: "training-security",
    name: "Formation Securite",
    sector: "Formation / securite",
    style: "moderne",
    primaryColor: "#38BDF8",
    secondaryColor: "#FFFFFF",
    kicker: "FORMATION",
    headline: "MONTER EN COMPETENCE",
    subheadline: "Securite, prevention, certification",
    footer: "Un rendu serieux pour convaincre rapidement."
  }
];

const STORAGE_KEY = "noline-custom-sector-templates";

export function readCustomTemplates(): SectorTemplate[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SectorTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: SectorTemplate) {
  const next = [template, ...readCustomTemplates()];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function allTemplates() {
  return [...sectorTemplates, ...readCustomTemplates()];
}
