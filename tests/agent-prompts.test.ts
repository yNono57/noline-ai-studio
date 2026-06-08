import assert from "node:assert/strict";
import test from "node:test";
import type { AgencyClient } from "../lib/agency";
import { buildOfficialAgentPrompt, isSupporterOrganization } from "../lib/agent-prompts";
import { getOfficialAgent, officialAgents } from "../lib/official-agents";

function createClient(overrides: Partial<AgencyClient>): AgencyClient {
  const now = "2026-06-08T00:00:00.000Z";
  return {
    id: "client-test",
    name: "",
    sector: "",
    logo: "",
    primaryColor: "#FF6B00",
    secondaryColor: "#FFFFFF",
    slogan: "",
    email: "",
    phone: "",
    website: "",
    facebook: "",
    instagram: "",
    linkedin: "",
    tiktok: "",
    relatedStructure: "",
    role: "",
    notes: "",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function promptFor(
  agentId: string,
  values: Record<string, string>,
  client: AgencyClient
) {
  const agent = getOfficialAgent(agentId);
  assert.ok(agent, `Agent ${agentId} introuvable`);
  return buildOfficialAgentPrompt({ agent, values, client });
}

test("les cinq agents officiels restent disponibles", () => {
  assert.deepEqual(
    officialAgents.map((agent) => agent.id),
    [
      "matchday-pro",
      "sponsor-pro",
      "community-manager-pro",
      "commercial-pro",
      "portfolio-builder"
    ]
  );
});

test("Unity Fox est traité comme supporter du SMSHB, pas comme équipe", () => {
  const unityFox = createClient({
    name: "Unity Fox",
    sector: "Association",
    role: "Association de supporters",
    relatedStructure: "SMSHB",
    slogan: "Tous derrière le SMSHB",
    facebook: "facebook.com/unityfox",
    instagram: "@unityfox",
    notes: "Mobilise les supporters lors des matchs à domicile."
  });

  assert.equal(isSupporterOrganization(unityFox), true);
  const prompt = promptFor(
    "matchday-pro",
    {
      club: "SMSHB",
      opponent: "Nancy",
      publicationType: "Avant-match",
      format: "Tous les formats",
      tone: "Émotionnel"
    },
    unityFox
  );

  assert.match(prompt, /Le club ou l'équipe qui joue est: SMSHB/);
  assert.match(prompt, /Unity Fox est un groupe ou une association de supporters/);
  assert.match(prompt, /SMSHB affronte l'adversaire, et Unity Fox appelle/);
  assert.match(prompt, /Structure liée \/ club associé: SMSHB/);
});

test("Formation Sécurité 67 fournit tout son contexte au Community Manager", () => {
  const client = createClient({
    name: "Formation Sécurité 67",
    sector: "Formation / sécurité",
    role: "Organisme de formation",
    slogan: "La prévention par la pratique",
    website: "https://formation-securite-67.fr",
    linkedin: "linkedin.com/company/formation-securite-67",
    notes: "Formations SST et sécurité incendie pour les entreprises."
  });
  const prompt = promptFor(
    "community-manager-pro",
    {
      contentType: "Calendrier éditorial 7 jours",
      activity: "Formation SST et sécurité incendie",
      objective: "Obtenir des demandes de devis",
      platform: "LinkedIn",
      frequency: "3 fois par semaine",
      tone: "Pédagogique"
    },
    client
  );

  assert.match(prompt, /Formation Sécurité 67/);
  assert.match(prompt, /La prévention par la pratique/);
  assert.match(prompt, /Formations SST et sécurité incendie/);
});

test("Marie Toi Ma Fille conserve les faits du projet dans Portfolio Builder", () => {
  const client = createClient({
    name: "Marie Toi Ma Fille",
    sector: "Mariage / événementiel",
    role: "Créatrice d'événements",
    instagram: "@marietoi_mafille",
    notes: "Accompagnement personnalisé pour mariages intimistes."
  });
  const prompt = promptFor(
    "portfolio-builder",
    {
      contentType: "Étude de cas",
      projectName: "Nouvelle présentation commerciale",
      clientName: "Marie Toi Ma Fille",
      initialProblem: "Offre difficile à présenter",
      proposedSolution: "Clarification des services et création d'un portfolio",
      results: "Discours commercial plus lisible",
      services: "Stratégie éditoriale et rédaction",
      tone: "Premium"
    },
    client
  );

  assert.match(prompt, /Offre difficile à présenter/);
  assert.match(prompt, /Discours commercial plus lisible/);
  assert.match(prompt, /@marietoi_mafille/);
});

test("NØLINE STUDIO conserve offre, cible, douleur et prix dans Commercial Pro", () => {
  const client = createClient({
    name: "NØLINE STUDIO",
    sector: "Agence de communication",
    role: "Prestataire",
    slogan: "Créer. Structurer. Accélérer.",
    website: "https://noline.studio"
  });
  const prompt = promptFor(
    "commercial-pro",
    {
      contentType: "Proposition commerciale",
      company: "NØLINE STUDIO",
      offer: "Accompagnement mensuel en communication",
      target: "Entreprises locales",
      customerPain: "Manque de régularité et de temps",
      benefit: "Communication structurée et contenus prêts à publier",
      price: "990 € HT par mois",
      tone: "Premium"
    },
    client
  );

  assert.match(prompt, /Manque de régularité et de temps/);
  assert.match(prompt, /990 € HT par mois/);
  assert.match(prompt, /Créer\. Structurer\. Accélérer\./);
});
