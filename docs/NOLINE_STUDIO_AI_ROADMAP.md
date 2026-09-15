# NØLINE STUDIO AI — MASTER ROADMAP

**Base commit:** `1cffe0cfb6052470cbf34b8366d31d5bb9085c22` (`main`)
**Companion to:** [`NOLINE_STUDIO_AI_MASTER_AUDIT.md`](./NOLINE_STUDIO_AI_MASTER_AUDIT.md) · [`NOLINE_STUDIO_AI_CAPABILITY_MATRIX.md`](./NOLINE_STUDIO_AI_CAPABILITY_MATRIX.md)

---

## How to read this roadmap

Sequencing is **dependency-based, not calendar-based.** No dates or effort estimates appear here deliberately: the ordering constraints are technical, and inventing timelines would obscure them.

| Dimension | Values |
| --- | --- |
| **Priority** | `P0` prerequisite / security / data-integrity blocker · `P1` core product foundation · `P2` important capability · `P3` later enhancement |
| **Complexity** | `S` · `M` · `L` · `XL` |
| **Risk** | `LOW` · `MEDIUM` · `HIGH` · `CRITICAL` |

### Adjustment to the proposed sequence

The master plan's phase order is **validated by the audit evidence**, with one substantive change: a **PHASE 0.5 — STABILISATION** is inserted before Phase 1.

The reason is concrete rather than procedural. Phase 1 builds the shared Core, which means touching the data layer and the authentication path. Doing that while (a) a critical Next.js RCE advisory is unpatched, (b) three endpoints execute paid AI calls with no authentication, and (c) the Nova tables appear in no applied migration would mean building a foundation on top of three unknowns. These are prerequisites, not roadmap items.

One further sequencing note: **Tasks / durable execution moves earlier** than a literal reading of the plan implies. Forge already hits Vercel's 300 s function ceiling, and FLOW and NEXUS are unbuildable without an answer. The *decision* belongs in Phase 1; the implementation lands in Phase 2–3.

---

## Dependency graph

```
PHASE 0  AUDIT  (complete - stop gate active)
    |
PHASE 0.5  STABILISATION
    |   security patch | auth on open endpoints | rate limiting
    |   Node pinning + CI | Core migration applied | migration hygiene
    |
PHASE 1  CORE FOUNDATION
    |   lib/core | Storage + files | usage_events + cost
    |   Model Gateway v1 | middleware | cookie sessions | permissions base
    |   DECISIONS: organizations?  durable execution target?
    |
    +--> PHASE 2  NOVA  (streaming, context, files, tools, artifacts, tasks)
             |
             +--> PHASE 3  FORGE  (shared runtime + durable tasks + permissions)
                      |
                      +--> PHASE 4  APEX   (second agent - proves runtime is shared)
                      |
                      +--> PHASE 5  MUSE   (also needs Storage + cost gates)
                      |        |
                      |        +--> PHASE 6  CREATE  (editor, then Muse, then Forge)
                      |
                      +--> PHASE 7  FLOW   (needs tasks + tools + connectors)
                               |
                               +--> PHASE 8  NEXUS  (needs ALL of the above stable)
                                        |
                                        +--> PHASE 9  PLATFORM EXPANSION
```

**Three decisions gate most of the graph and are owner decisions, not code:**

1. **Durable execution target** — Vercel's 300 s ceiling. Gates Phases 3, 5, 7, 8.
2. **Single-user or multi-tenant** — every entity is currently keyed to `auth.users`; retrofitting means rewriting every RLS policy. Gates the Core schema shape.
3. **Verified restorable backup** — gates the Core migration, and therefore everything.

---

## PHASE 0 — AUDIT ✅ COMPLETE

**Objective.** Establish an evidence-based understanding of current state, the gap to the target product, and the safest implementation sequence.

**Dependencies.** None.

**Deliverables.**
- `docs/NOLINE_STUDIO_AI_MASTER_AUDIT.md`
- `docs/NOLINE_STUDIO_AI_CAPABILITY_MATRIX.md`
- `docs/NOLINE_STUDIO_AI_ROADMAP.md`

