# ADR-001 — Durable Execution for NØLINE Studio AI

| Field | Value |
| --- | --- |
| **Status** | **PROPOSED** — awaiting owner decision. No implementation authorised. |
| **Date** | 2026-09-15 |
| **Phase** | 0.5A (analysis and planning only) |
| **Deciders** | Repository owner |
| **Base commit** | `1cffe0cfb6052470cbf34b8366d31d5bb9085c22` (`main`) |
| **Supersedes** | — |
| **Related** | [`NOLINE_STUDIO_AI_MASTER_AUDIT.md`](./NOLINE_STUDIO_AI_MASTER_AUDIT.md) §5.5, §13 · [`NOLINE_STUDIO_AI_PHASE_0_5_STABILISATION.md`](./NOLINE_STUDIO_AI_PHASE_0_5_STABILISATION.md) |

---

## 1. Context

### 1.1 The problem, stated precisely

FORGE — the most mature subsystem in the codebase — runs its entire agentic loop **synchronously inside a single HTTP POST request**:

- `app/api/forge/conversations/[conversationId]/agent-runs/route.ts` declares `export const maxDuration = 300` and directly awaits `forgeAgentRunner.run(...)`.
- `lib/forge/agent-foundation.ts:4` caps the loop at **240 s wall clock**, 60 steps and 48 tool calls — budgets chosen to fit inside the 300 s function ceiling, not chosen for the work.
- The browser polls `GET .../agent-runs` every 1500 ms (`components/ForgeAgentRunnerPanel.tsx:19`) to observe progress.

Run *state* is durable — `forge_agent_runs`, `forge_agent_steps` and `forge_run_artifacts` persist every step to Supabase, so a page refresh loses nothing. **Execution is not durable.** If the serverless invocation is terminated, redeployed over, or exceeds its ceiling, the run stops mid-flight and the database is left holding a `RUNNING` row that nothing will ever advance. There is no queue, no worker, no scheduler, no cron and no recovery path anywhere in the repository.

This is the single hardest architectural constraint identified in the Phase 0 audit. It currently limits FORGE, and it makes MUSE (long media generation), FLOW (schedules, delays, retries, approvals) and NEXUS (multi-agent missions with human approval gates) **unbuildable as specified**.

### 1.2 Why this is decided now rather than later

Three of the remaining roadmap phases depend on the answer, and the answer determines the shape of the `tasks` table, the Agent Runtime interface and the approval mechanism. Choosing late means either building those twice or building them against assumptions. Choosing now — and implementing later — costs nothing and de-risks Phases 3, 5, 7 and 8.

The owner explicitly directed that the technology **not be selected arbitrarily**, hence this ADR.

### 1.3 Constraints inherited from the existing system

These are facts from the repository, not preferences, and they eliminate several otherwise-reasonable options:

| Constraint | Evidence | Consequence |
| --- | --- | --- |
| Deployed on Vercel, Next.js App Router | `vercel.json`, confirmed live Production deployment | The solution must not require abandoning Vercel for the frontend/API |
| **Single maintainer, no CI, no ops capability** | 65 commits, one author; no `.github/` | Anything requiring a worker fleet, a Redis cluster or a self-hosted control plane is disqualified on operational cost alone |
| Supabase Postgres already holds durable run state | `forge_agent_runs`, `forge_agent_steps`, `forge_run_artifacts` | The engine does **not** need to be the system of record — this is a major lock-in reducer (see §6.1) |
| Steps need full Node.js | `@daytona/sdk`, `openai` SDKs used inside the loop | The execution surface for steps must be a real Node runtime, not an edge/isolate sandbox |
| Human approval is already a core design principle | `continuity-foundation.ts` requires `confirmed: true` per Git write | The engine must support **waiting for an external event for an unbounded time** — this is a hard requirement, not a nice-to-have |
| Cooperative cancellation already exists | `isCancelled` polled between steps; `DELETE .../agent-runs/[runId]` | Cancellation semantics must be preservable |
| One active run per runtime is DB-enforced | partial unique index, `20260824_forge_v14_*.sql` | Concurrency control already exists at the data layer and should remain authoritative |
| Vercel plan is **UNKNOWN** | Not determinable from the repository | Affects the function ceiling (300 s Hobby vs 800 s Pro) — see §7 |

