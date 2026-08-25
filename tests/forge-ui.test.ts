/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const { buildForgeConversationTimeline, getForgeAgentActivityState, getForgeRuntimeBadge, shouldRenderPendingAgentMission, summarizeForgeDiff } = require("../lib/forge/forge-ui.ts");
export {};

test("Forge UI exposes READY and non-ready runtime states honestly", () => {
  assert.deepEqual(getForgeRuntimeBadge("READY"), { label: "READY", ready: true });
  assert.deepEqual(getForgeRuntimeBadge("EXPIRED"), { label: "EXPIRED", ready: false });
  assert.deepEqual(getForgeRuntimeBadge(null), { label: "NON PROVISIONNÉ", ready: false });
});

test("Forge UI represents active, completed and failed agent activity", () => {
  assert.deepEqual(getForgeAgentActivityState("RUNNING"), { active: true, label: "Forge travaille…" });
  assert.deepEqual(getForgeAgentActivityState("COMPLETED"), { active: false, label: "Mission terminée" });
  assert.equal(getForgeAgentActivityState("FAILED").active, false);
});

test("Forge UI summarizes a bounded git diff without counting headers", () => {
  const summary = summarizeForgeDiff({
    added: ["hello.ts"],
    modified: ["src/app.ts"],
    deleted: [],
    patch: "+++ b/hello.ts\n+hello\n--- a/src/app.ts\n+++ b/src/app.ts\n-old\n+new",
    truncated: false
  });
  assert.deepEqual(summary, { files: 2, additions: 2, deletions: 1 });
});

test("mission USER optimiste est remplacée uniquement par son submissionId persisté", () => {
  const pending = { id: "11111111-1111-4111-8111-111111111111", content: "Crée hello-forge.txt", createdAt: "2026-08-25T00:00:00.000Z" };
  assert.equal(shouldRenderPendingAgentMission([], pending), true);
  assert.equal(shouldRenderPendingAgentMission([{ id: "message-1", conversation_id: "conversation-a", role: "USER", content: pending.content, metadata: { forge_agent_mission: true, forge_agent_submission_id: pending.id }, created_at: "2026-08-24T20:00:00.000Z" }], pending), false);
  assert.equal(shouldRenderPendingAgentMission([{ id: "message-2", conversation_id: "conversation-a", role: "USER", content: pending.content, metadata: { forge_agent_mission: true, forge_agent_submission_id: "22222222-2222-4222-8222-222222222222" }, created_at: pending.createdAt }], pending), true);
});

test("fil projette une soumission une seule fois pendant RUNNING, COMPLETED et refresh", () => {
  const submissionId = "11111111-1111-4111-8111-111111111111", runId = "run-1", content = "Crée hello-forge.txt";
  const user = { id: "user-message-1", conversation_id: "conversation-a", role: "USER", content, metadata: { forge_agent_mission: true, forge_agent_submission_id: submissionId, forge_agent_run_id: runId }, created_at: "2026-08-25T00:00:00.000Z" };
  const assistant = { id: "assistant-message-1", conversation_id: "conversation-a", role: "ASSISTANT", content: "Mission terminée", metadata: { forge_agent_result: true, forge_agent_run_id: runId, reply_to_message_id: user.id }, created_at: "2026-08-25T00:00:03.000Z" };
  const payload = { run: { runId, status: "COMPLETED", createdAt: "2026-08-25T00:00:01.000Z" }, steps: [{ stepId: "step-1", runId }] };
  const pending = { id: submissionId, content, createdAt: "2026-08-25T00:00:00.100Z" };
  for (const timeline of [buildForgeConversationTimeline([user, assistant], [payload], pending, "conversation-a"), buildForgeConversationTimeline([user, assistant, user, assistant], [payload, payload], null, "conversation-a")]) {
    assert.deepEqual(timeline.map((item: { kind: string }) => item.kind), ["message", "agent", "message"]);
    assert.equal(timeline.filter((item: { kind: string; message?: { role: string } }) => item.kind === "message" && item.message?.role === "USER").length, 1);
    assert.equal(timeline.filter((item: { kind: string }) => item.kind === "agent").length, 1);
    assert.equal(timeline.filter((item: { kind: string; message?: { role: string } }) => item.kind === "message" && item.message?.role === "ASSISTANT").length, 1);
  }
});

test("deux soumissions identiques volontaires conservent deux messages, runs et rapports", () => {
  const content = "Crée hello-forge.txt";
  const messages = [1, 2].flatMap((index) => [{ id: `user-${index}`, conversation_id: "conversation-a", role: "USER", content, metadata: { forge_agent_submission_id: `submission-${index}`, forge_agent_run_id: `run-${index}` }, created_at: `2026-08-25T00:00:0${index}.000Z` }, { id: `assistant-${index}`, conversation_id: "conversation-a", role: "ASSISTANT", content: "Mission terminée", metadata: { forge_agent_run_id: `run-${index}`, reply_to_message_id: `user-${index}` }, created_at: `2026-08-25T00:00:0${index + 4}.000Z` }]);
  const runs = [1, 2].map((index) => ({ run: { runId: `run-${index}`, status: "COMPLETED", createdAt: `2026-08-25T00:00:0${index + 2}.000Z` }, steps: [{ stepId: `step-${index}`, runId: `run-${index}` }] }));
  const timeline = buildForgeConversationTimeline(messages, runs, null, "conversation-a");
  assert.equal(timeline.filter((item: { kind: string; message?: { role: string } }) => item.kind === "message" && item.message?.role === "USER").length, 2);
  assert.equal(timeline.filter((item: { kind: string }) => item.kind === "agent").length, 2);
  assert.equal(timeline.filter((item: { kind: string; message?: { role: string } }) => item.kind === "message" && item.message?.role === "ASSISTANT").length, 2);
});
test("soumission Agent possède deux verrous synchrones et un identifiant stable", () => {
  const workspace = require("node:fs").readFileSync("components/ForgeWorkspace.tsx", "utf8");
  const panel = require("node:fs").readFileSync("components/ForgeAgentRunnerPanel.tsx", "utf8");
  const route = require("node:fs").readFileSync("app/api/forge/conversations/[conversationId]/agent-runs/route.ts", "utf8");
  const conversation = require("node:fs").readFileSync("lib/forge/agent-conversation.ts", "utf8");
  assert.match(workspace, /agentSubmissionInFlight\.current/);
  assert.match(panel, /launchInFlight\.current/);
  assert.match(panel, /startForgeAgentRun\(conversationId, value\.trim\(\), submissionId\)/);
  assert.match(conversation, /forge_agent_run_id/);
  assert.match(route, /authenticateForge\(request\)/);
});
test("une coupure du POST long est récupérée seulement si le polling confirme le nouveau run", () => {
  const panel = require("node:fs").readFileSync("components/ForgeAgentRunnerPanel.tsx", "utf8");
  assert.match(panel, /catch \(caught\)[\s\S]*getLatestForgeAgentRun\(conversationId\)/);
  assert.match(panel, /latest\?\.run\.objective === value\.trim\(\)/);
  assert.match(panel, /Date\.parse\(latest\.run\.createdAt\) >= launchStartedAt/);
  assert.match(panel, /if \(!recovered\) setError/);
});