**Acceptance gates.**
- ✅ Exact git state captured before any state-altering command; working tree clean at start and end.
- ✅ All four active branches analysed without merging, rebasing or force-pushing.
- ✅ Lint, typecheck, tests, build and `npm audit` executed and recorded with exact results.
- ✅ Every `CONFIRMED` and `PARTIAL` claim cited to a file, module, migration or test.
- ✅ No production access, no deployment, no secret value printed, no dependency upgraded, no code deleted.
- ⏸ **STOP GATE — awaiting explicit owner approval before any implementation.**

---

## PHASE 0.5 — STABILISATION

> **Prerequisite phase. No new product surface.**

**Objective.** Make the repository safe, verifiable and reproducible so that Phase 1 can be built on known ground.

**Dependencies.** Owner approval · owner-provided read-only access to the production Supabase project · a verified restorable backup.

### Deliverables

| # | Deliverable | Priority | Complexity | Risk | Depends on |
| --- | --- | --- | --- | --- | --- |
| 0.5.1 | Land the `chore/security-production-readiness` dependency commit — Next 16.3.3, `npm audit` → 0 | **P0** | S | LOW | Owner approval |
| 0.5.2 | `test` and `typecheck` npm scripts (included in 0.5.1) | **P0** | S | LOW | 0.5.1 |
| 0.5.3 | Pin Node ≥ 22.15 via `engines` and `.nvmrc` | **P0** | S | LOW | — |
| 0.5.4 | CI running lint, typecheck, tests, build and audit on every PR | **P0** | S | LOW | 0.5.2, 0.5.3 |
| 0.5.5 | Require authentication on `/api/generate-agent`, `/api/agent-builder-v2`, and the official-agent path of `/api/agents/[id]/run` | **P0** | S | LOW to fix, **CRITICAL if skipped** | — |
| 0.5.6 | Rate limiting on all AI endpoints | **P0** | M | MEDIUM | 0.5.5 |
| 0.5.7 | Read-only production schema preflight (`supabase/core-data-preflight.sql`) | **P0** | S | MEDIUM — **needs owner access** | Owner credentials |
| 0.5.8 | Land `feat/noline-core-data-v1` — **migration applied before code deployed** | **P0** | M | **HIGH** | 0.5.1, 0.5.7, verified backup |
| 0.5.9 | Define `set_updated_at()` in a migration; resolve the `20260824_*` ordering hazard; establish a migration ledger | **P0** | M | MEDIUM | 0.5.7 |
| 0.5.10 | Gitignore `tsconfig.tsbuildinfo` (currently tracked) | P3 | S | LOW | — |

### Acceptance gates

- `npm audit` reports **0 vulnerabilities**.
- `npm run lint`, `npm run typecheck` and `npm run build` all pass.
- **All 197 tests pass** on the pinned Node version (the 3 current failures are a Node 22.14 artifact).
- CI is green on every pull request.
- **No unauthenticated AI endpoint remains** — verified by test.
- Core tables (`projects`, `conversations`, `messages`) confirmed present in the target database with RLS enforced.
- A verified, restorable backup exists covering Auth and Forge data.
- **All 11 Forge test files still pass** — no regression.

### Explicitly out of scope

Any new feature · any pillar implementation · any dependency upgrade beyond the prepared security patch · any large refactor · any change to an already-applied migration.

---

## PHASE 1 — CORE FOUNDATION

**Objective.** One shared Core with RLS genuinely enforced, and the two blocking architectural decisions made and documented.

**Dependencies.** Phase 0.5 complete.

### Deliverables