---

## 2. Decision drivers

Taken directly from the owner's stated requirements, each mapped to how it will be judged.

| # | Requirement | How it is evaluated |
| --- | --- | --- |
| D1 | Execution outside the long HTTP request lifecycle | Can work continue after the originating request returns? |
| D2 | Persistent state | Is progress durable across process death? |
| D3 | Retries | Per-step retry with backoff, without replaying completed work |
| D4 | Idempotency | Are completed steps memoised so replay is safe? |
| D5 | Cancellation | Can an in-flight run be stopped, and does the engine honour it? |
| D6 | Timeout handling | Per-step and per-run timeouts, distinct from the platform ceiling |
| D7 | **Recovery after worker/process failure** | Does the run resume automatically, or is it lost? |
| D8 | Observability | Run history, step traces, failure inspection without building it |
| D9 | Concurrency controls | Limit parallel runs globally, per user and per tenant |
| D10 | Cost controls | Can spend be bounded, and is the engine's own cost predictable? |
| D11 | **Compatibility with FORGE** | Full Node.js for steps; long external calls to Daytona; preserves existing run/step tables |
| D12 | Future fit: MUSE, FLOW, NEXUS | Long sleeps, waiting on human approval, fan-out, nested workflows |
| D13 | Vercel-compatible frontend/API | No requirement to move the Next.js app off Vercel |
| D14 | *(added)* Operational burden | Realistic for a single maintainer with no existing ops practice |
| D15 | *(added)* Reversibility | How expensive is it to change this decision later? |

D14 and D15 are not in the owner's list but are added explicitly because the audit established that the project has one maintainer and no CI. An option that satisfies D1–D13 perfectly but cannot be operated is not a real option.

---

## 3. Options considered

Eight options were considered. Three are eliminated immediately with reasons; five are analysed in full.

### Eliminated without full analysis

| Option | Why eliminated |
| --- | --- |
| **Self-hosted BullMQ + Redis + container worker** | Requires provisioning and operating Redis and a always-on worker host, plus building retries, idempotency, observability and approval-waiting by hand. Fails D14 decisively. Every capability would be bespoke. |
| **AWS Step Functions** | Introduces a second cloud, IAM, and Amazon States Language. Steps would run in Lambda, not in the Next.js app, duplicating the entire Supabase/Daytona/OpenAI wiring. Fails D13/D14. |
| **Cloudflare Workflows** | Strong product, but steps run on Cloudflare Workers, not Vercel Node functions. Would split the codebase across two platforms and two runtimes. Fails D11 (full Node for Daytona SDK) and D13. |

### Option A — Vercel Workflows (first-party)

Vercel's durable execution product. Ordinary async functions are marked `"use workflow"`; units of work are marked `"use step"`. Vercel manages queueing, retries and state persistence; steps compile into isolated API routes, and the workflow suspends without consuming compute while a step runs, while sleeping, or while waiting on a hook. State is event-sourced; runs survive crashes and deployments and can pause for minutes to months. Observability (runs, traces, metrics) is built into the Vercel dashboard. Pricing is usage-based on Events, Data Written and Data Retained.

**Material caveat:** the *workflow* function runs in a **sandboxed environment without full Node.js access** with a restricted npm surface, and must be **deterministic** because it is replayed from the event log on every resume. Full Node is available inside *steps*. For NØLINE this is workable — orchestration goes in the workflow, all Daytona/OpenAI/Supabase I/O goes in steps — but it is a real constraint that shapes how the Forge loop must be decomposed, and the current loop is not written this way.

