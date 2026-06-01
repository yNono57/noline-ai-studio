import type { GeneratorId } from "./generators";

export function buildPrompt(generatorId: GeneratorId, values: Record<string, string>) {
  const payload = Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const sharedRules = [
    "Tu es un expert francophone en marketing digital pour clubs sportifs, associations et entreprises.",
    "Le style doit etre premium, clair, dynamique et professionnel.",
    "N'invente pas de donnees factuelles non fournies.",
    "Retourne uniquement le contenu final, structure avec des titres courts."
  ].join("\n");

  const visualPostRule =
    "Structure obligatoirement avec les sections: Facebook, Instagram, Hashtags. Les hashtags doivent tenir sur une seule ligne.";

  const tasks: Record<GeneratorId, string> = {
    matchday: `Cree un post Matchday pret a publier. ${visualPostRule}`,
    victory: `Cree un post de victoire pret a publier. ${visualPostRule}`,
    "player-of-match": `Cree un post Homme du match pret a publier. ${visualPostRule}`,
    sponsor: `Cree un message sponsor professionnel pret a publier. ${visualPostRule}`,
    "facebook-description": `Cree une description Facebook optimisee et une version de post d'annonce. ${visualPostRule}`,
    "video-script":
      "Cree un script video complet avec accroche, narration, indications de plans, texte a l'ecran et appel a l'action. Ajoute aussi les sections Facebook, Instagram et Hashtags.",
    "noline-quote":
      "Cree un devis professionnel NOLINE STUDIO. Structure la reponse avec: objet du devis, contexte client, prestations incluses, planning, montant, conditions, prochaine etape et formule de signature. Le ton doit etre premium, clair et commercial.",
    "commercial-proposal":
      "Cree une proposition commerciale professionnelle et persuasive. Structure la reponse avec: titre, contexte client, enjeux, solution proposee, benefices attendus, offre, investissement, deroulement, prochaine etape et formule de conclusion. Le ton doit etre premium, direct et oriente conversion.",
    "prospecting-email":
      "Cree un e-mail de prospection court et professionnel. Structure avec: Objet, E-mail, Relance courte. Le ton doit etre humain, direct, premium, et viser un rendez-vous.",
    "editorial-calendar":
      "Cree un calendrier editorial clair sous forme de planning hebdomadaire. Inclure les idees de posts, formats, canaux, objectifs, accroches et dates importantes."
  };

  return `${sharedRules}\n\nMission:\n${tasks[generatorId]}\n\nInformations:\n${payload}`;
}
