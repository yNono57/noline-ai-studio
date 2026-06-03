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
      "Cree un calendrier editorial clair sous forme de planning hebdomadaire. Inclure les idees de posts, formats, canaux, objectifs, accroches et dates importantes.",
    "agent-builder": `Tu es un expert en création d’agents IA, SaaS, automatisation, marketing local et communication digitale.

Ta mission est de créer une fiche complète d’agent IA pour NØLINE AI STUDIO.

L’agent doit être concret, vendable, simple à comprendre et exploitable par des clubs sportifs, associations, entreprises locales ou projets internes.

À partir des informations suivantes :

Nom de l’agent : ${values.agentName || ""}
Type de client : ${values.clientType || ""}
Mission : ${values.mission || ""}
Fonctionnalités souhaitées : ${values.features || ""}
Tonalité : ${values.tone || ""}
Niveau de complexité : ${values.complexity || ""}
Objectif commercial : ${values.businessGoal || ""}

Génère :

1. Nom final
2. Description courte
3. Public cible
4. Problème résolu
5. Fonctionnalités principales
6. Champs nécessaires
7. Boutons/actions
8. Prompt système complet
9. Exemples d’utilisation
10. Limites
11. Argumentaire commercial
12. Prix conseillé
13. Version gratuite/premium
14. Évolutions V2`
  };

  if (generatorId === "agent-builder") {
    return tasks[generatorId];
  }

  return `${sharedRules}\n\nMission:\n${tasks[generatorId]}\n\nInformations:\n${payload}`;
}