| Driver | Assessment |
| --- | --- |
| D1 D2 D3 D4 D7 | Native. Event-sourced replay, memoised steps, default 3 retries per step. |
| D5 Cancellation | Supported; existing DB-flag cooperative cancellation remains usable alongside. |
| D6 Timeouts | Per-step; steps still bounded by the underlying function ceiling. |
| D8 Observability | Built in — the strongest of any option, with no work required. |
| D9 Concurrency | Available at the engine level; existing DB unique index remains authoritative. |
| D10 Cost | Usage-based (events/data), not compute-time — predictable, but a new billing line. |
| D11 FORGE | Good: steps get full Node. **Requires restructuring the loop** into deterministic orchestration + steps. |
| D12 Future | Excellent: `sleep` for months and hooks for human approval map directly onto MUSE spend approval, FLOW approvals and NEXUS escalation. |
| D13 Vercel | Perfect — it *is* Vercel. |
| D14 Ops | Lowest possible: no new vendor, no new account, no infrastructure. |
| D15 Reversibility | Moderate. Directive-based authoring is Vercel-specific; migrating away means rewriting orchestration (though not domain logic — see §6.1). |

### Option B — Inngest

Event-driven durable step functions. Steps are delivered to your own application over HTTP, so the code runs inside your existing Vercel functions; Inngest memoises completed step results and re-invokes on failure. Native Vercel integration, a genuinely good local dev server (`inngest-cli dev`), step-level retries, `waitForEvent` for human-in-the-loop, and concurrency/throttling controls that are among the best in class. Free tier around 100K executions/month, Pro around $75–99/month. The SDK is open source; the platform is cloud-only (a self-hosted server exists but is not the mainstream path).

| Driver | Assessment |
| --- | --- |
| D1 D2 D3 D4 D7 | Native and mature. |
| D5 Cancellation | First-class cancellation, including cancel-on-event. |
| D6 Timeouts | Per-step and per-function; steps bounded by the Vercel function ceiling. |
| D8 Observability | Excellent dashboard, run traces, replay. |
| D9 Concurrency | **Best of the options** — multi-level concurrency keys, throttling, rate limiting, debounce. Directly useful for per-user and per-tenant limits. |
| D10 Cost | Per-execution; step-heavy agent loops multiply execution counts, so cost scales with loop verbosity. Needs modelling. |
| D11 FORGE | Very good: steps run in your own Node function with the real SDKs; no determinism sandbox on the orchestrator. |
| D12 Future | Excellent: `waitForEvent`, fan-out, nested invocation. |
| D13 Vercel | Excellent — designed for it. |
| D14 Ops | Very low: one vendor account, one route handler. |
| D15 Reversibility | Good. The step model is conceptually portable to Upstash Workflow or Vercel Workflows. |

### Option C — Upstash Workflow (QStash)

The same "HTTP school" model as Inngest: a workflow is a single route in your app, and `context.run` / `context.sleep` / `context.waitForEvent` / `context.call` define steps. Built on QStash's reliable delivery. Per-step ceiling is the plan's HTTP response duration (15 minutes on free, up to 12 hours on fixed plans), and `context.call` can offload a long third-party HTTP call to the engine entirely so it does not consume your function time at all — a genuinely useful property for slow Daytona or media-generation calls. Cheapest of the managed options; local dev via `QSTASH_DEV=true` with no tokens.

| Driver | Assessment |
| --- | --- |
| D1 D2 D3 D4 D7 | Native. |
| D5 Cancellation | `context.cancel` plus API-level cancellation. |
| D6 Timeouts | Per-step; `context.call` sidesteps the function ceiling for external calls. |
| D8 Observability | Adequate — weaker than Inngest and Vercel Workflows. Run logs exist; deep tracing is thinner. |
| D9 Concurrency | Present but the least expressive of the three HTTP-model options. |
| D10 Cost | **Lowest.** Message/step-based, very cheap at this project's scale. |
| D11 FORGE | Very good, and `context.call` is a strong fit for long sandbox operations. |
| D12 Future | Good: `waitForEvent`, webhooks, long sleeps. |
| D13 Vercel | Excellent. |
| D14 Ops | Very low. |
| D15 Reversibility | Good — same conceptual model as Inngest. |

### Option D — Trigger.dev v3

TypeScript background jobs that deploy to **Trigger.dev's own managed workers**, not your Vercel functions. Consequently there is no function timeout at all, plus realtime progress streaming to React via `useRealtimeRun`. Fully open source (Apache 2.0) and self-hostable. Increasingly oriented toward AI agent orchestration.

