import type { GeneratorId } from "./generators";

type SupabaseUser = {
  id: string;
  email?: string;
};

type QuotaState = {
  plan: "free" | "starter" | "pro" | "business";
  limit: number;
  used: number;
  month: string;
};

const planLimits = {
  free: 20,
  starter: 100,
  pro: 100,
  business: Number.MAX_SAFE_INTEGER
} as const;

export function isSupabaseServerConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function getUserFromRequest(request: Request) {
  if (!isSupabaseServerConfigured()) return null;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) return null;
  return (await response.json()) as SupabaseUser;
}

export async function ensureProfile(user: SupabaseUser) {
  await supabaseAdmin("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      id: user.id,
      email: user.email || "",
      updated_at: new Date().toISOString()
    })
  });
}

export async function getQuotaState(userId: string): Promise<QuotaState> {
  const month = new Date().toISOString().slice(0, 7);
  const subscription = await selectFirst<{ plan?: "free" | "starter" | "pro" | "business"; status?: string }>(
    `/rest/v1/subscriptions?user_id=eq.${userId}&select=plan,status&limit=1`
  );
  const profile = await selectFirst<{ plan?: "free" | "starter" | "pro" | "business" }>(
    `/rest/v1/profiles?id=eq.${userId}&select=plan&limit=1`
  );
  const activeStatuses = ["active", "trialing"];
  const plan = activeStatuses.includes(subscription?.status || "")
    ? subscription?.plan || "free"
    : profile?.plan || "free";
  const limit = planLimits[plan] || planLimits.free;
  const quota = await selectFirst<{ generation_count: number }>(
    `/rest/v1/usage_limits?user_id=eq.${userId}&month=eq.${month}&select=generation_count&limit=1`
  );

  if (!quota) {
    await supabaseAdmin("/rest/v1/usage_limits?on_conflict=user_id,month", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: userId,
        month,
        plan: plan === "starter" ? "pro" : plan,
        generation_count: 0,
        limit_count: plan === "business" ? null : limit
      })
    });
  }

  return {
    plan,
    limit,
    used: quota?.generation_count || 0,
    month
  };
}

export async function updateUserPlan(userId: string, plan: "free" | "starter" | "pro" | "business") {
  await supabaseAdmin(`/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      plan,
      updated_at: new Date().toISOString()
    })
  });
}

export async function incrementQuota(userId: string, quota: QuotaState) {
  await supabaseAdmin(
    `/rest/v1/usage_limits?user_id=eq.${userId}&month=eq.${quota.month}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        generation_count: quota.used + 1,
        limit_count: quota.plan === "business" ? null : quota.limit,
        updated_at: new Date().toISOString()
      })
    }
  );
}

export async function saveGeneratedText({
  userId,
  generatorId,
  title,
  values,
  output
}: {
  userId: string;
  generatorId: GeneratorId;
  title: string;
  values: Record<string, string>;
  output: string;
}) {
  try {
    await insertGeneration({
      user_id: userId,
      generator_id: generatorId,
      title,
      values,
      output
    });
  } catch (error) {
    if (!isGenerationSchemaCompatibilityError(error)) throw error;
    await insertGeneration({
      user_id: userId,
      agent_id: generatorId,
      agent_name: title,
      user_prompt: formatGenerationPrompt(values),
      input_values: values,
      result: output
    });
  }
}

export async function saveAgent({
  userId,
  name,
  clientType,
  mission,
  features,
  tone,
  complexity,
  businessGoal,
  output,
  description,
  targetAudience,
  systemPrompt,
  source
}: {
  userId: string;
  name: string;
  clientType: string;
  mission: string;
  features: string;
  tone: string;
  complexity: string;
  businessGoal: string;
  output: string;
  description?: string;
  targetAudience?: string;
  systemPrompt?: string;
  source?: string;
}) {
  const data = await supabaseAdmin("/rest/v1/agents", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      name,
      client_type: clientType,
      mission,
      features,
      tone,
      complexity,
      business_goal: businessGoal,
      output,
      description: description || mission,
      target_audience: targetAudience || clientType,
      system_prompt: systemPrompt || output,
      source: source || "legacy"
    })
  });

  return Array.isArray(data) ? data[0] : data;
}

export async function listAgents(userId: string) {
  return supabaseAdmin(
    `/rest/v1/agents?user_id=eq.${userId}&select=*&order=created_at.desc`,
    { method: "GET" }
  );
}

