import type { AgencyClient } from "./agency";
import type { OfficialAgent } from "./official-agents";

const SUPPORTER_TERMS = [
  "supporter",
  "supporters",
  "fan club",
  "kop",
  "ultra"
];

export function buildOfficialAgentPrompt({
  agent,
  values,
  client
}: {
  agent: OfficialAgent;
  values: Record<string, string>;
  client: AgencyClient | null;
}) {
  const sections = [
    "CONTEXTE CLIENT",
    buildClientContext(client),
    "",
    "DEMANDE",
    formatValues(values),
    "",
    "CONSIGNES D'EXECUTION",
    "- Utilise uniquement les faits fournis.",
    "- Si une information manque, reste neutre ou signale clairement l'élément à compléter.",
    "- Respecte exactement le livrable, le ton et les formats demandés.",
    "- Rédige en français naturel, professionnel et directement exploitable.",
    "- Supprime le blabla, les généralités creuses et les promesses non vérifiables."
  ];

  if (agent.id === "matchday-pro") {
    sections.push("", "RÈGLES MATCHDAY", ...buildMatchdayRules(values, client));
  }

  sections.push("", "Retourne uniquement le livrable final, avec des titres de sections clairs.");
  return sections.join("\n");
}

export function buildClientContext(client: AgencyClient | null) {
  if (!client) return "Aucun client sélectionné.";

  return [
    `Nom du client: ${valueOrNotProvided(client.name)}`,
    `Secteur: ${valueOrNotProvided(client.sector)}`,
    `Rôle: ${valueOrNotProvided(client.role)}`,
    `Structure liée / club associé: ${valueOrNotProvided(client.relatedStructure)}`,
    `Slogan: ${valueOrNotProvided(client.slogan)}`,
    `Couleurs: ${joinProvided([client.primaryColor, client.secondaryColor])}`,
    `Site: ${valueOrNotProvided(client.website)}`,
    `Facebook: ${valueOrNotProvided(client.facebook)}`,
    `Instagram: ${valueOrNotProvided(client.instagram)}`,
    `LinkedIn: ${valueOrNotProvided(client.linkedin)}`,
    `TikTok: ${valueOrNotProvided(client.tiktok)}`,
    `Contexte complémentaire: ${valueOrNotProvided(client.notes)}`
  ].join("\n");
}

export function isSupporterOrganization(client: AgencyClient | null) {
  if (!client) return false;
  const description = `${client.sector} ${client.role} ${client.notes}`.toLocaleLowerCase("fr");
  return SUPPORTER_TERMS.some((term) => description.includes(term));
}

function buildMatchdayRules(values: Record<string, string>, client: AgencyClient | null) {
  const supporterOrganization = isSupporterOrganization(client);
  const playingClub =
    values.club?.trim() ||
    client?.relatedStructure?.trim() ||
    (!supporterOrganization ? client?.name?.trim() : "") ||
    "le club indiqué dans la demande";

  const rules = [
    `- Le club ou l'équipe qui joue est: ${playingClub}.`,
    `- L'adversaire est: ${values.opponent?.trim() || "non renseigné"}.`,
    "- Le sujet du verbe « affronter » doit toujours être le club qui joue, jamais un partenaire, une agence ou un groupe de supporters."
  ];

  if (supporterOrganization && client) {
    rules.push(
      `- ${client.name} est un groupe ou une association de supporters: cette structure ne joue pas le match.`,
      `- Présente ${client.name} comme soutien de ${playingClub}, mobilisant les supporters et poussant l'équipe.`,
      `- Formulation de référence: « ${playingClub} affronte l'adversaire, et ${client.name} appelle tous les supporters à venir pousser l'équipe. »`
    );
  }

  return rules;
}

function formatValues(values: Record<string, string>) {
  const entries = Object.entries(values).filter(([, value]) => value?.trim());
  if (entries.length === 0) return "Aucune variable renseignée.";
  return entries.map(([key, value]) => `${key}: ${value.trim()}`).join("\n");
}

function valueOrNotProvided(value: string | undefined) {
  return value?.trim() || "non renseigné";
}

function joinProvided(values: Array<string | undefined>) {
  const provided = values.map((value) => value?.trim()).filter(Boolean);
  return provided.length > 0 ? provided.join(", ") : "non renseignées";
}
