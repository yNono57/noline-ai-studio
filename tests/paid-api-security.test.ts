import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const paidRoutes = [
  "app/api/generate-agent/route.ts",
  "app/api/agent-builder-v2/route.ts",
  "app/api/agents/[id]/run/route.ts",
  "app/api/agents/[id]/workflow/route.ts",
  "app/api/generate/route.ts",
  "app/api/crm/route.ts",
  "app/api/nova/conversations/[conversationId]/messages/route.ts",
  "app/api/forge/conversations/[conversationId]/messages/route.ts",
  "app/api/forge/conversations/[conversationId]/agent-runs/route.ts"
];

test("every paid AI route uses the shared authentication and rate-limit guard", () => {
  for (const route of paidRoutes) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /protectPaidApi\(/, `${route} must call protectPaidApi`);
  }
});

test("the paid API guard fails closed and emits 401, 429 and Retry-After", () => {
  const source = readFileSync("lib/paid-api-security.ts", "utf8");
  assert.match(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(source, /status: 401/);
  assert.match(source, /status: 429/);
  assert.match(source, /Retry-After/);
});
test("Forge polling stays authenticated without consuming the paid POST limit", () => {
  const source = readFileSync(
    "app/api/forge/conversations/[conversationId]/agent-runs/route.ts",
    "utf8"
  );
  const getHandler = source.slice(
    source.indexOf("export async function GET"),
    source.indexOf("export async function POST")
  );
  const postHandler = source.slice(source.indexOf("export async function POST"));
  assert.doesNotMatch(getHandler, /protectPaidApi\(/);
  assert.match(getHandler, /authenticateForge\(/);
  assert.match(postHandler, /protectPaidApi\(/);
});