| Driver | Assessment |
| --- | --- |
| D1 D2 D3 D4 D7 | Native. |
| D5 D6 | Good. |
| D8 Observability | Very good, plus realtime run subscription — which would neatly replace Forge's 1500 ms polling. |
| D9 Concurrency | Good, with concurrency keys. |
| D10 Cost | Compute-seconds plus per-run fee. An agent that waits on Daytona for minutes **pays for that wall-clock time**, unlike the HTTP-model options where waiting is free. Worse economics for this workload. |
| D11 FORGE | Good technically — full Node on their workers. But it **moves execution off Vercel**, creating a second deployment target, a second env-var surface, and a second place secrets live. |
| D12 Future | Good. |
| D13 Vercel | Frontend stays on Vercel, but the backend job tier does not. Partial. |
| D14 Ops | Low if cloud; **high** if self-hosted. |
| D15 Reversibility | Moderate — code is portable TypeScript, but deployment topology change is real. |

### Option E — Supabase-native (pg_cron + pgmq + Edge Functions)

Use the database already in the stack: `pgmq` for the queue, `pg_cron` to tick a dispatcher, Edge Functions or a Vercel cron route as the executor. Everything stays in Supabase and Vercel; no new vendor.

| Driver | Assessment |
| --- | --- |
| D1 D2 | Achievable. |
| D3 D4 D5 D6 D7 | **All must be hand-built.** Retries, idempotency keys, visibility timeouts, orphan recovery, backoff — every one is bespoke code that must then be tested and maintained. |
| D8 Observability | **Must be hand-built entirely.** |
| D9 Concurrency | Hand-built. |
| D10 Cost | Effectively free (already paying for Supabase), but see §7 — the project is reportedly on the Supabase **Free** plan, where `pg_cron` availability and resource limits are constrained. |
| D11 FORGE | Workable. |
| D12 Future | Poor without significant further investment. Human-approval waits, long sleeps and fan-out would all be bespoke. |
| D13 Vercel | Fine. |
| D14 Ops | **Deceptively high.** "No new vendor" is not the same as "no new work" — this option trades a subscription for a maintained in-house workflow engine, which is precisely what a single-maintainer project cannot afford. |
| D15 Reversibility | High in principle; low in practice once bespoke semantics accumulate. |

### Option F — Do nothing structural; raise the ceiling (interim only)

Enable Vercel Pro and set `maxDuration` to 800 s (or 1800 s in the extended beta) on the agent routes, and raise Forge's internal 240 s budget accordingly.

This is **not a durable execution strategy** — it fails D7 outright, since a killed invocation still loses the run — but it is a legitimate, near-zero-cost **interim measure** that roughly triples Forge's usable budget while a real engine is adopted. It is listed because dismissing it would be dishonest: it may be the correct first move.

---

## 4. Comparison

Scoring: ●●● strong · ●●○ adequate · ●○○ weak · ✗ fails.

| Driver | A · Vercel Workflows | B · Inngest | C · Upstash Workflow | D · Trigger.dev | E · Supabase-native | F · Raise ceiling |
| --- | --- | --- | --- | --- | --- | --- |
| D1 Outside request | ●●● | ●●● | ●●● | ●●● | ●●○ | ✗ |
| D2 Persistent state | ●●● | ●●● | ●●● | ●●● | ●●○ | ●●○ (DB only) |
| D3 Retries | ●●● | ●●● | ●●● | ●●● | ●○○ | ✗ |
| D4 Idempotency | ●●● | ●●● | ●●● | ●●● | ●○○ | ✗ |
| D5 Cancellation | ●●○ | ●●● | ●●○ | ●●● | ●○○ | ●●○ (exists) |
| D6 Timeouts | ●●● | ●●● | ●●● | ●●● | ●○○ | ●○○ |
| **D7 Crash recovery** | ●●● | ●●● | ●●● | ●●● | ●○○ | **✗** |
| D8 Observability | ●●● | ●●● | ●●○ | ●●● | ✗ | ✗ |
| D9 Concurrency | ●●○ | ●●● | ●●○ | ●●○ | ●○○ | ✗ |
| D10 Cost control | ●●○ | ●●○ | ●●● | ●○○ | ●●● | ●●● |
| **D11 FORGE fit** | ●●○ | ●●● | ●●● | ●●○ | ●●○ | ●●○ |
| D12 MUSE/FLOW/NEXUS | ●●● | ●●● | ●●○ | ●●○ | ●○○ | ✗ |
| D13 Vercel-compatible | ●●● | ●●● | ●●● | ●●○ | ●●● | ●●● |
| D14 Ops burden | ●●● | ●●● | ●●● | ●●○ | ●○○ | ●●● |
| D15 Reversibility | ●●○ | ●●● | ●●● | ●●○ | ●●○ | ●●● |

