import { coreSupabase, type CoreIdentity } from "./core-supabase";

export type ConversationMode = "CHAT" | "CODE";
export type ConversationStatus = "active" | "archived";
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  project_id: string;
  mode: ConversationMode;
  agent: string;
  title: string;
  model_key: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  status?: ConversationStatus;
};

export type CreateConversationInput = {
  mode: ConversationMode;
  agent: string;
  title: string;
  modelKey: string;
  status?: ConversationStatus;
};

export type CreateMessageInput = {
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown> | null;
};

export type ConversationStoreErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "SUPABASE_ERROR";

export class ConversationStoreError extends Error {
  constructor(
    readonly code: ConversationStoreErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ConversationStoreError";
  }
}

export async function listProjects(user: CoreIdentity): Promise<Project[]> {
  requireUser(user);
  return selectMany<Project>(user,
    `/rest/v1/projects?user_id=eq.${encode(user.id)}&select=*&order=updated_at.desc`
  );
}

export async function getProject(user: CoreIdentity, projectId: string): Promise<Project> {
  requireUser(user);
  requireId(projectId, "projectId");

  const project = await selectOne<Project>(user,
    `/rest/v1/projects?id=eq.${encode(projectId)}&user_id=eq.${encode(user.id)}&select=*&limit=1`
  );

  if (!project) {
    throw notFound("Projet");
  }

  return project;
}

export async function createProject(
  user: CoreIdentity,
  input: CreateProjectInput
): Promise<Project> {
  requireUser(user);
  requireNonEmpty(input.name, "name");
  requireEnum(input.status ?? "active", ["active", "archived"], "status");
  if (input.description != null && typeof input.description !== "string") {
    throw new ConversationStoreError("INVALID_INPUT", "description invalide.");
  }

  return insertOne<Project>(user, "/rest/v1/projects", {
    user_id: user.id,
    name: input.name.trim(),
    description: input.description ?? null,
    status: input.status ?? "active"
  });
}

export async function setProjectStatus(user: CoreIdentity, projectId: string, status: ConversationStatus): Promise<Project> {
  requireEnum(status, ["active", "archived"], "status");
  await getProject(user, projectId);
  return updateOne<Project>(user, `/rest/v1/projects?id=eq.${encode(projectId)}&user_id=eq.${encode(user.id)}`, { status });
}

export async function deleteProject(user: CoreIdentity, projectId: string): Promise<void> {
  await getProject(user, projectId);
  await deleteOwned(user, `/rest/v1/projects?id=eq.${encode(projectId)}&user_id=eq.${encode(user.id)}`);
}

export async function listConversations(
  user: CoreIdentity,
  projectId: string
): Promise<Conversation[]> {
  await getProject(user, projectId);
  return selectMany<Conversation>(user,
    `/rest/v1/conversations?project_id=eq.${encode(projectId)}&select=*&order=updated_at.desc`
  );
}

export async function getConversation(
  user: CoreIdentity,
  conversationId: string
): Promise<Conversation> {
  requireUser(user);
  requireId(conversationId, "conversationId");

  const conversation = await selectOne<Conversation>(user,
    `/rest/v1/conversations?id=eq.${encode(conversationId)}&select=*&limit=1`
  );

  if (!conversation) {
    throw notFound("Conversation");
  }

  await getProject(user, conversation.project_id);
  return conversation;
}

export async function createConversation(
  user: CoreIdentity,
  projectId: string,
  input: CreateConversationInput
): Promise<Conversation> {
  await getProject(user, projectId);
  requireEnum(input.mode, ["CHAT", "CODE"], "mode");
  requireEnum(input.status ?? "active", ["active", "archived"], "status");
  requireNonEmpty(input.agent, "agent");
  requireNonEmpty(input.title, "title");
  requireNonEmpty(input.modelKey, "modelKey");

  return insertOne<Conversation>(user, "/rest/v1/conversations", {
    project_id: projectId,
    mode: input.mode,
    agent: input.agent.trim(),
    title: input.title.trim(),
    model_key: input.modelKey.trim(),
    status: input.status ?? "active"
  });
}