export async function getAgent(userId: string, id: string) {
  return selectFirst<Record<string, unknown>>(
    `/rest/v1/agents?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`
  );
}

export async function saveAgentGeneration({
  userId,
  agentId,
  agentName,
  userPrompt,
  output,
  clientId
}: {
  userId: string;
  agentId: string;
  agentName: string;
  userPrompt: string;
  output: string;
  clientId?: string;
}) {
  let data: unknown;
  try {
    data = await insertGeneration({
      user_id: userId,
      agent_id: agentId,
      agent_name: agentName,
      user_prompt: userPrompt,
      input_values: { input: userPrompt },
      result: output,
      ...(clientId ? { client_id: clientId } : {})
    });
  } catch (error) {
    if (!isGenerationSchemaCompatibilityError(error)) throw error;
    data = await insertGeneration({
      user_id: userId,
      generator_id: agentId,
      title: agentName,
      values: { input: userPrompt },
      output,
      ...(clientId ? { client_id: clientId } : {})
    });
  }

  return Array.isArray(data) ? data[0] : data;
}

export async function listWorkflows(userId: string) {
  return supabaseAdmin(
    `/rest/v1/workflows?user_id=eq.${encodeURIComponent(userId)}&select=*&order=updated_at.desc`,
    { method: "GET" }
  );
}

export async function getWorkflow(userId: string, id: string) {
  return selectFirst<Record<string, unknown>>(
    `/rest/v1/workflows?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`
  );
}

export async function createWorkflow(payload: Record<string, unknown>) {
  const data = await supabaseAdmin("/rest/v1/workflows", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return Array.isArray(data) ? data[0] : data;
}

export async function updateWorkflow(
  userId: string,
  id: string,
  payload: Record<string, unknown>
) {
  const data = await supabaseAdmin(
    `/rest/v1/workflows?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify(payload) }
  );
  return Array.isArray(data) ? data[0] : data;
}

export async function deleteWorkflow(userId: string, id: string) {
  return supabaseAdmin(
    `/rest/v1/workflows?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

export async function listClientMemory(userId: string, clientId: string) {
  const encodedUser = encodeURIComponent(userId);
  const encodedClient = encodeURIComponent(clientId);
  const [generationResult, workflowResult] = await Promise.allSettled([
    supabaseAdmin(
      `/rest/v1/generations?user_id=eq.${encodedUser}&client_id=eq.${encodedClient}&select=*&order=created_at.desc&limit=3`,
      { method: "GET" }
    ),
    supabaseAdmin(
      `/rest/v1/workflows?user_id=eq.${encodedUser}&client_id=eq.${encodedClient}&select=*&order=updated_at.desc&limit=3`,
      { method: "GET" }
    )
  ]);
  return {
    generations:
      generationResult.status === "fulfilled" ? generationResult.value : [],
    workflows:
      workflowResult.status === "fulfilled" ? workflowResult.value : []
  };
}

export async function getGeneration(userId: string, id: string) {
  return selectFirst<Record<string, unknown>>(
    `/rest/v1/generations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`
  );
}

export async function listGenerations(userId: string, limit = 50) {
  return supabaseAdmin(
    `/rest/v1/generations?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=${limit}`,
    { method: "GET" }
  );
}

export async function deleteGeneration(userId: string, id: string) {
  return supabaseAdmin(
    `/rest/v1/generations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

export async function deleteGenerations(userId: string) {
  return supabaseAdmin(
    `/rest/v1/generations?user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

function insertGeneration(payload: Record<string, unknown>) {
  return supabaseAdmin("/rest/v1/generations", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function isGenerationSchemaCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /PGRST204|23502|schema cache|could not find.*column|column .* does not exist|null value in column/i.test(
    error.message
  );
}

function formatGenerationPrompt(values: Record<string, string>) {
  return (
    Object.entries(values)
      .filter(([, value]) => value?.trim())
      .map(([key, value]) => `${key}: ${value.trim()}`)
      .join("\n") || "Demande générateur"
  );
}

export async function deleteAgent(userId: string, id: string) {
  await supabaseAdmin(`/rest/v1/agents?id=eq.${id}&user_id=eq.${userId}`, {
    method: "DELETE"
  });
}

export async function supabaseAdmin(path: string, init: RequestInit = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase serveur n'est pas configure.");
  }

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Erreur Supabase.");
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function selectFirst<T>(path: string) {
  const data = (await supabaseAdmin(path, { method: "GET" })) as T[] | null;
  return data?.[0] || null;
}
