/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const { getForgeAgentActivityState, getForgeRuntimeBadge, shouldRenderPendingAgentMission, summarizeForgeDiff } = require("../lib/forge/forge-ui.ts");
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

test("mission USER optimiste disparaît dès que son message persisté est présent", () => {
  const pending = { content: "Crée hello-forge.txt", createdAt: "2026-08-25T00:00:00.000Z" };
  assert.equal(shouldRenderPendingAgentMission([], pending), true);
  assert.equal(shouldRenderPendingAgentMission([{ id: "message-1", conversation_id: "conversation-a", role: "USER", content: pending.content, metadata: { forge_agent_mission: true }, created_at: "2026-08-25T00:00:00.000Z" }], pending), false);
  assert.equal(shouldRenderPendingAgentMission([{ id: "message-2", conversation_id: "conversation-a", role: "USER", content: pending.content, metadata: {}, created_at: "2026-08-25T00:00:00.000Z" }], pending), true);
  assert.equal(shouldRenderPendingAgentMission([{ id: "message-old", conversation_id: "conversation-a", role: "USER", content: pending.content, metadata: { forge_agent_mission: true }, created_at: "2026-08-24T20:00:00.000Z" }], pending), true);
});