### The discriminating factors

Most options satisfy D1–D4 and D7; durable execution is a mature category and the differences there are marginal. The decision actually turns on four things:

1. **Where steps execute.** Options A, B, C and E run steps inside the existing Vercel Node functions, so the Daytona SDK, OpenAI SDK and Supabase access already configured continue to work untouched. Option D moves them to another platform, duplicating the environment surface. For a single maintainer, this matters more than any feature.
2. **Whether waiting is free.** FORGE spends most of its wall clock waiting on Daytona commands, and MUSE will wait on media providers. In the HTTP-model options waiting can be suspended at zero compute cost; in Trigger.dev's worker model wall-clock time is billed. This is an economic difference that compounds precisely as the product scales.
3. **Whether the orchestrator must be deterministic.** Option A imposes a replay-determinism constraint and a restricted npm surface on the workflow function. This is the single largest piece of restructuring work for the existing Forge loop, which today is an imperative loop freely mixing I/O and control flow.
4. **How much has to be built by hand.** Option E is the only one where retries, idempotency, recovery, observability and approval-waiting are all bespoke. That is a workflow engine, and building one is not a side quest for this team.

---

## 5. Decision

> ### Recommended: **Option B — Inngest**, with **Option F as an immediate interim step**, and **Option A (Vercel Workflows) as the designated fallback**.

This recommendation is deliberately not the first-party option, so the reasoning deserves to be explicit.

**Why Inngest over Vercel Workflows.** Both are excellent and either would work. The deciding factor is **FORGE compatibility today**. Vercel Workflows requires the orchestrating function to be deterministic and to run without full Node.js, which means the existing `createForgeAgentRunner` loop — an imperative loop that interleaves model calls, tool dispatch, database writes and budget checks — must be decomposed into a deterministic orchestrator plus discrete steps before it can run at all. That is a meaningful rewrite of the most valuable and most delicate subsystem in the repository, and the Phase 0 audit was emphatic that Forge regression is the highest risk on the roadmap. Inngest imposes no determinism sandbox: the existing loop can be wrapped incrementally, step by step, with each extracted step gaining durability while the rest continues to work. **Inngest permits an incremental migration; Vercel Workflows requires a restructure first.**

Inngest also wins outright on D9 (concurrency), which is not a secondary concern here: the platform needs per-user and per-tenant concurrency limits as a **cost-control mechanism** before MUSE ships, and multi-level concurrency keys give that directly rather than as bespoke database logic.

**Why not Upstash Workflow**, which is cheaper and architecturally similar: observability is thinner, and observability is a stated Phase 0 gap the platform currently has *nothing* for. Paying somewhat more to acquire run tracing as a product feature rather than a future project is the right trade at this stage. Upstash Workflow remains a strong second alternative if cost becomes the binding constraint, and the migration between the two is conceptually shallow.

**Why Option F first.** Enabling Vercel Pro and raising `maxDuration` to 800 s is a configuration change that roughly triples Forge's usable budget immediately, with no new dependency, no code restructuring and no vendor decision. It does not solve D7 and must not be mistaken for the fix — but it buys real headroom while the durable engine is adopted properly, and the project likely needs Vercel Pro regardless (see §7).

**Why Vercel Workflows remains the designated fallback.** If the owner prefers to minimise vendors, or if Inngest's per-execution pricing models badly against Forge's step counts, Vercel Workflows is the right answer and the ADR should be revised rather than the decision improvised. Its `sleep`-for-months and hook primitives are the best long-term fit for NEXUS. The recommendation may well flip once §7's unknowns are resolved.

