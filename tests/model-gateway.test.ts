import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { userOwnership } from "../lib/core/identity/contracts";
import { agentId, projectId, runId, userId } from "../lib/core/shared/ids";
import { ModelGateway } from "../lib/ai/gateway/model-gateway";
import { modelId, type ModelDescriptor } from "../lib/ai/gateway/contracts";
import { GatewayError, normalizeProviderError } from "../lib/ai/errors/gateway-error";
import { ModelRegistry } from "../lib/ai/models/registry";
import { OpenAIProvider, type OpenAITransport } from "../lib/ai/providers/openai";
import { calculateModelCost } from "../lib/ai/usage/cost";

const textModel = modelId("test-text");
const descriptor: ModelDescriptor = { provider: "openai", id: textModel, capabilities: { supported: new Set(["text", "streaming", "tools", "structured_output"]) }, enabled: true, usageUnit: "tokens" };

test("registry declares capabilities, enabled state, and explicit aliases", () => {
  const alias = modelId("test-alias"), registry = new ModelRegistry([{ ...descriptor, aliases: [alias] }]);
  assert.equal(registry.requireEnabled(alias).id, textModel);
  assert.equal(registry.supports(textModel, "tools"), true);
  assert.equal(registry.supports(textModel, "image"), false);
  assert.throws(() => new ModelRegistry([descriptor, descriptor]), /Duplicate model/);
});

test("OpenAI chat mapping preserves messages, tools, structured output and normalizes usage", async () => {
  let input: Record<string, unknown> | undefined;
  const provider = new OpenAIProvider({
    async createChat(value) { input = value; return { id: "chat-1", model: "test-text", choices: [{ message: { content: "  result  ", tool_calls: [{ id: "call-1", function: { name: "lookup", arguments: "{}" } }] }, finish_reason: "stop" }], usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } }; },
    async createResponse() { throw new Error("unexpected"); },
  });
  const result = await provider.generate({ model: textModel, messages: [{ role: "system", content: "safe" }, { role: "user", content: "hello" }], tools: [{ name: "lookup", inputSchema: { type: "object" } }], structuredOutput: { name: "answer", schema: { type: "object" } }, maxOutputUnits: 80 });
  assert.equal(result.text, "result");
  assert.deepEqual(result.usage, { inputUnits: 11, outputUnits: 7, totalUnits: 18, unit: "tokens" });
  assert.deepEqual(result.toolCalls, [{ id: "call-1", name: "lookup", arguments: "{}" }]);
  assert.equal(input?.max_tokens, 80);
  assert.ok(Array.isArray(input?.tools));
  assert.deepEqual((input?.response_format as { json_schema: { name: string } }).json_schema.name, "answer");
});

test("OpenAI Responses mapping preserves native web search and token usage", async () => {
  let input: Record<string, unknown> | undefined;
  const provider = new OpenAIProvider({
    async createChat() { throw new Error("unexpected"); },
    async createResponse(value) { input = value; return { id: "resp-1", model: "test-text", output_text: "current answer", usage: { input_tokens: 3, output_tokens: 4, total_tokens: 7 } }; },
  });
  const result = await provider.generate({ model: textModel, messages: [{ role: "system", content: "rules" }, { role: "user", content: "latest" }], nativeTools: [{ type: "web_search", maxToolCalls: 3 }] });
  assert.equal(result.text, "current answer");
  assert.deepEqual(input?.tools, [{ type: "web_search" }]);
  assert.equal(input?.store, false);
  assert.deepEqual(result.usage, { inputUnits: 3, outputUnits: 4, totalUnits: 7, unit: "tokens" });
});

