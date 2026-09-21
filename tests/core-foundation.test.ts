import assert from "node:assert/strict";
import test from "node:test";
import {
  agentId, artifactId, artifactType, auditEventId, byteSize, conversationId, fileId, hasCapability,
  instant, isTerminalExecutionState, messageId, money, projectId, provenance, runId, taskId, userId,
  userOwnership, usageEventId, assertTaskAttempts, assertUsageUnits,
  type Artifact, type AuditEvent, type Conversation, type FileAsset, type Message, type Project, type Task, type UsageEvent,
} from "../lib/core";
import { toCoreConversation, toCoreMessage, toCoreProject } from "../lib/chat/core-adapter";
import { toCoreForgeArtifact, toCoreForgeConversation, toCoreForgeMessage, toCoreForgeProject, toCoreForgeRun } from "../lib/forge/core-adapter";

const now = "2026-09-21T10:00:00.000Z";
const owner = userOwnership(userId("user-1"));

test("opaque IDs reject empty values and stay entity-specific at type level", () => {
  assert.throws(() => projectId(" "), /cannot be empty/);
  const project = projectId("project-1");
  const message = messageId("message-1");
  assert.equal(project, "project-1");
  assert.equal(message, "message-1");
  // @ts-expect-error ProjectId must not be assignable to MessageId.
  const invalid: typeof message = project;
  assert.equal(invalid, project);
});

test("ownership, projects, conversations and messages are explicit", () => {
  const project: Project = { id: projectId("p"), ownership: owner, name: "NØLINE", description: null, status: "active", createdAt: instant(now), updatedAt: instant(now) };
  const conversation: Conversation = { id: conversationId("c"), projectId: project.id, ownership: owner, title: "Core", status: "active", participants: [{ kind: "agent", agentId: agentId("nova") }], createdAt: instant(now), updatedAt: instant(now) };
  const message: Message = { id: messageId("m"), conversationId: conversation.id, role: "assistant", content: "Ready", provenance: provenance({ source: "agent", agentId: agentId("nova") }), metadata: null, createdAt: instant(now) };
  assert.equal(project.ownership.kind, "user");
  assert.equal(conversation.projectId, project.id);
  assert.equal(message.provenance.source, "agent");
});

test("provenance preserves agent/run association", () => {
  assert.throws(() => provenance({ source: "agent" }), /agentId/);
  assert.throws(() => provenance({ source: "system", runId: runId("r") }), /agentId/);
  assert.equal(provenance({ source: "tool", tool: "search" }).tool, "search");
});

test("artifacts and files keep ownership, association and safe sizes", () => {
  const artifact: Artifact = { id: artifactId("a"), projectId: projectId("p"), runId: runId("r"), ownership: owner, type: artifactType("document"), name: "Brief", provenance: provenance({ source: "agent", agentId: agentId("muse"), runId: runId("r") }), metadata: {}, createdAt: instant(now) };
  const file: FileAsset = { id: fileId("f"), projectId: artifact.projectId, ownership: owner, name: "brief.pdf", mimeType: "application/pdf", size: byteSize(42), provenance: artifact.provenance, createdAt: instant(now) };
  assert.equal(file.size, 42);
  assert.throws(() => byteSize(-1), /non-negative/);
});

test("run and task lifecycle distinguish terminal and durable states", () => {
  assert.equal(isTerminalExecutionState("COMPLETED"), true);
  assert.equal(isTerminalExecutionState("NEEDS_APPROVAL"), false);
  const task: Task = { id: taskId("t"), projectId: projectId("p"), ownership: owner, agentId: agentId("agent"), runId: null, state: "WAITING", intent: "Wait", createdAt: instant(now), updatedAt: instant(now), availableAt: instant(now), attempt: 1, maxAttempts: 3 };
  assert.doesNotThrow(() => assertTaskAttempts(task));
  assert.throws(() => assertTaskAttempts({ attempt: 4, maxAttempts: 3 }), /maxAttempts/);
});

