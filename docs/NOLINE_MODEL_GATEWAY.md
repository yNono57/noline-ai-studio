# NØLINE Model Gateway — Phase 1B

## Baseline inventory

The Phase 1B branch is stacked on Phase 1A commit `13f4a1d8233aac5cbe9bad87afbcb0f69724baa9`. The repository contained these OpenAI call sites before this phase:

| Call path | API shape | Status after Phase 1B |
| --- | --- | --- |
| `lib/chat/nova-openai.ts` | Responses API, native `web_search` | Legacy; protected, not migrated |
| `lib/forge/forge-openai.ts` | Chat Completions, JSON mode | Legacy; protected, not migrated |
| `app/api/generate/route.ts` | Chat Completions | Legacy; quota/persistence path |
| `app/api/generate-agent/route.ts` | Chat Completions | **Proof integration via Model Gateway** |
| `src/modules/agent-builder/services/openai-agent-builder.gateway.ts` | Chat Completions, Structured Outputs | Legacy behind its existing module gateway |
| `app/api/agents/[id]/run/route.ts` | Chat Completions | Legacy |
| `app/api/agents/[id]/workflow/route.ts` | Chat Completions | Legacy |
| `app/api/crm/route.ts` | Chat Completions | Legacy |

`app/api/agent-builder-v2/route.ts` reaches OpenAI indirectly through the Agent Builder gateway. `app/api/agent-builder/route.ts` does not call a provider. Existing `usage_limits` counts generations; it is not token/cost accounting and is intentionally unchanged.

## Responsibilities and dependency direction

Product agents depend on the provider-neutral contracts in `lib/ai/gateway`. The gateway selects an enabled model from the registry, delegates to a provider adapter, normalizes results/errors, computes exact cost when approved pricing is configured, and emits attribution/observation metadata. Provider adapters alone know SDK request and response shapes.

`product agent → Model Gateway → provider adapter → provider SDK`

The Gateway may import Phase 1A Core usage and identity contracts. Core never imports the Gateway.

## Registry, usage, cost, and errors

The model registry centralizes provider, model identifier, enabled state, capabilities, aliases, and unit semantics. Aliases are explicit. Pricing is a separate replaceable configuration; no unverified price is embedded. An unpriced model returns `UNKNOWN`, never zero.

Money uses Core integer minor units. Input and output rates are separate and calculations use integer arithmetic with deterministic upward rounding. A successful attributed operation can emit a Phase 1A `UsageEvent` through `UsageEventSink`; Phase 1B provides no production persistence implementation.

Observations include ownership when available, agent/project/run, provider/model, units, cost state, duration, and success/failure. Provider failures normalize to stable categories while the original error remains only as the server-side cause.

## OpenAI adapter and proof integration

The OpenAI adapter maps neutral chat, function tools, structured output, Responses native web search, token usage, and streaming chunks. Tests inject a transport and never perform network calls.

`/api/generate-agent` is the proof integration. Its authentication/rate limiting, prompts, default model, temperature, token ceiling, response payload, demo fallback, and error response remain unchanged. NOVA and FORGE runtime paths are untouched.

## Migration sequence

1. Migrate `/api/generate` after defining how token usage coexists with its generation quota and persistence.
2. Migrate Agent Builder using its existing gateway boundary and structured-output parity tests.
3. Migrate CRM and the generic agent run/workflow routes with attribution.
4. Migrate NOVA only with Responses/web-search source and fallback parity.
5. Migrate FORGE last, preserving its tool loop, JSON decisions, completion gates, recovery, and context limits.

## What the Model Gateway does not do

It does not orchestrate agents, execute tools, schedule workflows, decide permissions, own persistence, plan NEXUS work, manage prompts, enforce product quotas, deploy applications, or make Phase 1A Core provider-aware.