| # | Deliverable | Priority | Complexity | Risk | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1.1 | `lib/core/*` established using the Forge `-foundation`/`-store`/`-runtime`/`-provider`/`-client` convention | P1 | M | LOW | 0.5.8 |
| 1.2 | Nova migrated onto `lib/core`; PROJECT becomes the central domain object | P1 | M | MEDIUM | 1.1 |
| 1.3 | **DECISION: single-user or multi-tenant.** Documented; implementation may defer to Phase 9 | **P0** | S | **HIGH if deferred** | Owner decision |
| 1.4 | Supabase Storage enabled — buckets, policies, `files` table, upload/download, size and MIME limits | P1 | L | MEDIUM | 1.1, 1.3 |
| 1.5 | `usage_events` table and cost model; all five OpenAI call sites instrumented | P1 | M | LOW | 1.1 |
| 1.6 | Model Gateway v1 — implement the existing `AIProvider` contract, registry, capability routing; consolidate call sites | P1 | L | MEDIUM | 1.5 |
| 1.7 | `middleware.ts` providing server-side route protection and rate limiting | P1 | M | MEDIUM | 0.5.6 |
| 1.8 | Migrate sessions from `localStorage` to cookies (`@supabase/ssr`) | P1 | M | **HIGH — touches all auth** | 1.7 |
| 1.9 | Atomic quota enforcement across all AI endpoints | P1 | M | MEDIUM | 1.5 |
| 1.10 | Permission model foundations — enum plus enforcement points, no UI | P1 | M | MEDIUM | 1.1, 1.3 |
| 1.11 | **DECISION: durable execution target** (Vercel 300 s ceiling) | **P0** | S | **HIGH** | Owner decision |
| 1.12 | Generated database types (`supabase gen types`) wired into CI for drift detection | P2 | S | LOW | 0.5.9 |

### Acceptance gates

- Nova operates **entirely** through `lib/core` with RLS enforced via user JWT and **no service-role fallback**.
- Files upload and download with quotas and MIME restrictions enforced, backed by Storage policies mirroring table policies.
- **Every AI call emits a usage event carrying token counts and computed cost.**
- Exactly **one** gateway call site remains; no route calls OpenAI directly.
- Anonymous users cannot reach protected pages (server-enforced, not client-redirect).
- Sessions are cookie-based; no access token is readable from JavaScript.
- Quota enforcement is atomic under concurrency — verified by test.
- Both architectural decisions (1.3, 1.11) are documented in the repository.
- **No Forge regression — all 11 Forge test files pass.**

---

## PHASE 2 — NOVA

**Objective.** Make NOVA the first genuinely complete agent running on the shared Core.

**Dependencies.** Phase 1 complete (Core, Files, Model Gateway, usage, permissions foundation).

### Deliverables

| # | Deliverable | Priority | Complexity | Risk |
| --- | --- | --- | --- | --- |
| 2.1 | Streaming responses (SSE / `ReadableStream`) | P1 | M | LOW |
| 2.2 | Project context injection — Nova reads project files, conversations and artifacts | P1 | L | MEDIUM |
| 2.3 | File attachments in conversations | P1 | M | LOW |
| 2.4 | Artifact creation from conversations, with provenance | P1 | M | MEDIUM |
| 2.5 | Real tool-calling loop with permission checks and audit records | P1 | L | **HIGH** |
| 2.6 | Usage and cost surfaced in the UI | P2 | S | LOW |
| 2.7 | Task creation from a conversation | P2 | M | MEDIUM |
| 2.8 | Conversation-scoped memory (**not** a generic memory table) | P2 | M | MEDIUM |
| 2.9 | Conversation pagination for long histories | P2 | S | LOW |
| 2.10 | Concurrent generation idempotency (the known gap beyond sequential retry) | P2 | M | MEDIUM |

### Acceptance gates

- Streaming verified end-to-end from provider to browser.
- Nova reads project files and **cites them** in responses.
- Artifacts persist with full provenance: agent, model, run, inputs, timestamp.
- **Every tool call is permission-checked and audited** — no unpermissioned execution path.
- Cost is visible per conversation and attributed to user and project.
- **No regression in the safety or web-search layers** — all existing Nova tests pass.
- Concurrent duplicate generation produces one assistant message.

