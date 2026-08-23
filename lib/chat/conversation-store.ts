import { supabaseAdmin } from "../supabase-server";

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

export async function listProjects(userId: string): Promise<Project[]> {
  requireUserId(userId);
  return selectMany<Project>(
    `/rest/v1/projects?user_id=eq.${encode(userId)}&select=*&order=updated_at.desc`
  );
}

export async function getProject(userId: string, projectId: string): Promise<Project> {
  requireUserId(userId);
  requireId(projectId, "projectId");

  const project = await selectOne<Project>(
    `/rest/v1/projects?id=eq.${encode(projectId)}&user_id=eq.${encode(userId)}&select=*&limit=1`
  );

  if (!project) {
    throw notFound("Projet");
  }

  return project;
}

export async function createProject(
  userId: string,
  input: CreateProjectInput
): Promise<Project> {
  requireUserId(userId);
  requireNonEmpty(input.name, "name");

  return insertOne<Project>("/rest/v1/projects", {
    user_id: userId,
    name: input.name.trim(),
    description: input.description ?? null,
    status: input.status ?? "active"
  });
}

export async function listConversations(
  userId: string,
  projectId: string
): Promise<Conversation[]> {
  await getProject(userId, projectId);
  return selectMany<Conversation>(
    `/rest/v1/conversations?project_id=eq.${encode(projectId)}&select=*&order=updated_at.desc`
  );
}

export async function getConversation(
  userId: string,
  conversationId: string
): Promise<Conversation> {
  requireUserId(userId);
  requireId(conversationId, "conversationId");

  const conversation = await selectOne<Conversation>(
    `/rest/v1/conversations?id=eq.${encode(conversationId)}&select=*&limit=1`
  );

  if (!conversation) {
    throw notFound("Conversation");
  }

  await getProject(userId, conversation.project_id);
  return conversation;
}

export async function createConversation(
  userId: string,
  projectId: string,
  input: CreateConversationInput
): Promise<Conversation> {
  await getProject(userId, projectId);
  requireNonEmpty(input.agent, "agent");
  requireNonEmpty(input.title, "title");
  requireNonEmpty(input.modelKey, "modelKey");

  return insertOne<Conversation>("/rest/v1/conversations", {
    project_id: projectId,
    mode: input.mode,
    agent: input.agent.trim(),
    title: input.title.trim(),
    model_key: input.modelKey.trim(),
    status: input.status ?? "active"
  });
}

export async function listMessages(
  userId: string,
  conversationId: string
): Promise<Message[]> {
  await getConversation(userId, conversationId);
  return selectMany<Message>(
    `/rest/v1/messages?conversation_id=eq.${encode(conversationId)}&select=*&order=created_at.asc,id.asc`
  );
}

export async function createMessage(
  userId: string,
  conversationId: string,
  input: CreateMessageInput
): Promise<Message> {
  await getConversation(userId, conversationId);

  return insertOne<Message>("/rest/v1/messages", {
    conversation_id: conversationId,
    role: input.role,
    content: input.content,
    metadata: input.metadata ?? null
  });
}

function requireUserId(userId: string) {
  if (!userId?.trim()) {
    throw new ConversationStoreError("UNAUTHENTICATED", "Authentification requise.");
  }
}

function requireId(value: string, field: string) {
  if (!value?.trim()) {
    throw new ConversationStoreError("INVALID_INPUT", `${field} est requis.`);
  }
}

function requireNonEmpty(value: string, field: string) {
  if (!value?.trim()) {
    throw new ConversationStoreError("INVALID_INPUT", `${field} ne peut pas être vide.`);
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

async function selectMany<T>(path: string): Promise<T[]> {
  try {
    const data = await supabaseAdmin(path, { method: "GET" });
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (error) {
    throw supabaseError(error);
  }
}

async function selectOne<T>(path: string): Promise<T | null> {
  const rows = await selectMany<T>(path);
  return rows[0] ?? null;
}

async function insertOne<T>(path: string, body: Record<string, unknown>): Promise<T> {
  try {
    const data = await supabaseAdmin(path, {
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

function supabaseError(error: unknown) {
  if (error instanceof ConversationStoreError) return error;
  return new ConversationStoreError(
    "SUPABASE_ERROR",
    "L'opération Supabase a échoué.",
    { cause: error }
  );
}