test("streaming chunks are provider-neutral", async () => {
  const transport: OpenAITransport = {
    async createChat() { throw new Error("unexpected"); }, async createResponse() { throw new Error("unexpected"); },
    async *streamChat() { yield { choices: [{ delta: { content: "A" }, finish_reason: null }] }; yield { choices: [{ delta: { content: "B" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }; },
  };
  const chunks = [];
  for await (const chunk of new OpenAIProvider(transport).stream!({ model: textModel, messages: [{ role: "user", content: "go" }] })) chunks.push(chunk);
  assert.deepEqual(chunks, [{ textDelta: "A", finishReason: undefined, usage: undefined }, { textDelta: "B", finishReason: "stop", usage: { inputUnits: 1, outputUnits: 2, totalUnits: 3, unit: "tokens" } }]);
});

test("cost calculation uses exact integers, rounds up, and unknown never means zero", () => {
  const pricing = [{ model: textModel, currency: "USD", inputMinorUnitsPerMillion: BigInt(150_000), outputMinorUnitsPerMillion: BigInt(600_000) }];
  assert.deepEqual(calculateModelCost(textModel, { inputUnits: 1, outputUnits: 0, totalUnits: 1, unit: "tokens" }, pricing), { status: "KNOWN", amount: { currency: "USD", minorUnits: BigInt(1) } });
  assert.deepEqual(calculateModelCost(textModel, { inputUnits: 20, outputUnits: 5, unit: "tokens" }, pricing), { status: "KNOWN", amount: { currency: "USD", minorUnits: BigInt(6) } });
  assert.deepEqual(calculateModelCost(modelId("unpriced-alias"), { inputUnits: 1, unit: "tokens" }, pricing), { status: "UNKNOWN", reason: "MODEL_NOT_PRICED" });
  assert.deepEqual(calculateModelCost(textModel, undefined, pricing), { status: "UNKNOWN", reason: "USAGE_UNAVAILABLE" });
});

test("gateway emits attribution, observation, and Phase 1A UsageEvent without persistence coupling", async () => {
  const events: unknown[] = [], observations: unknown[] = [], times = [new Date("2026-09-21T10:00:00Z"), new Date("2026-09-21T10:00:00.025Z"), new Date("2026-09-21T10:00:01Z")];
  const ownership = userOwnership(userId("user-a"));
  const gateway = new ModelGateway({ registry: new ModelRegistry([descriptor]), providers: [{ provider: "openai", async generate() { return { text: "ok", model: textModel, usage: { inputUnits: 2, outputUnits: 1, totalUnits: 3, unit: "tokens" } }; } }], usageSink: { async record(event) { events.push(event); } }, now: () => times.shift()!, id: () => "usage-1", observe: (value) => observations.push(value) });
  const result = await gateway.generate({ model: textModel, messages: [{ role: "user", content: "hello" }], attribution: { ownership, agentId: agentId("agent-a"), projectId: projectId("project-a"), runId: runId("run-a") } });
  assert.equal(result.observation.durationMs, 25);
  assert.equal(result.observation.status, "SUCCESS");
  assert.equal(result.cost.status, "UNKNOWN");
  assert.equal(events.length, 1);
  assert.equal(result.usageEvent?.provider, "openai");
  assert.deepEqual(result.usageEvent?.ownership, ownership);
  assert.equal(observations.length, 1);
});

test("provider errors normalize to stable categories without exposing diagnostics", () => {
  const cases: Array<[unknown, string]> = [[{ status: 401 }, "AUTHENTICATION"], [{ status: 429 }, "RATE_LIMIT"], [{ status: 400 }, "INVALID_REQUEST"], [{ code: "model_not_found" }, "MODEL_UNAVAILABLE"], [{ name: "AbortError" }, "TIMEOUT"], [{ code: "content_filter" }, "SAFETY"], [{ status: 503 }, "PROVIDER_ERROR"], [new Error("secret provider details"), "UNKNOWN"]];
  for (const [input, expected] of cases) { const error = normalizeProviderError(input, "openai"); assert.equal(error.category, expected); assert.doesNotMatch(error.message, /secret provider details/); }
  assert.ok(normalizeProviderError(new GatewayError("TIMEOUT", "safe", "openai"), "openai") instanceof GatewayError);
});

test("proof integration preserves generate-agent prompt/model/output contract and removes direct SDK coupling", () => {
  const source = fs.readFileSync("app/api/generate-agent/route.ts", "utf8");
  assert.match(source, /buildOfficialAgentPrompt/);
  assert.match(source, /process\.env\.OPENAI_MODEL \|\| "gpt-4\.1-mini"/);
  assert.match(source, /temperature: 0\.7/);
  assert.match(source, /maxOutputUnits: 1800/);
  assert.match(source, /return NextResponse\.json\(\{ output \}\)/);
  assert.match(source, /protectPaidApi/);
  assert.doesNotMatch(source, /from "openai"|chat\.completions\.create/);
});