---

## PHASE 3 — FORGE ON THE SHARED RUNTIME

**Objective.** Make Forge durable and permissioned **without regressing what already works.**

**Dependencies.** Phases 1 and 2 · decision 1.11 (execution target) resolved.

> ### ⚠️ Highest-risk phase in the roadmap
> Forge is the most valuable working subsystem in the repository — 2,444 lines, 29 routes, 6 migrations, 11 test files. The extraction **must be incremental**: keep `forge_*` tables operational throughout, migrate one concern at a time, and require all Forge tests to pass at every step. A regression here costs more than the refactor gains. There is no acceptable big-bang rewrite.

### Deliverables

| # | Deliverable | Priority | Complexity | Risk |
| --- | --- | --- | --- | --- |
| 3.1 | Extract the agent loop from `lib/forge/agent-foundation.ts` into a shared Agent Runtime | P1 | L | **HIGH** |
| 3.2 | `tasks` table plus a durable worker (per decision 1.11) | P1 | L | **HIGH** |
| 3.3 | Migrate Forge onto Core projects and conversations | P1 | L | **HIGH** |
| 3.4 | Generalise `forge_agent_runs` / `forge_agent_steps` into shared `agent_runs` / `agent_steps` | P1 | M | MEDIUM |
| 3.5 | Permission enforcement: `repo.read`, `repo.write`, `exec.sandbox`, `git.write`, `deploy.*` | P1 | M | MEDIUM |
| 3.6 | Approval UI generalising the existing `confirmed: true` mechanism | P1 | M | MEDIUM |
| 3.7 | Per-run cost tracking | P2 | S | LOW |
| 3.8 | Resolve the sandbox egress question — apply the agent deny-list uniformly, including the direct runtime command route | **P0** | S | MEDIUM |
| 3.9 | Streaming agent progress (replacing 1500 ms client polling) | P2 | M | LOW |

### Acceptance gates

- **An agent run survives beyond 300 s** — the defining proof of durable execution.
- **All 11 Forge test files still pass.**
- Every tool call is permission-checked.
- Git writes still require explicit per-operation confirmation; `main`/`master` remain blocked; branches remain restricted to `forge/*`.
- Cost is tracked per run and attributed to user and project.
- **Sandbox egress policy documented and enforced on every command path**, not just the agent path.
- Production deployment permission (`deploy.*`) is **separate** from repository write permission.

---

## PHASE 4 — APEX

**Objective.** Add the engineering and architecture specialist — and in doing so, prove the Agent Runtime is genuinely shared rather than Forge-shaped.

**Dependencies.** Phase 3 (shared Agent Runtime, tools, permissions).

### Deliverables

| # | Deliverable | Priority | Complexity | Risk |
| --- | --- | --- | --- | --- |
| 4.1 | Apex agent on the shared runtime with **zero Forge-specific code** | P2 | M | MEDIUM |
| 4.2 | Architecture and system-design analysis capability | P2 | M | MEDIUM |
| 4.3 | Technical audit capability (security, performance, scalability) | P2 | L | MEDIUM |
| 4.4 | Structured review of Forge output, with the ability to **reject** | P2 | M | **HIGH** |
| 4.5 | Structured recommendation output format | P2 | S | LOW |
| 4.6 | APEX → FORGE → APEX correction loop | P2 | L | **HIGH** |

### Acceptance gates

- Apex runs on the same runtime with no duplicated runtime code.
- Apex can read Forge artifacts and emit a structured verdict.
- **A rejection measurably changes Forge's next run** — the loop is real, not advisory.
- The shared runtime required no agent-specific special-casing to support a second agent. *(If it did, the Phase 3 extraction was incomplete.)*

---

## PHASE 5 — MUSE

**Objective.** Introduce multimodal generation progressively, with cost control from the first line of code.

**Dependencies.** Phase 1.4 (Storage/files), 1.5 (usage/cost), 1.6 (Model Gateway), Phase 3 (tasks, for long-running media jobs).

