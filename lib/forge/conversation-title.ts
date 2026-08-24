export const DEFAULT_FORGE_CONVERSATION_TITLE = "Nouvelle session";
const MAX_TITLE_LENGTH = 60;

export function deriveForgeConversationTitle(content: string) {
  const value = content.replace(/\s+/g, " ").trim();
  if (!value) return DEFAULT_FORGE_CONVERSATION_TITLE;
  const packageFile = value.match(/\bpackage\.json\b/i)?.[0];
  if (packageFile && /\b(inspecte|inspecter|inspection|analyse|analyser)\b/i.test(value)) return `Inspection ${packageFile.toLowerCase()}`;
  const prefixes: Array<[RegExp, string]> = [
    [/^(corrige|corriger|fixe|répare|réparer)\b/i, "Correction"],
    [/^(crée|créer|ajoute|ajouter|implémente|implémenter)\b/i, "Implémentation"],
    [/^(analyse|analyser|inspecte|inspecter)\b/i, "Analyse"],
    [/^(explique|expliquer)\b/i, "Explication"],
  ];
  let title = value.replace(/[.!?]+$/g, "");
  for (const [pattern, replacement] of prefixes) {
    if (pattern.test(title)) { title = title.replace(pattern, replacement); break; }
  }
  title = title.split(" ").slice(0, 7).join(" ");
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return title.length <= MAX_TITLE_LENGTH ? title : `${title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

export function normalizeForgeConversationTitle(value: unknown) {
  if (typeof value !== "string") throw new Error("Titre de session invalide.");
  const title = value.replace(/\s+/g, " ").trim();
  if (!title || title.length > MAX_TITLE_LENGTH) throw new Error("Le titre doit contenir entre 1 et 60 caractères.");
  return title;
}