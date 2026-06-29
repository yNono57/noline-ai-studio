import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOfficialAgent } from "@/lib/official-agents";
import {
  createWorkflow,
  getAgent,
  getUserFromRequest,
  isSupabaseServerConfigured,
  listClientMemory,
  saveAgentGeneration,
  updateWorkflow
} from "@/lib/supabase-server";
import {
  normalizeWorkflow,
  type WorkflowStep
} from "@/lib/workflows";

type WorkflowBody = {
  input?: unknown;
  clientId?: unknown;
};

const STEP_TITLES = [
  "Analyse de la demande",
  "Diagnostic / stratégie",
  "Livrables prêts à utiliser",
  "Plan d’action + prochaine étape"
] as const;

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let workflowId = "";
  let userId = "";
  let currentSteps: WorkflowStep[] = [];

  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });
    }
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    userId = user.id;

    const { id: agentId } = await params;
    const body = (await request.json()) as WorkflowBody;
    const input = typeof body.input === "string" ? body.input.trim() : "";
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!input) return NextResponse.json({ error: "Décris la mission du workflow." }, { status: 400 });

    const official = getOfficialAgent(agentId);
    const custom = official ? null : await getAgent(user.id, agentId);
    if (!official && !custom) {
      return NextResponse.json({ error: "Agent introuvable." }, { status: 404 });
    }

    const agentName = official?.name || readText(custom?.name) || "Agent";
    const systemPrompt =
      official?.systemPrompt ||
      readText(custom?.system_prompt) ||
      readText(custom?.output);
    if (!systemPrompt) {
      return NextResponse.json({ error: "Prompt système de l’agent indisponible." }, { status: 422 });
    }

    const steps: WorkflowStep[] = STEP_TITLES.map((title, index) => ({
      id: `step-${index + 1}`,
      title,
      status: "pending"
    }));
    currentSteps = steps;
    const created = await createWorkflow({
      user_id: user.id,
      agent_id: agentId,
      client_id: clientId || null,
      title: `${agentName} — ${input.slice(0, 70)}`,
      status: "draft",
      steps
    });
    workflowId = readText((created as Record<string, unknown>)?.id);
    if (!workflowId) throw new Error("Workflow insert did not return an id.");

    const memory = clientId
      ? await buildClientMemory(user.id, clientId)
      : "Aucune mémoire client liée.";
    await updateWorkflow(user.id, workflowId, {
      status: "running",
      updated_at: new Date().toISOString()
    });

    const outputs: string[] = [];
    for (let index = 0; index < steps.length; index += 1) {
      steps[index] = { ...steps[index], status: "running" };
      await updateWorkflow(user.id, workflowId, {
        steps,
        updated_at: new Date().toISOString()
      });

      const output = process.env.OPENAI_API_KEY
        ? await runStep({
            systemPrompt,
            title: STEP_TITLES[index],
            input,
            memory,
            previous: outputs.join("\n\n").slice(-8_000)
          })
        : buildDemoStep(STEP_TITLES[index], input);
      outputs.push(output);
      steps[index] = { ...steps[index], status: "completed", output };
      await updateWorkflow(user.id, workflowId, {
        steps,
        updated_at: new Date().toISOString()
      });
    }

    const finalOutput = outputs
      .map((output, index) => `## ${STEP_TITLES[index]}\n\n${output}`)
      .join("\n\n");
    const completed = await updateWorkflow(user.id, workflowId, {
      status: "completed",
      steps,
      result: { output: finalOutput },
      updated_at: new Date().toISOString()
    });
    if (!completed) throw new Error("Completed workflow could not be reloaded.");
    await saveAgentGeneration({
      userId: user.id,
      agentId,
      agentName: `${agentName} — Workflow`,
      userPrompt: input,
      output: finalOutput,
      clientId: clientId || undefined
    });

    return NextResponse.json({
      workflow: normalizeWorkflow(completed as Record<string, unknown>),
      output: finalOutput,
      demo: !process.env.OPENAI_API_KEY
    });
  } catch (error) {
    if (workflowId && userId) {
      const failedSteps = currentSteps.map((step) =>
        step.status === "running" ? { ...step, status: "failed" as const } : step
      );
      await updateWorkflow(userId, workflowId, {
        status: "failed",
        steps: failedSteps,
        result: { error: "Exécution interrompue." },
        updated_at: new Date().toISOString()
      }).catch(() => undefined);
    }
    console.error("[agents/:id/workflow] Workflow execution failed", error);
    return NextResponse.json({ error: "Exécution du workflow impossible." }, { status: 500 });
  }
}

async function runStep({
  systemPrompt,
  title,
  input,
  memory,
  previous
}: {
  systemPrompt: string;
  title: string;
  input: string;
  memory: string;
  previous: string;
}) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\nTu exécutes l’étape "${title}" d’un workflow métier. Réponds en français, de façon concise, concrète et directement exploitable.`
      },
      {
        role: "user",
        content: `Demande:\n${input}\n\nMémoire client:\n${memory}\n\nÉtapes précédentes:\n${previous || "Aucune"}`
      }
    ],
    temperature: 0.5,
    max_tokens: 900
  });
  const output = completion.choices[0]?.message?.content?.trim();
  if (!output) throw new Error(`No output for workflow step ${title}.`);
  return output;
}

async function buildClientMemory(userId: string, clientId: string) {
  try {
    const memory = await listClientMemory(userId, clientId);
    return JSON.stringify(memory).slice(0, 6_000);
  } catch (error) {
    console.warn("[workflow] Client memory unavailable", error);
    return "Mémoire client indisponible.";
  }
}

function buildDemoStep(title: string, input: string) {
  return `${title} préparée en mode démonstration pour : ${input}`;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