**Recommended order** — image → image editing → video → voice → music. This follows the master plan and is supported by the evidence: image is cheapest to validate the pipeline, and video is the most expensive to get wrong.

### Deliverables

| # | Deliverable | Priority | Complexity | Risk |
| --- | --- | --- | --- | --- |
| 5.1 | Image generation through the Model Gateway | P2 | M | MEDIUM |
| 5.2 | Image editing — variations, background, object edits, upscale | P2 | L | MEDIUM |
| 5.3 | Video generation — text-to-video, image-to-video | P2 | XL | **HIGH (cost)** |
| 5.4 | Voice — TTS, narration, brand voices | P2 | L | MEDIUM |
| 5.5 | Music and audio generation | P3 | L | MEDIUM |
| 5.6 | **Hard budget caps** per user, organization and project, with pre-flight cost estimates | **P0 within this phase** | M | **HIGH** |
| 5.7 | Approval gate above a configurable cost threshold | **P0 within this phase** | M | MEDIUM |
| 5.8 | All outputs persisted as files and artifacts with full provenance | P1 | M | LOW |

### Acceptance gates

- **Generation routes through the Model Gateway** — no hard-coded provider anywhere in Muse.
- Every output is a file with provenance: prompt, model, provider, units, cost, timestamp.
- **Per-user, per-organization and per-project budgets are enforced with a pre-flight estimate**, not reconciled after the fact.
- Spend above the threshold requires explicit human approval.
- Long-running media jobs execute on the shared `tasks` infrastructure, not inside an HTTP request.

---

## PHASE 6 — CREATE

**Objective.** Build a genuinely solid editor foundation before attempting the long-term Design → Website → Application vision.

**Dependencies.** Phase 1.4 (files/assets), Phase 5 (Muse integration).

> The current `VisualCreator` is a template-driven SVG composer with no layers, no undo/redo and no document model. Create is effectively greenfield. The risk here is scope explosion, so the editor foundation must land and be proven before templates, Brand Kits or Muse integration begin.

### Deliverables

| # | Deliverable | Priority | Complexity | Risk |
| --- | --- | --- | --- | --- |
| 6.1 | Canvas document model — layers, z-order, groups, locking | P2 | L | MEDIUM |
| 6.2 | Undo/redo history across all operations | P2 | M | MEDIUM |
| 6.3 | Selection, alignment, guides, grouping, duplication, resize | P2 | L | LOW |
| 6.4 | Text, shapes, images, video and audio elements | P2 | L | MEDIUM |
| 6.5 | Templates and asset library | P2 | M | LOW |
| 6.6 | Brand Kits — logos, colours, typography, assets, rules | P2 | M | LOW |
| 6.7 | Exports preserving fidelity | P2 | M | MEDIUM |
| 6.8 | Muse integration — generate and insert assets directly | P2 | M | MEDIUM |
| 6.9 | Animation | P3 | L | MEDIUM |
| 6.10 | Design → Website → Application via Forge | P3 | XL | **HIGH** |

### Acceptance gates

- The layered document model persists as an artifact and reloads faithfully.
- Undo/redo works across **all** operations, including asset insertion.
- Muse assets are insertable directly without leaving the editor.
- Exports preserve visual fidelity against the canvas.
- Brand Kits apply consistently across templates.
- **Create integrates with Muse and Forge rather than becoming an isolated editor** (master plan principle 12).

---

## PHASE 7 — FLOW

**Objective.** Build automation on the **shared** execution primitives — never a second engine.

**Dependencies.** Phase 3 (tasks, agent runtime), Phases 2–3 (tools), Phase 1.10 (permissions).

### Deliverables

