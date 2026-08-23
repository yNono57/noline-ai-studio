import type {
  Conversation,
  CreateConversationInput,
  CreateProjectInput,
  Message,
  Project
} from "./conversation-store";
import { getAuthenticatedHeaders } from "../supabase-client";

export class NovaClientError extends Error {
  constructor(readonly status: number, message: string, readonly userMessage?: Message) {
    super(message);
    this.name = "NovaClientError";
  }
}

let projectsRequest: Promise<Project[]> | null = null;

export function listProjects() {
  if (!projectsRequest) {
    projectsRequest = request<{ projects: Project[] }>("/api/nova/projects")
      .then((data) => data.projects)
      .finally(() => { projectsRequest = null; });
  }
  return projectsRequest;
}

export async function createProject(input: CreateProjectInput) {
  return (await request<{ project: Project }>("/api/nova/projects", {
    method: "POST",
    body: JSON.stringify(input)
  })).project;
}

export async function listConversations(projectId: string) {
  return (await request<{ conversations: Conversation[] }>(
    `/api/nova/projects/${encodeURIComponent(projectId)}/conversations`
  )).conversations;
}

export async function createConversation(projectId: string, input: CreateConversationInput) {
  return (await request<{ conversation: Conversation }>(
    `/api/nova/projects/${encodeURIComponent(projectId)}/conversations`,
    {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        mode: input.mode,
        agent: input.agent,
        model_key: input.modelKey
      })
    }
  )).conversation;
}

export async function listMessages(conversationId: string) {
  return (await request<{ messages: Message[] }>(
    `/api/nova/conversations/${encodeURIComponent(conversationId)}/messages`
  )).messages;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  userMessageId?: string | null
) {
  return await request<{ user_message: Message; assistant_message: Message }>(
    `/api/nova/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content, ...(userMessageId ? { user_message_id: userMessageId } : {}) })
    }
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let authHeaders = await getAuthenticatedHeaders();
  if (!authHeaders.Authorization) throw sessionExpired();

  const run = (headers: Record<string, string>) => fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
      ...headers
    }
  });

  let response = await run(authHeaders);
  if (response.status === 401) {
    authHeaders = await getAuthenticatedHeaders(true);
    if (!authHeaders.Authorization) throw sessionExpired();
    response = await run(authHeaders);
  }

  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok || !data) {
    if (response.status === 401) throw sessionExpired();
    throw new NovaClientError(
      response.status,
      data?.error || "Impossible de contacter Nova.",
      "user_message" in (data || {}) ? (data as { user_message?: Message }).user_message : undefined
    );
  }
  return data;
}

function sessionExpired() {
  return new NovaClientError(401, "Votre session a expiré. Reconnectez-vous.");
}
