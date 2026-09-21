import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("components/DashboardOverview.tsx", "utf8");
const nova = fs.readFileSync("components/NovaWorkspace.tsx", "utf8");
const forge = fs.readFileSync("components/ForgeWorkspace.tsx", "utf8");

test("dashboard exposes direct Nova and Forge product entry points", () => {
  assert.match(dashboard, /href="\/nova" label="Ouvrir Nova"/);
  assert.match(dashboard, /href="\/forge" label="Ouvrir Forge"/);
  assert.match(dashboard, /reprendre vos conversations/);
  assert.match(dashboard, /sandbox contrôlé/);
});

test("Nova authentication failure offers an immediate login action", () => {
  assert.match(nova, /authBlocked \? <Link href="\/login"/);
  assert.match(nova, />Se connecter<\/Link>/);
  assert.match(nova, /role="alert"/);
});

test("Forge authentication failure offers an immediate login action", () => {
  assert.match(forge, /authBlocked \? <Link href="\/login"/);
  assert.match(forge, />Se connecter<\/Link>/);
  assert.match(forge, /role="alert"/);
});

test("Phase 1U usability changes do not alter Nova or Forge execution paths", () => {
  assert.match(nova, /sendMessage\(conversationId/);
  assert.match(forge, /forgeAgentRunner|agentLaunchRequest/);
  assert.match(forge, /ForgeWorkspaceControl/);
});