| # | Deliverable | Priority | Complexity | Risk |
| --- | --- | --- | --- | --- |
| 7.1 | Trigger system — manual, schedule, webhook, event | P2 | L | MEDIUM |
| 7.2 | Action nodes built on the shared tool registry | P2 | L | MEDIUM |
| 7.3 | Conditions, branches, loops, variables | P2 | L | MEDIUM |
| 7.4 | Delays, retries, timeouts, error handling | P2 | M | MEDIUM |
| 7.5 | Human approval nodes | P2 | M | MEDIUM |
| 7.6 | Connector framework plus credential vault | P2 | L | **HIGH** |
| 7.7 | Agent nodes — Nova, Forge, Apex, Muse usable inside flows | P2 | M | MEDIUM |
| 7.8 | SSRF allow-list for all external actions | **P0 within this phase** | M | **HIGH** |

### Acceptance gates

- **Flows execute on the shared `tasks` infrastructure** — no parallel execution engine exists in the codebase.
- External actions are gated by `external.send` with an enforced SSRF allow-list.
- Every flow run is fully audited: trigger, steps, tools, costs, approvals.
- Credentials are vaulted with explicit per-connector scopes and never logged.
- Start with controlled workflows; highly autonomous execution comes only after the audit trail is proven.

---

## PHASE 8 — NEXUS

**Objective.** Orchestrate mature capabilities. **Never compensate for unfinished ones.**

**Dependencies.** Phases 3, 4, 5, 7 — and every one of the following must be demonstrably stable:

| Foundation | Required maturity |
| --- | --- |
| Agent Runtime | Shared, durable, streaming, cancellable |
| Tasks | Full lifecycle including `NEEDS_APPROVAL`, proven at scale |
| Tools | Registry with schemas, permissions, timeouts, audit |
| Permissions | READ / WRITE / EXECUTE / DEPLOY / EXTERNAL / SPEND enforced |
| Context handoff | Agent-to-agent context transfer proven by Phase 4 |
| Observability | Full run provenance and tracing |
| Cost tracking | Per-agent, per-provider, enforceable budgets |
| Human approval | Generalised gate mechanism in production use |

> **If any foundation above is immature, NEXUS is premature.** This is the master plan's own instruction and the audit evidence supports it strongly — the current codebase has none of these eight in a shared, stable form.

### Deliverables

| # | Deliverable | Priority | Complexity | Risk |
| --- | --- | --- | --- | --- |
| 8.1 | Objective decomposition and planning | P3 | XL | **CRITICAL** |
| 8.2 | Agent selection and task assignment | P3 | L | **HIGH** |
| 8.3 | Parallelism and dependency management | P3 | L | **HIGH** |
| 8.4 | Context handoffs between agents | P3 | L | **HIGH** |
| 8.5 | Mission state, progress and budgets with a hard stop | P3 | L | **CRITICAL** |
| 8.6 | Retries, timeouts, recovery, escalation | P3 | L | **HIGH** |
| 8.7 | Evaluation, critique and validation | P3 | L | **HIGH** |
| 8.8 | Human approval at mission start and at every escalation | **P0 within this phase** | M | **CRITICAL** |

### Acceptance gates

- A multi-agent mission completes with a **full audit tree**: goals, decomposition, agents, tools, costs, approvals.
- **Mission budgets are enforced with a hard stop** — no runaway spend is possible.
- Every escalation surfaces to a human before proceeding.
- **Nexus adds no agent-specific special-casing** — it orchestrates existing capabilities through their published contracts.
- NEXUS remains distinct from NOVA: Nova is the user's assistant and interface; Nexus is the mission coordinator.

---

## PHASE 9 — PLATFORM EXPANSION

**Objective.** Broaden the platform once the core product is stable.

**Dependencies.** All prior phases · decision 1.3 (organizations).

### Deliverables

| # | Deliverable | Priority | Complexity | Risk |
| --- | --- | --- | --- | --- |
| 9.1 | Organizations, memberships and team collaboration (if decided in 1.3) | P3 | XL | **HIGH** |
| 9.2 | Admin control plane — users, orgs, agents, models, usage, costs, security events | P3 | L | MEDIUM |
| 9.3 | Template ecosystem | P3 | M | LOW |
| 9.4 | Marketplace | P3 | XL | MEDIUM |
| 9.5 | Mobile companion experience | P3 | XL | MEDIUM |
| 9.6 | Local / private AI | P3 | XL | **HIGH** |
| 9.7 | Enterprise inference and capabilities | P3 | XL | **HIGH** |