export async function setConversationStatus(user: CoreIdentity, conversationId: string, status: ConversationStatus): Promise<Conversation> {
  requireEnum(status, ["active", "archived"], "status");
  await getConversation(user, conversationId);
  return updateOne<Conversation>(user, `/rest/v1/conversations?id=eq.${encode(conversationId)}`, { status });
}

export async function deleteConversation(user: CoreIdentity, conversationId: string): Promise<void> {
  await getConversation(user, conversationId);
  await deleteOwned(user, `/rest/v1/conversations?id=eq.${encode(conversationId)}`);
}

export async function listMessages(
  user: CoreIdentity,
  conversationId: string
): Promise<Message[]> {
  await getConversation(user, conversationId);
  return selectMany<Message>(user,
    `/rest/v1/messages?conversation_id=eq.${encode(conversationId)}&select=*&order=created_at.asc,id.asc`
  );
}

export async function createMessage(
  user: CoreIdentity,
  conversationId: string,
  input: CreateMessageInput
): Promise<Message> {
  await getConversation(user, conversationId);

  requireEnum(input.role, ["USER", "ASSISTANT", "SYSTEM", "TOOL"], "role");
  if (typeof input.content !== "string" || (input.metadata != null && (typeof input.metadata !== "object" || Array.isArray(input.metadata)))) {
    throw new ConversationStoreError("INVALID_INPUT", "Message invalide.");
  }
  return insertOne<Message>(user, "/rest/v1/messages", {
    conversation_id: conversationId,
    role: input.role,
    content: input.content,
    metadata: input.metadata ?? null
  });
}

function requireUser(user: CoreIdentity) {
  if (!user || typeof user.id !== "string" || !isUuid(user.id) || typeof user.accessToken !== "string" || !user.accessToken.trim()) {
    throw new ConversationStoreError("UNAUTHENTICATED", "Authentification requise.");
  }
}

function requireId(value: string, field: string) {
  if (typeof value !== "string" || !isUuid(value)) {
    throw new ConversationStoreError("INVALID_INPUT", `${field} est requis.`);
  }
}

function requireNonEmpty(value: string, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ConversationStoreError("INVALID_INPUT", `${field} ne peut pas être vide.`);
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function requireEnum(value: unknown, allowed: readonly string[], field: string) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ConversationStoreError("INVALID_INPUT", field + " invalide.");
  }
}

function notFound(resource: string) {
  return new ConversationStoreError(
    "NOT_FOUND",
    `${resource} introuvable ou inaccessible.`
  );
}

function encode(value: string) {
  return encodeURIComponent(value);
}

async function selectMany<T>(user: CoreIdentity, path: string): Promise<T[]> {
  try {
    const data = await coreSupabase(user, path, { method: "GET" });
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (error) {
    throw supabaseError(error);
  }
}

async function selectOne<T>(user: CoreIdentity, path: string): Promise<T | null> {
  const rows = await selectMany<T>(user, path);
  return rows[0] ?? null;
}

async function insertOne<T>(user: CoreIdentity, path: string, body: Record<string, unknown>): Promise<T> {
  try {
    const data = await coreSupabase(user, path, {
      method: "POST",
      body: JSON.stringify(body)
    });
    const row = Array.isArray(data) ? (data[0] as T | undefined) : undefined;

    if (!row) {
      throw new Error("Supabase n'a retourné aucune ressource créée.");
    }

    return row;
  } catch (error) {
    if (error instanceof ConversationStoreError) throw error;
    throw supabaseError(error);
  }
}

async function updateOne<T>(user: CoreIdentity, path: string, body: Record<string, unknown>): Promise<T> {
  try {
    const data = await coreSupabase(user, path, { method: "PATCH", body: JSON.stringify(body) });
    const row = Array.isArray(data) ? (data[0] as T | undefined) : undefined;
    if (!row) throw notFound("Ressource");
    return row;
  } catch (error) {
    throw supabaseError(error);
  }
}

async function deleteOwned(user: CoreIdentity, path: string): Promise<void> {
  try {
    await coreSupabase(user, path, { method: "DELETE" });
  } catch (error) {
    throw supabaseError(error);
  }
}

function supabaseError(error: unknown) {
  if (error instanceof ConversationStoreError) return error;
  return new ConversationStoreError(
    "SUPABASE_ERROR",
    "L'opération Supabase a échoué.",
    { cause: error }
  );
}