### Staged adoption

| Stage | Action | Unblocks |
| --- | --- | --- |
| **S0** | Confirm the Vercel plan. Enable Pro if not already. Raise `maxDuration` to 800 s on the two agent routes and lift Forge's 240 s internal budget proportionally. | Immediate Forge headroom. No new dependency. |
| **S1** | Introduce the Core `tasks` table (states `QUEUED`, `RUNNING`, `WAITING`, `NEEDS_APPROVAL`, `FAILED`, `COMPLETED`, `CANCELLED`) as the **system of record**, independent of any engine. | The durable domain model, engine-agnostic. |
| **S2** | Adopt Inngest for **one** narrow, low-risk workload first — not Forge. A Muse image generation job or a scheduled usage-aggregation job is ideal. Prove retries, cancellation, observability and cost in production. | Validates the choice cheaply and reversibly. |
| **S3** | Migrate Forge incrementally: the agent run becomes an Inngest function; each tool call becomes a step. `forge_agent_runs`/`forge_agent_steps` continue to be written exactly as today. Every Forge test must pass at each increment. | D7 for Forge, without a rewrite. |
| **S4** | Add `waitForEvent` approval gates, generalising the existing `confirmed: true` mechanism. | Human-in-the-loop for MUSE spend, FLOW external actions, NEXUS escalation. |
| **S5** | Replace the 1500 ms client polling with engine-driven progress. | UX improvement, lower function invocation count. |

Stages S1–S5 are **not authorised by this ADR.** They describe the intended path so that the Phase 1 `tasks` design is made with the destination known.

---

## 6. Consequences

### 6.1 The most important consequence: this decision stays reversible

Because `forge_agent_runs`, `forge_agent_steps` and `forge_run_artifacts` already exist and already hold every material fact about a run, **the durable execution engine never has to become the system of record.** The Core `tasks` table (S1) should be introduced on the same principle.

The engine's job is narrow: *decide what runs next, survive a crash, and retry.* The domain truth stays in Postgres, owned by the application, protected by RLS.

This has three effects worth stating plainly:
- Switching engines later means rewriting orchestration glue, not migrating data.
- The application remains queryable and debuggable with SQL, independent of any vendor dashboard.
- A vendor outage degrades to "runs do not advance", not "runs are lost".

This property is what makes recommending a third-party engine defensible for a single-maintainer project, and it should be treated as a **binding architectural constraint** on the implementation, not an incidental detail.

### 6.2 Positive

- FORGE runs can exceed 300 s and survive process failure and redeployment.
- Retries, idempotency and recovery stop being bespoke concerns.
- Observability arrives as a product capability rather than a future project — directly addressing a Phase 0 `PARTIAL` finding.
- Concurrency keys give a real cost-control lever before MUSE ships.
- `waitForEvent` supplies the human-approval primitive that FORGE deployment, MUSE spend, FLOW external actions and NEXUS escalation all require, generalising the mechanism Forge already proved with `confirmed: true`.
- The Next.js app stays on Vercel; no second deployment target.

### 6.3 Negative and accepted

