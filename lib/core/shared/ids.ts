export type OpaqueId<Name extends string> = string & { readonly __opaqueId: Name };

export type UserId = OpaqueId<"UserId">;
export type OrganizationId = OpaqueId<"OrganizationId">;
export type AgentId = OpaqueId<"AgentId">;
export type ProjectId = OpaqueId<"ProjectId">;
export type ConversationId = OpaqueId<"ConversationId">;
export type MessageId = OpaqueId<"MessageId">;
export type ArtifactId = OpaqueId<"ArtifactId">;
export type RunId = OpaqueId<"RunId">;
export type TaskId = OpaqueId<"TaskId">;
export type FileId = OpaqueId<"FileId">;
export type AuditEventId = OpaqueId<"AuditEventId">;
export type UsageEventId = OpaqueId<"UsageEventId">;

function opaqueId<Name extends string>(value: string, label: Name): OpaqueId<Name> {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} cannot be empty.`);
  return normalized as OpaqueId<Name>;
}

export const userId = (value: string) => opaqueId(value, "UserId");
export const organizationId = (value: string) => opaqueId(value, "OrganizationId");
export const agentId = (value: string) => opaqueId(value, "AgentId");
export const projectId = (value: string) => opaqueId(value, "ProjectId");
export const conversationId = (value: string) => opaqueId(value, "ConversationId");
export const messageId = (value: string) => opaqueId(value, "MessageId");
export const artifactId = (value: string) => opaqueId(value, "ArtifactId");
export const runId = (value: string) => opaqueId(value, "RunId");
export const taskId = (value: string) => opaqueId(value, "TaskId");
export const fileId = (value: string) => opaqueId(value, "FileId");
export const auditEventId = (value: string) => opaqueId(value, "AuditEventId");
export const usageEventId = (value: string) => opaqueId(value, "UsageEventId");
