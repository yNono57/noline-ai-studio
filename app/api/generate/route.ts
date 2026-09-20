import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generators, type GeneratorId } from "@/lib/generators";
import { buildPrompt } from "@/lib/prompts";
import { logGenerationError } from "@/lib/server-diagnostics";
import {
  ensureProfile,
  getQuotaState,
  incrementQuota,
  isSupabaseServerConfigured,
  saveGeneratedText
} from "@/lib/supabase-server";
import { PAID_API_LIMITS, protectPaidApi } from "@/lib/paid-api-security";

type GenerateRequest = {
  generatorId: GeneratorId;
  values: Record<string, string>;
};

export async function POST(request: Request) {
  let stage = "parse_request";
  let generatorId: string | null = null;
  let userId: string | null = null;

  try {
    const access = await protectPaidApi(request, "generate", PAID_API_LIMITS.generation);
    if ("response" in access) return access.response;
    userId = access.user.id;

    const body = (await request.json()) as GenerateRequest;
    generatorId = body.generatorId;
    const generator = generators.find((item) => item.id === body.generatorId);

    if (!generator) {
      return NextResponse.json({ error: "Generateur inconnu." }, { status: 400 });
    }

    const supabaseEnabled = isSupabaseServerConfigured();
    stage = "authenticate_user";
    const user = access.user;
    let quotaState: Awaited<ReturnType<typeof getQuotaState>> | null = null;

    if (supabaseEnabled) {
      if (!user) {
        return NextResponse.json(
          { error: "Connectez-vous pour generer du contenu." },
          { status: 401 }
        );
      }

      stage = "ensure_profile";
      await ensureProfile(user);
      stage = "load_usage_limit";
      quotaState = await getQuotaState(user.id);

      if (quotaState.used >= quotaState.limit) {
        return NextResponse.json(
          {
            error: `Quota mensuel atteint (${quotaState.used}/${quotaState.limit}). Passez au plan superieur pour continuer.`
          },
          { status: 429 }
        );
      }
    }

    const missingFields = generator.fields.filter((field) => !body.values?.[field.name]?.trim());

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Champ requis manquant: ${missingFields[0].label}` },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      stage = "build_demo_output";
      const output = fallbackOutput(body.generatorId, body.values);

      if (user && quotaState) {
        stage = "increment_demo_usage";
        await incrementQuota(user.id, quotaState);
        stage = "save_demo_generation";
        await saveGeneratedText({
          userId: user.id,
          generatorId: body.generatorId,
          title: generator.title,
          values: body.values,
          output
        });
      }

      return NextResponse.json({ output, demo: true }, { status: 200 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    stage = "openai_chat_completion";
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu rediges du contenu marketing francophone haut de gamme pour des organisations sportives et professionnelles."
        },
        { role: "user", content: buildPrompt(body.generatorId, body.values) }
      ],
      temperature: 0.8,
      max_tokens: 1000
    });

    const output = completion.choices[0]?.message?.content?.trim();

    if (!output) {
      logGenerationError({
        route: "/api/generate",
        stage: "openai_empty_response",
        error: new Error("OpenAI returned a completion without text content."),
        context: {
          generatorId,
          userId,
          completionId: completion.id,
          model: completion.model,
          finishReason: completion.choices[0]?.finish_reason || null
        }
      });
      return NextResponse.json({ error: "Aucun contenu genere." }, { status: 502 });
    }

    if (user && quotaState) {
      stage = "increment_usage";
      await incrementQuota(user.id, quotaState);
      stage = "save_generation";
      await saveGeneratedText({
        userId: user.id,
        generatorId: body.generatorId,
        title: generator.title,
        values: body.values,
        output
      });
    }

    return NextResponse.json({ output, demo: false });
  } catch (error) {
    logGenerationError({
      route: "/api/generate",
      stage,
      error,
      context: {
        generatorId,
        userId,
        authorizationHeaderPresent: request.headers.has("authorization")
      }
    });

    return NextResponse.json(
      { error: "Impossible de generer le contenu pour le moment." },
      { status: 500 }
    );
  }
}

function fallbackOutput(generatorId: GeneratorId, values: Record<string, string>) {
  const club = values.clubName || "Votre organisation";
  const opponent = values.opponent || "l'adversaire";

  if (generatorId === "matchday") {
    return `Facebook\n${club} donne rendez-vous a ses supporters pour affronter ${opponent}. Coup d'envoi a ${values.time}, ${values.location}. Ensemble, faisons monter l'ambiance.\n\nInstagram\nJour de match. ${club} vs ${opponent}. Rendez-vous ${values.time}.\n\nHashtags\n#Matchday #NolineAIStudio #ClubSportif #GameDay`;
  }

  if (generatorId === "victory") {
    return `Facebook\nVictoire ${values.score} face a ${opponent}. Une performance solide, portee par ${values.keyPlayers}. Merci aux supporters pour leur energie.\n\nInstagram\nVictoire ${values.score}. Travail, collectif, ambition.\n\nHashtags\n#Victoire #TeamSpirit #NolineAIStudio #ClubSportif`;
  }

  if (generatorId === "player-of-match") {
    return `Facebook\nHomme du match: ${values.playerName}. Une prestation marquante lors de ${values.match}, avec ${values.performance}. Bravo pour l'engagement.\n\nInstagram\n${values.playerName}, homme du match. Performance: ${values.performance}.\n\nHashtags\n#HommeDuMatch #MVP #NolineAIStudio #ClubSportif`;
  }

  if (generatorId === "sponsor") {
    return `Facebook\nNous remercions chaleureusement ${values.sponsorName} pour son engagement a nos cotes dans le cadre de ce partenariat ${values.partnershipType}. Son soutien contribue directement au developpement de nos projets.\n\nInstagram\nMerci a ${values.sponsorName} pour sa confiance et son soutien.\n\nHashtags\n#Sponsor #Partenaire #NolineAIStudio #Merci`;
  }

  if (generatorId === "facebook-description") {
    return `Facebook\n${values.activity} base a ${values.city}, nous accompagnons notre communaute avec des services clairs et accessibles: ${values.services}. Suivez notre page pour nos actualites, evenements et temps forts.\n\nInstagram\n${values.activity} a ${values.city}. Actualites, services et temps forts a suivre ici.\n\nHashtags\n#Facebook #Communication #NolineAIStudio #Local`;
  }

  if (generatorId === "video-script") {
    return `Facebook\nNouvelle video: ${values.subject}. Un format pense pour ${values.targetAudience}, clair, rythme et pret a diffuser.\n\nInstagram\n${values.subject}. Format ${values.duration}. Pour ${values.targetAudience}.\n\nHashtags\n#Video #ContentMarketing #NolineAIStudio #Storytelling\n\nScript\nAccroche: ouvrez avec une phrase forte sur ${values.subject}.\nNarration: presentez le contexte, montrez les moments forts, puis adressez-vous directement a ${values.targetAudience}.\nPlan final: logo, message clair et appel a l'action.`;
  }

  if (generatorId === "noline-quote") {
    return `DEVIS NOLINE STUDIO\n\nClient\n${values.clientName}\n\nObjet\nPrestation ${values.projectType} pour accompagner la visibilite et la communication du client.\n\nPrestations incluses\n${values.deliverables}\n\nPlanning\nDelai estime: ${values.timeline}\n\nMontant\n${values.price}\n\nConditions\n${values.notes}\n\nProchaine etape\nValidation du devis, confirmation du calendrier, puis lancement de la production.\n\nNOLINE STUDIO`;
  }

  if (generatorId === "commercial-proposal") {
    return `PROPOSITION COMMERCIALE\n\nClient\n${values.clientName}\n\nContexte\n${values.clientName} souhaite repondre au besoin suivant: ${values.clientNeed}\n\nSolution proposee\n${values.solution}\n\nBenefices attendus\n${values.benefits}\n\nOffre\n${values.offer}\n\nInvestissement\n${values.price}\n\nDeroulement\nCadrage, validation de la direction creative, production, ajustements, puis livraison finale.\n\nProchaine etape\n${values.nextStep}\n\nConclusion\nNOLINE STUDIO accompagne votre projet avec une approche claire, premium et orientee resultats.`;
  }

  if (generatorId === "prospecting-email") {
    return `Objet\nUne idee simple pour developper la visibilite de ${values.targetName}\n\nE-mail\nBonjour,\n\nJ'ai remarque que ${values.targetName} pouvait gagner en impact sur sa communication, notamment autour de: ${values.painPoint}.\n\nChez NOLINE STUDIO, nous aidons les structures comme ${values.activity} a produire des contenus plus professionnels et plus reguliers. Je peux vous proposer: ${values.offer}.\n\nSeriez-vous disponible pour ${values.callToAction} ?\n\nBien a vous,\nNOLINE STUDIO\n\nRelance courte\nBonjour, je me permets de revenir vers vous concernant mon message. Un court echange pourrait vous donner des pistes concretes pour ameliorer votre visibilite.`;
  }

  if (generatorId === "agent-builder") {
    return `1. Nom final\n${values.agentName || "Agent IA NOLINE"}\n\n2. Description courte\nUn agent IA concu pour aider ${values.clientType || "une structure locale"} a executer une mission concrete: ${values.mission || "automatiser une tache a forte valeur"}.\n\n3. Public cible\n${values.clientType || "Clubs sportifs, associations, entreprises locales et equipes internes"}.\n\n4. Probleme resolu\nL'agent reduit le temps passe sur les actions repetitives et transforme un besoin flou en process clair, simple a utiliser et vendable.\n\n5. Fonctionnalites principales\n${values.features || "- Qualification du besoin\n- Generation de contenus\n- Recommandations actionnables\n- Suivi des prochaines etapes"}\n\n6. Champs necessaires\nNom de la structure, objectif, contexte, ton souhaite, contraintes, delai et canal de sortie.\n\n7. Boutons/actions\nCreer une recommandation, generer un message, copier le prompt, preparer une relance, exporter la fiche.\n\n8. Prompt systeme complet\nTu es ${values.agentName || "un agent IA NOLINE"} pour ${values.clientType || "des structures locales"}. Ta mission est de ${values.mission || "produire des recommandations claires et actionnables"}. Tu reponds avec une tonalite ${values.tone || "professionnelle"} et un niveau ${values.complexity || "simple"}. Tu restes concret, concis et oriente resultat commercial.\n\n9. Exemples d'utilisation\n- Preparer une action commerciale locale\n- Structurer une campagne de communication\n- Produire un livrable client pret a presenter\n\n10. Limites\nL'agent ne remplace pas la validation humaine, ne garantit pas les resultats commerciaux et doit etre alimente avec des informations fiables.\n\n11. Argumentaire commercial\nUn outil simple pour professionnaliser les methodes, gagner du temps et transformer les idees en actions concretes sans recruter de ressource supplementaire.\n\n12. Prix conseille\n${values.businessGoal ? `Prix aligne sur l'objectif: ${values.businessGoal}` : "Entre 49 EUR et 199 EUR par mois selon le niveau d'automatisation."}\n\n13. Version gratuite/premium\nGratuit: generation d'une fiche simple. Premium: prompts avances, exports, historique, modeles sectoriels et personnalisation marque.\n\n14. Evolutions V2\nConnexion CRM, scoring automatique, bibliotheque de templates, tableaux de bord et workflows multi-agents.`;
  }

  return `CALENDRIER EDITORIAL\n\nStructure\n${values.structureName}\n\nPeriode\n${values.period}\n\nCanaux\n${values.channels}\n\nObjectifs\n${values.goals}\n\nSemaine 1\nPost annonce, contenu coulisses, rappel evenement.\n\nSemaine 2\nPost valeur, mise en avant sponsor, reel dynamique.\n\nSemaine 3\nStory interactive, portrait membre, actualite cle.\n\nSemaine 4\nBilan, appel a l'action, preparation du mois suivant.\n\nDates importantes\n${values.keyDates}`;
}