### Acceptance gates

- Organization isolation is enforced at the RLS layer, not only in application code.
- The admin control plane is itself permission-gated and fully audited (it is high-value attack surface).
- No expansion feature compromises an existing security boundary.

---

## P0 items across all phases

Collected for visibility. Each is a prerequisite, security or data-integrity blocker.

| Phase | Item | Risk |
| --- | --- | --- |
| 0.5 | Land the security dependency patch (Next 16.3.3, audit → 0) | Critical RCE class if skipped |
| 0.5 | Authenticate `/api/generate-agent`, `/api/agent-builder-v2`, official-agent run path | Unbounded anonymous AI spend |
| 0.5 | Rate limiting on all AI endpoints | Amplifies the above |
| 0.5 | Pin Node ≥ 22.15 and add CI | No quality enforcement exists today |
| 0.5 | Verify production schema (read-only preflight) | Building on an unknown foundation |
| 0.5 | Verified restorable backup | Core migration is unrecoverable without one |
| 0.5 | Apply the Core migration before deploying Core code | Every Nova request fails if inverted |
| 0.5 | Define `set_updated_at()`; fix `20260824_*` ordering; establish the ledger | Migration chain cannot be applied cleanly |
| 1 | **DECISION: single-user or multi-tenant** | Retrofitting org scope rewrites every RLS policy |
| 1 | **DECISION: durable execution target** | Gates Phases 3, 5, 7, 8 |
| 3 | Apply the command deny-list uniformly, including the direct runtime route | Sandbox egress bypass |
| 5 | Hard budget caps with pre-flight estimates before any paid media generation | Uncontrolled spend |
| 7 | SSRF allow-list for all external actions | External action abuse |
| 8 | Human approval at mission start and every escalation | Autonomous runaway |

---

## Principles governing every phase

Derived from the master plan and validated against the audit evidence.

1. **One shared Core.** Do not build seven independent applications. The current three parallel stacks are the primary structural problem.
2. **Extend before duplicating.** Forge's layering convention, agent loop, Git safety model and RLS policies already work — build on them.
3. **Preserve working architecture** unless there is evidence-based reason to change it. Forge in particular must not regress.
4. **Security boundaries before autonomous execution.** Permissions are a Phase 1–3 prerequisite, not a Phase 8 concern.
5. **Projects provide shared context.** PROJECT becomes the central domain object linking conversations, files, artifacts, runs and tasks.
6. **Agents share infrastructure, keep distinct responsibilities.** NOVA assists the user; NEXUS coordinates missions; they never merge.
7. **Model providers stay replaceable.** Agents address capabilities, not providers.
8. **Long-running operations require persistent state.** Nothing that outlives a request may run inside one.
9. **Sensitive actions require explicit permission and approval.** `READ ≠ WRITE ≠ EXECUTE ≠ DEPLOY ≠ EXTERNAL ≠ SPEND`.
10. **NEXUS comes last**, after agent, tool, task and runtime contracts are stable.
11. **CREATE integrates** with Muse and Forge rather than becoming an isolated editor.
12. **FLOW reuses** shared execution primitives rather than inventing a second engine.
13. **Cost attribution is designed before** expensive media and autonomous workloads scale.
14. **Avoid premature microservices.** A modular monolith is correct here; only the durable worker needs to live outside the request lifecycle.
15. **Avoid premature abstraction** unsupported by real requirements.
16. **Never compromise current security** for faster agent development.
17. **VYRA is not part of this product.** No VYRA module. NEXUS is the orchestrator. Any future infrastructure sharing crosses an explicit, intentional boundary.

---

**STOP GATE ACTIVE — Phase 0 is complete. No implementation may begin without explicit owner approval.**