- **A new vendor and a new bill.** Free tier covers current volume; Forge's step-heavy loops will consume executions faster than typical workloads and must be modelled before commitment.
- **A new secret** (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`) — and the audit already found that `.env.example` documents only 11 of ~24 variables in use. Environment documentation must be fixed alongside.
- **Steps remain bounded by the Vercel function ceiling.** Durable execution removes the *total run* limit, not the *single step* limit. Any individual Daytona command still has to fit in 300 s (Hobby) or 800 s (Pro). Long sandbox operations must be modelled as multiple steps or polled.
- **A new failure mode: partially-applied steps.** Every step must be genuinely idempotent, because it may run more than once. Forge's file writes and command executions are *not* all idempotent today. This needs deliberate design during S3 and is the main technical risk of the migration.
- Engine outage means work stalls (though it does not disappear — see §6.1).

### 6.4 Explicitly rejected consequences

This ADR does **not** endorse moving compute off Vercel, introducing a self-hosted worker fleet, making an external engine the system of record, or building an in-house workflow engine on `pg_cron`.

---

## 7. Open questions blocking final commitment

The recommendation in §5 is sound on the evidence available, but three unknowns could legitimately change it. None can be resolved from the repository.

| # | Question | Why it matters | Could it flip the decision? |
| --- | --- | --- | --- |
| Q1 | **What Vercel plan is the project on?** Not determinable from the repository or the GitHub API. | Hobby caps functions at 300 s and prohibits commercial use — and this project has live Stripe billing. Pro raises the ceiling to 800 s and unlocks the 1800 s beta. Stage S0 depends entirely on this. | Yes — if already Pro with 800 s, S0 alone may defer the whole decision by a meaningful margin. |
| Q2 | **What is the realistic monthly run volume, and how many steps does a typical Forge run take?** The loop permits up to 60 steps and 48 tool calls. | Inngest bills per execution. A 40-step run is 40 executions. At high volume this is the dominant cost term. | Yes — heavy step counts favour Vercel Workflows' event/data pricing or Upstash's cheaper model. |
| Q3 | **Is minimising vendor count an explicit owner preference?** | If yes, Vercel Workflows wins on that axis despite the Forge restructuring cost, and Option A should be adopted instead. | Yes — this is a values question, not a technical one, and only the owner can answer it. |

A secondary question worth resolving during S1 rather than now: whether `tasks` should be a single table shared by Forge, Muse, Flow and Nexus, or a shared base with per-domain detail tables. That is a data-modelling decision, not an engine decision, and it does not block this ADR.

---

## 8. Validation criteria

Whichever option is chosen, adoption is only successful if all of the following hold. These belong in the Phase 3 acceptance gates.

1. A Forge agent run **completes successfully after exceeding 300 s** of total elapsed time.
2. A run **survives a deployment mid-flight** and resumes without duplicating completed work.
3. A deliberately failed step **retries and succeeds** without replaying prior steps.
4. Cancelling a run **stops it promptly**, and the database reflects `CANCELLED`.
5. **All 11 Forge test files still pass**, unmodified in intent.
6. `forge_agent_runs` and `forge_agent_steps` remain the queryable source of truth — a run is fully reconstructable from SQL alone, with no vendor dashboard.
7. Per-user concurrency limits are enforced and demonstrable.
8. Engine cost for a representative month is measured and within an agreed budget.

---

## 9. References

Consulted 2026-09-15. Platform capabilities and pricing change; re-verify before commitment.

- Vercel Workflows — concepts, `"use workflow"` / `"use step"`, sleep, hooks, event-sourced replay, determinism constraint, multi-region, usage-based pricing. `vercel.com/docs/workflows` and `/docs/workflows/concepts`.
- Vercel Fluid compute and function duration — Hobby 300 s; Pro/Enterprise 800 s; 1800 s extended beta; `waitUntil` bounded by the same ceiling. `vercel.com/docs/fluid-compute`, `/docs/functions/configuring-functions/duration`.
- Upstash — *Durable workflow engines compared: every major option in 2026*; the "HTTP school" distinction between engines that invoke steps into your app versus engines that run their own workers.
- Upstash Workflow on Vercel/Next.js — `serve()`, `context.run` / `sleep` / `waitForEvent` / `call` / `cancel`; `QSTASH_DEV` local server.
- Comparative reviews of Inngest, Trigger.dev, Temporal and QStash for serverless TypeScript, 2026.

**Repository evidence:** `app/api/forge/conversations/[conversationId]/agent-runs/route.ts` (`maxDuration = 300`) · `lib/forge/agent-foundation.ts:4` (240 s / 60 steps / 48 tool calls) · `lib/forge/continuity-foundation.ts:49` (`confirmed: true` approval gate) · `supabase/migrations/20260824_forge_v14_agentic_execution_loop.sql` (run/step tables, one-active-run unique index) · `components/ForgeAgentRunnerPanel.tsx:19` (1500 ms polling).

---

**STATUS: PROPOSED. No implementation is authorised by this document.**
Resolve Q1–Q3, then either accept §5 or adopt Option A and revise this ADR.