test("usage uses exact minor units and validates provider-equivalent units", () => {
  const event: UsageEvent = { id: usageEventId("u"), ownership: owner, projectId: projectId("p"), runId: runId("r"), provider: "provider-x", model: "model-y", units: { input: 10, output: 5, total: 15, unit: "tokens" }, estimatedCost: money("eur", BigInt(2)), actualCost: null, occurredAt: instant(now) };
  assert.equal(event.estimatedCost?.minorUnits, BigInt(2));
  assert.doesNotThrow(() => assertUsageUnits(event.units));
  assert.throws(() => assertUsageUnits({ input: -1, unit: "tokens" }), /non-negative/);
});

test("permissions deny unknown capabilities and explicit deny wins", () => {
  assert.equal(hasCapability([{ capability: "project.read", effect: "allow" }], "project.read"), true);
  assert.equal(hasCapability([{ capability: "project.read", effect: "allow" }], "unknown.execute"), false);
  assert.equal(hasCapability([{ capability: "git.write", effect: "allow" }, { capability: "git.write", effect: "deny" }], "git.write"), false);
});

test("audit events answer who, what, agent, tool, resource, result and cost", () => {
  const event: AuditEvent = { id: auditEventId("audit"), actor: { userId: userId("user-1"), ownership: owner }, action: "file.write", agentId: agentId("forge"), runId: runId("run"), tool: "write_file", resource: { type: "file", id: "README.md" }, occurredAt: instant(now), result: { status: "succeeded" }, cost: money("USD", BigInt(1)), metadata: {} };
  assert.deepEqual([event.actor.userId, event.action, event.tool, event.result.status], ["user-1", "file.write", "write_file", "succeeded"]);
});

test("NOVA compatibility mappings preserve production concepts", () => {
  const project = toCoreProject({ id: "p", user_id: "u", name: "Nova", description: null, status: "active", created_at: now, updated_at: now });
  const conversation = toCoreConversation({ id: "c", project_id: "p", mode: "CHAT", agent: "NOVA", title: "Hello", model_key: "model", status: "active", created_at: now, updated_at: now }, "u");
  const message = toCoreMessage({ id: "m", conversation_id: "c", role: "ASSISTANT", content: "Hi", metadata: null, created_at: now });
  assert.equal(project.id, conversation.projectId);
  assert.equal(conversation.primaryAgentId, "nova");
  assert.equal(message.role, "assistant");
});

test("FORGE compatibility mappings preserve projects, runs and artifacts", () => {
  const project = toCoreForgeProject({ id: "fp", user_id: "u", name: "Forge", description: null, repository_provider: "github", repository_identifier: "o/r", default_branch: "main", status: "active", created_at: now, updated_at: now });
  const conversation = toCoreForgeConversation({ id: "fc", forge_project_id: "fp", title: "Build", model_key: "model", status: "active", created_at: now, updated_at: now }, "u");
  const message = toCoreForgeMessage({ id: "fm", conversation_id: "fc", role: "TOOL", content: "done", metadata: {}, created_at: now });
  const forgeRun = { runId: "fr", userId: "u", projectId: "fp", conversationId: "fc", workspaceId: "w", runtimeId: "rt", status: "VALIDATING" as const, objective: "Build", baseCommitSha: "a".repeat(40), plan: [], finalReport: null, createdAt: now, startedAt: now, completedAt: null, lastActivityAt: now, error: null };
  const run = toCoreForgeRun(forgeRun);
  const artifact = toCoreForgeArtifact({ artifactId: "fa", runId: "fr", repository: "o/r", baseCommitSha: "a".repeat(40), sourceBranch: "main", changedFiles: ["README.md"], additions: 1, deletions: 0, patch: "diff", status: "READY", createdAt: now, restoreStatus: "AVAILABLE", publicationStatus: "LOCAL", restoredAt: null, restoredRuntimeId: null, branchName: null, commitSha: null, pullRequestUrl: null, remoteBranch: null, pullRequestNumber: null, pullRequestTarget: null, publishedAt: null, pullRequestCreatedAt: null, conflictFiles: [] }, "fp", "u");
  assert.equal(project.id, conversation.projectId);
  assert.equal(message.provenance.source, "tool");
  assert.equal(run.state, "RUNNING");
  assert.equal(artifact.runId, run.id);
});
