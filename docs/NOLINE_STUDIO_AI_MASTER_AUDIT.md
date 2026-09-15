# NØLINE STUDIO AI — MASTER AUDIT (PHASE 0)

**Audit type:** read-only inspection, verification and gap analysis
**Repository:** `/workspace`
**Base commit audited:** `1cffe0cfb6052470cbf34b8366d31d5bb9085c22` (`main`)
**Audit branch:** `cursor/phase-0-master-audit-e71b`
**Status legend:** `CONFIRMED` · `PARTIAL` · `MISSING` · `UNKNOWN`

> **Scope discipline.** This document describes CURRENT STATE from repository evidence only.
> TARGET STATE comes from the Phase 0 master plan. The two are never merged.
> No production system, database or deployment was touched. No secret value appears in this document.
> Environment variables are referenced **by name only**.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Exact git state](#2-exact-git-state)
3. [Current application architecture](#3-current-application-architecture)
4. [Current database / Supabase state](#4-current-database--supabase-state)
5. [Current AI / model architecture](#5-current-ai--model-architecture)
6. [Product capability matrix](#6-product-capability-matrix)
7. [Security audit](#7-security-audit)
8. [Test / build results](#8-test--build-results)
9. [Dependency findings](#9-dependency-findings)
10. [Deployment / environment map](#10-deployment--environment-map)
11. [Reusable existing work](#11-reusable-existing-work)
12. [Branch analysis](#12-branch-analysis)
13. [Gap analysis](#13-gap-analysis)
14. [Target architecture](#14-target-architecture)
15. [Security / permission gates](#15-security--permission-gates)
16. [Minimum data model evolution](#16-minimum-data-model-evolution)
17. [Phased master roadmap](#17-phased-master-roadmap)
18. [P0 blockers](#18-p0-blockers)
19. [Risks / open questions](#19-risks--open-questions)
20. [Recommended Phase 1 scope](#20-recommended-phase-1-scope)

---

## 1. EXECUTIVE SUMMARY

NØLINE Studio AI is a **single Next.js 16 App Router modular monolith** of roughly 32,000 tracked lines across 238 files and 65 commits, built since 2026-06-01. It is **not** seven separate applications, which is architecturally the right starting point. The codebase is healthy by the usual mechanical measures — lint, TypeScript and the production build all pass cleanly on `main`, and 194 of 197 tests pass (the 3 failures are a Node version artifact, not a code defect).

The essential finding is that **the product's ambition and its implementation are separated by one specific thing: a shared Core that does not yet exist.** What exists instead is three independently-grown stacks that each solved persistence, AI calling and authorization their own way:

- a **legacy marketing-content SaaS** (generators, visuals, CRM, clients, Stripe) that predates the AI-workspace vision and still owns most of the UI surface;
- **FORGE**, by far the most mature and most seriously engineered subsystem — a real agentic coding loop with Daytona sandboxes, GitHub App integration, durable run/step persistence and an explicit human-confirmation gate before any Git write;
- **NOVA**, a clean but thin conversational layer whose `Project → Conversation → Message` model is the closest thing to a Core the repository has.

Of the seven named pillars, evidence supports only three as real: **NOVA (PARTIAL)**, **FORGE (CONFIRMED, most complete)** and a **MUSE label attached to legacy functionality that is not multimodal at all**. **APEX, CREATE, FLOW and NEXUS do not exist** — APEX appears only as four disabled "Bientôt" navigation entries in `components/Shell.tsx:30-33`, and the strings `CREATE`, `FLOW` and `NEXUS` appear nowhere in `app/`, `lib/`, `src/`, `components/` or `supabase/` as product concepts. A grep for every mainstream image, video, speech or music generation API across the entire source tree returns **zero matches**, so MUSE as specified in the master plan is `MISSING` regardless of what the sidebar says.

Three findings block safe progress and should be treated as prerequisites rather than roadmap items.

**First, the Nova database tables do not exist in any applied migration.** `lib/chat/conversation-store.ts` reads and writes `projects`, `conversations` and `messages`, but those tables are defined only in `supabase/PROPOSED_001_PROJECT_CONVERSATIONS.sql`, a file whose own header says *"PROPOSITION UNIQUEMENT : ne pas exécuter sans revue"* and which is deliberately outside `supabase/migrations/`. On `main`, Nova's persistence depends on schema that the repository does not claim to have applied. This is the single largest correctness unknown in the project.

**Second, three AI endpoints execute paid OpenAI calls with no authentication at all.** `app/api/generate-agent/route.ts` and `app/api/agent-builder-v2/route.ts` contain no identity check whatsoever, and `app/api/agents/[id]/run/route.ts:54-84` deliberately skips authentication whenever the requested agent is an *official* agent. `agent-builder-v2` fans out to roughly nineteen model calls per request. Combined with the complete absence of rate limiting anywhere in the codebase, any anonymous caller can spend the project's OpenAI budget at will.

**Third, `main` carries a critical dependency vulnerability.** `npm audit` reports 9 advisories (1 critical, 6 high, 1 moderate, 1 low), the critical one being the Next.js Image-Optimization AVIF remote-code-execution class affecting all versions through 16.3.2. `main` pins `next: ^16.2.6`.

The encouraging counterpart is that **substantial, high-quality work already addresses two of these three blockers, and it is sitting unmerged on two branches.** `feat/noline-core-data-v1` contains a transactional, idempotent, self-validating Core migration plus a rewrite of the Nova data path to use the caller's JWT instead of the service-role key — closing an RLS bypass — backed by 15 new tests that run real Postgres via PGlite. `chore/security-production-readiness` patches Next.js to 16.3.3 and eight other packages to `npm audit` zero, and adds the missing `test` and `typecheck` scripts. Both branch off the current `main` tip and are one and two commits ahead respectively. Neither was merged, and per this phase's change-control rules neither was merged here. The prior author's own validation notes record an explicit **NO-GO** verdict pending a verified restorable backup and staging proof — that judgement is documented in [§12](#12-branch-analysis) and should be respected rather than overridden.

A structural theme worth naming: **the codebase consistently bypasses Row Level Security.** Every server data path — legacy, Nova and Forge — goes through `supabaseAdmin()` in `lib/supabase-server.ts:379-397` using `SUPABASE_SERVICE_ROLE_KEY`. RLS policies are defined on essentially every table and are well written, but the application never exercises them. Security therefore rests entirely on each handler remembering to filter by `user_id`. Today they do, consistently, which is genuinely good discipline. But it means RLS is defence *documented* rather than defence *in depth*, and a single omitted filter in future work becomes an IDOR. The `feat/noline-core-data-v1` branch fixes exactly this for Nova and is the correct pattern to generalise.

The recommended path is therefore not to start building pillars. It is to **land the two existing branches, close the unauthenticated-endpoint holes, and promote Nova's data model into the shared Core** — after which NOVA becomes the first pillar genuinely running on a platform, and FORGE can be migrated onto it rather than continuing to carry its own parallel `forge_*` universe.

---

## 2. EXACT GIT STATE

Captured before any command that could alter working state.

| Item | Value |
| --- | --- |
| Repository path | `/workspace` |
| Git toplevel | `/workspace` |
| Current branch at audit start | `main` |
| HEAD SHA | `1cffe0cfb6052470cbf34b8366d31d5bb9085c22` |
| HEAD subject | `fix(forge): make controlled commits runtime-safe` |
| Tracking | `main` up to date with `origin/main` |
| Working tree at audit start | **clean** — no tracked modifications, no untracked files |
| Working tree at audit end | **clean** — restored (see note below) |
| Total commits | 65 |
| First commit | `fa190b9` · 2026-06-01 · `Initial commit NOLINE AI STUDIO` |
| Sole author in recent history | `yNono57` |
| CI configuration | **MISSING** — no `.github/` directory, no workflows |

### Working-tree hygiene during the audit

Two tracked files were incidentally modified by read-only verification commands and were restored with `git checkout --`, leaving the tree clean:

- `tsconfig.tsbuildinfo` — rewritten by `tsc --noEmit` (the file is tracked despite being a build artifact; see [§9](#9-dependency-findings)).
- `next-env.d.ts` — rewritten by `next build`.

`node_modules/` was populated (`npm ci`, exit 0) and `tsx@4.20.6` was added with `npm install --no-save --no-package-lock` specifically so that the test suite could run. `package.json` and `package-lock.json` were byte-compared before and after and are **unchanged**. `.next/` was deleted after the build. No commit, no push, no branch switch that risked the tree.

### Branches

| Branch | Tip | Ahead of `main` | Behind `main` | Merge base |
| --- | --- | --- | --- | --- |
| `main` | `1cffe0c` | — | — | — |
| `origin/feat/noline-core-data-v1` | `bb9ec93` | **1** | 0 | `1cffe0c` (current tip) |
| `origin/chore/security-production-readiness` | `ce3256a` | **2** | 0 | `1cffe0c` (current tip) |
| `origin/backup/agent-builder-v2.1` | `fceea4c` | 1 | **56** | `d4a844f` |

Both active feature branches fork from the **current** `main` tip, so neither is stale and neither requires a rebase. `backup/agent-builder-v2.1` is 56 commits behind and is an explicit snapshot (`Backup complet avant Agent Builder V3`), not live work.

The owner's expectation that *"there may be work related to core data and security/production readiness on separate branches"* is **CONFIRMED by Git**, not assumed. Full analysis in [§12](#12-branch-analysis). **No branch was merged, rebased, force-pushed or checked out destructively.**

### Recent architecture / security / data commits on `main`

| SHA | Date | Subject |
| --- | --- | --- |
| `1cffe0c` | 2026-09-05 | `fix(forge): make controlled commits runtime-safe` |
| `2cc9f1a` | 2026-09-05 | `feat: add Nova web search and improve auth mobile UX` |
| `962ecdd` | 2026-08-27 | `Fix Forge controlled publishing artifact recovery` |
| `91eda3a` | 2026-08-26 | `NØLINE Forge V1.5 controlled GitHub publishing` |
| `315e532` | 2026-08-26 | `NØLINE Forge V1.5 persistent development workflow` |
| `2ab9ae3` | 2026-08-24 | `NØLINE Forge V1.4 agentic execution loop` |
| `ac38238` | 2026-08-24 | `NØLINE Forge V1.3 Daytona runtime provider` |
| `6d28b1c` | 2026-08-24 | `NØLINE Forge V1.3 workspace foundation` |
| `2171c7b` | 2026-08-20 | `NØLINE Forge V1.2 GitHub read-only integration` |

Roughly **40 of the last 45 commits are Forge**. Development attention has been almost exclusively on the coding agent since August 2026.

---

## 3. CURRENT APPLICATION ARCHITECTURE

### 3.1 Stack, verified

| Layer | Declared in prompt | Actual (repository evidence) | Status |
| --- | --- | --- | --- |
| Framework | Next.js | `next ^16.2.6`, App Router, Turbopack (`next.config.mjs:5-7`) | CONFIRMED |
| UI | React | `react 19.0.0`, `react-dom 19.0.0` | CONFIRMED |
| Language | TypeScript | `typescript 5.7.2`, `strict: true` (`tsconfig.json:12`) | CONFIRMED |
| Styling | — | `tailwindcss 3.4.17` + `postcss` + `autoprefixer` | CONFIRMED |
| Database | Supabase / PostgreSQL | Supabase PostgREST over raw `fetch` | CONFIRMED |
| Auth | Supabase Auth | `@supabase/supabase-js 2.114.0`, email/password | CONFIRMED |
| Storage | Supabase Storage "where appropriate" | **Not used anywhere** | MISSING |
| RLS | Yes | Policies exist on all tables, but **never exercised** by the app | PARTIAL |
| Payments | Stripe | Raw REST `fetch`, **no Stripe SDK** (`lib/stripe.ts`) | CONFIRMED |
| AI | AI APIs/SDKs | `openai 4.103.0`, single provider | PARTIAL |
| Sandbox | — | `@daytona/sdk 0.207.0` | CONFIRMED |
| Hosting | Vercel | `vercel.json`, `VERCEL_DEPLOYMENT.md` | CONFIRMED |
| Runtime pinning | — | **No `engines`, no `.nvmrc`, no `.node-version`** | MISSING |

TypeScript is and should remain the primary language. No Python exists in the repository and none is currently justified.

### 3.2 Code distribution

| Area | Lines | Files | Note |
| --- | --- | --- | --- |
| `components/` | 5,858 | 43 | Mostly legacy product views |
| `lib/` (total) | 5,835 | 63 | Includes `lib/forge`, `lib/chat` |
| `src/modules/` | 3,462 | 14 | Agent Builder only — the one "modern" module |
| `app/api/` (total) | 2,799 | 57 | Includes Forge and Nova routes |
| `tests/` | 2,562 | 17 | Forge-dominated |
| `lib/forge/` | 2,444 | 35 | Largest single subsystem |
| `supabase/` | 1,310 | 18 | 16 migrations + schema + proposal |
| `lib/chat/` | 796 | 8 | Nova |
| `app/api/forge/` | 586 | 29 | Thin handlers over `lib/forge` |
| `app/api/nova/` | 311 | 6 | Thin handlers over `lib/chat` |
| `docs/` | 24 | 1 | One 24-line architecture note |
| **Total tracked** | **31,914** | **238** | |

### 3.3 Three coexisting architectural generations

The repository contains three distinct styles that never converged. This is the central structural observation of the audit.

**Generation 1 — legacy marketing SaaS (June–July 2026).** Flat `lib/*.ts` modules, client components holding state, heavy `localStorage` use with Supabase as an optional upgrade. Covers generators, visuals, clients, CRM, templates, brand, history, favorites, billing. Owns most of `components/` and most page routes.

**Generation 2 — `src/modules/agent-builder` (August 2026).** A properly layered module: `components/` · `services/` · `prompts/` · `schemas/` · `types/` · `utils/`, with a `AgentBuilderGateway` interface and two implementations (`openai-agent-builder.gateway.ts`, `mock-agent-builder.gateway.ts`) injected by the route. It is the only place in the codebase that demonstrates a provider-swappable pattern, and the only place using OpenAI strict JSON-schema structured outputs. **It is also the only thing under `src/`** — the convention was established once and never reused.

**Generation 3 — `lib/forge` and `lib/chat` (August–September 2026).** A deliberate suffix-based layering convention:

| Suffix | Responsibility |
| --- | --- |
| `-foundation.ts` | Pure domain: types, limits, validation, state machines, factories. No I/O. |
| `-store.ts` | Supabase persistence via service role. `"server-only"`. |
| `-runtime.ts` | Composition/wiring: binds foundation + store + providers into exported singletons. |
| `-provider.ts` | External-system adapters (Daytona, GitHub). |
| `-client.ts` | Browser HTTP wrapper over the API routes. |

This is the **best convention in the codebase** and is the natural basis for the future Core. It is applied consistently across the workspace, runtime, github and continuity subsystems, with a few naming outliers: `agent-runtime.ts` is a wiring file (consistent in role, inconsistent in name), `runtime-runtime.ts` is awkwardly named, `forge-runtime.ts` holds legacy V1 chat contracts rather than sandbox runtime, and `forge-store.ts` is a monolith that skips the foundation/store split.

### 3.4 Server / client boundary

- **Every** `app/**/page.tsx` is a Server Component; none carries `"use client"`. Each immediately delegates to a client component (`Shell` plus a view).
- **No `middleware.ts` exists anywhere in the repository.** Verified by filesystem search.
- No route declares `export const runtime` or `export const dynamic`. The only runtime directive in the codebase is `export const maxDuration = 300` on the two long-running agent routes (`app/api/agents/[id]/workflow/route.ts`, `app/api/forge/conversations/[conversationId]/agent-runs/route.ts`).
- Server-only modules are guarded by `import "server-only"` in the Forge store layer; `SUPABASE_SERVICE_ROLE_KEY` is referenced only in `lib/supabase-server.ts` and (as a boolean presence flag) `lib/server-diagnostics.ts:43`, and never reaches a client bundle. A test in `tests/forge-agent-runner.test.ts` statically asserts no secrets appear in the bundle.

**Consequence of no middleware:** there is no server-side route protection. Pages such as `/dashboard`, `/settings`, `/generate`, `/nova` and `/forge` render for anonymous visitors; access control exists only inside API handlers and as client-side UI affordances. The pages themselves leak no data (they fetch via authenticated API calls), so this is a defence-in-depth gap rather than a direct data exposure — but it means the entire security perimeter is the API layer.

### 3.5 Route inventory

**23 page routes.** `/`, `/login`, `/auth/reset-password`, `/dashboard`, `/generate`, `/generators`, `/creations`, `/history`, `/agents`, `/agents/[id]`, `/workflows`, `/agent-builder`, `/clients`, `/crm`, `/documents`, `/templates`, `/brand`, `/presentation`, `/pricing`, `/settings`, `/nova`, `/forge`. The build reports 50 pages generated including API entries.

**57 API route files.** Grouped by subsystem:

| Group | Count | Auth posture |
| --- | --- | --- |
| `api/forge/**` | 29 | Uniform `authenticateForge` + ownership chain |
| `api/nova/**` | 6 | Uniform `authenticate()` (Bearer JWT) + ownership chain |
| `api/stripe/*` | 3 | JWT on checkout/portal; HMAC signature on webhook |
| CRM group (`crm`, `tasks`, `timeline`) | 3 | JWT required |
| Legacy content (`generate`, `history`, `creations`, `visuals`, `brand`, `account`) | 7 | JWT **when Supabase is configured** |
| Agents / workflows | 6 | Mixed — see below |
| `generate-agent`, `agent-builder`, `agent-builder-v2` | 3 | **`generate-agent` and `agent-builder-v2` have no auth** |

### 3.6 Dead and duplicated code

Confirmed unused or redundant:

| Item | Evidence |
| --- | --- |
| `components/ClientsView.tsx` | Not imported; `/clients` renders `ClientsPortfolioView` |
| `components/AccountSummary.tsx` | Not imported anywhere |
| `components/agent-builder/AgentBuilderV1.tsx` | Not imported; `/agent-builder` renders `AgentBuilderV2` |
| `app/api/agent-builder/route.ts` | One line: `export { POST } from "@/app/api/generate/route"` |
| `lib/forge/forge-tools.ts` | `FORGE_V1_ENABLED_TOOLS` is `[]` — catalog never dispatched |
| `lib/forge/forge-runtime.ts:15-16` | `forgeExecutionProvider` is `null` |
| `lib/forge/runtime-provider.ts` | `unprovisionedRuntimeProvider` stub superseded by Daytona |
| `lib/forge/workspace-provider.ts:5-11` | `metadata-only` provider — all methods return `READY` |
| `lib/ai/contracts.ts` | `AIProvider` interface has **zero implementers** |
| Dual persistence (history, CRM, agents, brand) | `localStorage` module **and** Supabase table for the same entity |

Notably, **no `TODO` or `FIXME` markers exist in `lib/forge/`**, and no `dangerouslySetInnerHTML` appears anywhere. The unfinished work is structural, not annotated.

---

## 4. CURRENT DATABASE / SUPABASE STATE

### 4.1 Sources of schema truth — there are three, and they disagree

| Source | Role | Applied? |
| --- | --- | --- |
| `supabase/migrations/` (16 files) | Intended migration chain | Partially — some marked "already applied manually in Production" |
| `supabase/schema.sql` | Legacy bootstrap, referenced by `README.md:112-114` | UNKNOWN |
| `supabase/PROPOSED_001_PROJECT_CONVERSATIONS.sql` | Nova Core schema | **Explicitly not applied** |

There is **no generated types file** (`database.types.ts` or equivalent) and no `supabase gen types` usage. All row types are hand-written, so schema drift is undetectable by the compiler.

### 4.2 Tables by migration

**`20260606_professional_ai_agents_platform.sql`** — the platform baseline: `profiles`, `subscriptions`, `agents`, `official_agents`, `clients`, `generations`, `favorites`, `usage_limits`. Plus `handle_new_user()` (SECURITY DEFINER, `search_path` correctly pinned to `''`) and the `on_auth_user_created` trigger. Seeds 5 official agents.

**Additive follow-ups:** `20260608` (client relationship context) · `20260628` (agent builder V3 columns) · `20260629` (`generations.user_id` + RLS) · `20260630` (`workflows`) · `20260701` (`crm_prospects`, `crm_tasks`, `crm_timeline`).

**Forge cluster (Aug 2026):** `github_connections` · `forge_projects` / `forge_conversations` / `forge_messages` · `forge_workspaces` · `forge_workspace_runtimes` · `forge_agent_runs` / `forge_agent_steps` · `forge_run_artifacts`, plus constraint and column refinements in `20260825_*` and `20260826_*`.

No enums are used anywhere; all constrained values are `TEXT` + `CHECK`.

### 4.3 RLS — comprehensive but unexercised

**Every table defined in the repository has `ENABLE ROW LEVEL SECURITY`.** No policy uses `using (true)`. The only intentionally public read is `official_agents` (`using (is_active = true)` for `anon, authenticated`), which is a catalog and correct.

Two policy shapes are used:

- **Legacy and Forge core tables** (`profiles`, `agents`, `clients`, `generations`, `favorites`, `workflows`, `crm_*`, `forge_projects`, `forge_conversations`, `forge_messages`) — `FOR ALL` scoped by `auth.uid()`, with ownership chained through `EXISTS` sub-selects for child tables.
- **Forge runtime tables** (`forge_workspaces`, `forge_workspace_runtimes`, `forge_agent_runs`, `forge_agent_steps`, `forge_run_artifacts`, `github_connections`) — **`FOR SELECT` only** for `authenticated`. Writes are intentionally reserved to the service role, and the migrations say so explicitly (`20260824_forge_v1_foundation.sql:2-3`, `20260824_forge_github_connection.sql:41-45`).

**The critical caveat: the application never operates as `authenticated`.** Every server data path uses `supabaseAdmin()` with the service-role key, which bypasses RLS entirely. The policies are therefore correct, well designed, and currently inert. Authorization is enforced *only* by application-level `user_id` filters, which today are applied consistently — but this is one forgotten `.eq('user_id', ...)` away from an IDOR, with no database backstop.

### 4.4 SECURITY DEFINER functions

| Function | `security definer` | `search_path` pinned | Defined where |
| --- | --- | --- | --- |
| `handle_new_user()` | Yes | **Yes** (`= ''`) in migration; **No** in `schema.sql` | Both, divergently |
| `set_updated_at()` | No (invoker) | **No** | **Only in the unapplied PROPOSED file** |
| `core_set_updated_at()` | No (invoker) | Yes (`= ''`) | Only on `feat/noline-core-data-v1` |

**`set_updated_at()` is a missing dependency in the migration chain.** Triggers in `20260824_forge_github_connection.sql`, `20260824_forge_v1_foundation.sql` and both `20260824_forge_v13_*.sql` call it, but no file under `supabase/migrations/` defines it. Its only versioned definition is in the file the project says not to execute. A clean `supabase db reset` from this repository would fail.

### 4.5 Migration hygiene

| Issue | Severity | Detail |
| --- | --- | --- |
| **Ordering hazard** | HIGH | Five files share the `20260824` prefix. Lexicographically, `20260824_forge_v1_foundation.sql` sorts **last**, yet `forge_v13_*` and `forge_v14_*` hold foreign keys to the tables it creates. A fresh apply in filename order fails. |
| **Missing function** | HIGH | `set_updated_at()` — see above. |
| **No migration ledger** | HIGH | Per the security branch's production snapshot, `supabase_migrations.schema_migrations` is **absent** in the live database. Migration state cannot be reconciled from the database. |
| **Manual drift** | MEDIUM | `20260824_forge_github_connection.sql` is annotated as already applied manually in production. |
| **`schema.sql` divergence** | MEDIUM | Defines `client_brands`, `generated_texts`, `generated_visuals`, `monthly_quotas` — none of which appear in any migration — and uses a weaker `handle_new_user()` without a pinned `search_path`. |
| Idempotency | LOW | Mixed but mostly good: heavy `IF NOT EXISTS`, `drop policy if exists`, DO blocks. |
| Destructive operations | — | **None.** No `DROP TABLE` in any migration. Constraint drops are narrowly targeted. |

### 4.6 Schema ↔ code drift

**Referenced by code, absent from migrations:**

| Table | Used by | Defined in |
| --- | --- | --- |
| `projects`, `conversations`, `messages` | `lib/chat/conversation-store.ts` (all Nova) | PROPOSED file only |
| `client_brands` | `app/api/brand/route.ts` | `schema.sql` only |
| `generated_visuals` | `app/api/visuals/route.ts`, `app/api/creations/route.ts` | `schema.sql` only |
| `generated_texts` | fallback path in `saveGeneratedText()` | `schema.sql` only |

**In migrations, never used by application code:** `official_agents` (app reads the static `lib/official-agents.ts` instead), `clients` (app uses `localStorage` via `lib/agency.ts`), `favorites` (app uses `localStorage`), `monthly_quotas` (superseded by `usage_limits`).

The clearest symptom of this uncertainty is in `lib/supabase-server.ts:136-154`, where `saveGeneratedText()` attempts one column shape, catches a schema-compatibility error, and retries with a different one. The application does not know what its own production schema looks like.

### 4.7 Supabase Storage

**MISSING — CONFIRMED.** No `storage.buckets` DDL, no `storage.objects` policies, no `.upload(`, `.storage`, `createSignedUrl` or `getPublicUrl` anywhere in TypeScript. `@supabase/storage-js` is present only transitively via `@supabase/supabase-js`. Generated visuals are persisted as raw SVG `text` columns. There is no binary asset pipeline of any kind — a hard prerequisite for MUSE, CREATE and any real Files/Artifacts subsystem.

---

## 5. CURRENT AI / MODEL ARCHITECTURE

### 5.1 Provider abstraction — aspirational, not real

`lib/ai/contracts.ts` defines exactly what a model gateway should look like: `AIMessage`, `Model`, `ModelCapabilities`, `AIModality`, `GenerationRequest`, `GenerationResult`, `GenerationChunk`, and an `AIProvider` interface with `generate()` and `stream()`.

**The `AIProvider` interface has zero implementers.** Only two files import from `contracts.ts` — `lib/forge/forge-runtime.ts` and `lib/forge/forge-openai.ts` — and both import only the message and result *types*, not the provider contract. Nova does not import it at all.

The practical consequence is **five independent, uncoordinated OpenAI call sites**:

| Call site | API used | Model env var | Default |
| --- | --- | --- | --- |
| `lib/chat/nova-openai.ts` | `responses.create` | `NOVA_MODEL` | `gpt-5.4-mini` |
| `lib/forge/forge-openai.ts` | chat completions | `FORGE_MODEL` → `OPENAI_MODEL` | `gpt-4.1-mini` |
| `app/api/generate/route.ts` | `chat.completions.create` | `OPENAI_MODEL` | `gpt-4.1-mini` |
| `app/api/generate-agent/route.ts` | `chat.completions.create` | `OPENAI_MODEL` | `gpt-4.1-mini` |
| `app/api/agents/[id]/run/route.ts` | `chat.completions.create` | `OPENAI_MODEL` | `gpt-4.1-mini` |
| `src/modules/.../openai-agent-builder.gateway.ts` | chat completions + `json_schema` | `OPENAI_MODEL` | `gpt-4.1-mini` |

There is **no capability-based routing, no fallback, no cost awareness, no latency awareness, and no provider other than OpenAI.** Nova uses a different OpenAI API surface (Responses) than everything else (Chat Completions), so even within one provider the abstraction is inconsistent.

One subtlety worth flagging: Nova persists `conversation.model_key`, but `generateNovaReply` always re-reads `getNovaModel()` from the environment. The stored model is metadata only and has no effect on inference — a trap for anyone assuming per-conversation model pinning already works.

### 5.2 Nova specifics

- **Streaming: MISSING.** `generateNovaReply` is fully awaited and the route returns complete JSON. No `ReadableStream`, no SSE, no `text/event-stream` anywhere in `lib/chat` or `app/api/nova`. The UI shows a blocking *"Nova réfléchit…"* placeholder.
- **Tools: one, and it is provider-native.** `nova-web-search.ts:49-58` passes `tools: [{ type: "web_search" }]` with `max_tool_calls: 3` to the OpenAI Responses API. There is **no general function-calling loop** and no custom tool registry. The `TOOL` message role exists in the type union and is never written.
- **Prompt-injection posture is thoughtfully handled for a v1.** `NOVA_WEB_INSTRUCTION` explicitly instructs that web content is untrusted data and never an instruction, and forbids transmitting secrets to the web. `nova-web-metadata.ts:60-74` sanitises URLs for display (rejects non-`http(s)`, strips tracking parameters). Residual risk is normal model-compliance risk.
- **SSRF: low.** The application never fetches a user-supplied URL; OpenAI performs the browsing server-side.
- **Safety:** `nova-safety.ts:16-28` is a regex pre-classifier returning `ALLOW` / `ALLOW_WITH_BOUNDARY` / `REFUSE`, injected as a second system message. It shapes the prompt; it does not block the API call.
- **Idempotency:** the messages route accepts a `user_message_id` and returns the cached assistant pair on retry — a genuinely good detail. The branch documentation notes that *concurrent* duplicate generation is still possible.

### 5.3 Structured outputs

Only `src/modules/agent-builder` uses them, via OpenAI `response_format: { type: "json_schema", strict: true }` with per-task schemas in `agent-builder.schemas.ts` (19 tasks). Forge has an optional `json_object` mode. Nova and all legacy paths return free text.

The Agent Builder prompt system resolves through a fallback chain — V4 (10 deliverable tasks) → V3 (5 expert tasks) → V2 base (5 core tasks). **All three layers are live**; none is dead code, contrary to what the version numbering suggests.

### 5.4 Usage and cost tracking

| Path | Tokens captured | Persisted | Cost computed |
| --- | --- | --- | --- |
| Nova | **Yes** | Yes, into `messages.metadata.usage` | No |
| Forge agent runs | No | No | No |
| `/api/generate` | No | Generation *count* only, via `usage_limits` | No |
| `/api/generate-agent` | No | No | No |
| `/api/agents/[id]/run` | No | No | No |
| Agent Builder V2 (~19 calls/request) | No | No | No |

Nova is the only path that captures token usage, and it is never aggregated, displayed or billed. **No cost attribution exists anywhere.** Given that the roadmap targets expensive media generation and autonomous multi-agent missions, this is a foundation that must be laid before those workloads scale, not after.

### 5.5 FORGE — the agent runtime that already exists

This is the most valuable asset in the repository and deserves precise description.

**Run lifecycle:** `QUEUED → PLANNING → RUNNING ⇄ VALIDATING → COMPLETED | FAILED | CANCELLED`, defined in `lib/forge/agent-foundation.ts:5` and mirrored by a DB `CHECK` constraint.

**Persistence:** runs in `forge_agent_runs`, steps in `forge_agent_steps`, artifacts in `forge_run_artifacts`. A partial unique index enforces one active run per runtime at the database level — good.

**Budgets and limits** (`agent-foundation.ts:4`, `agent-limits.ts:1`): 60 max steps (DB-enforced 1–60), 48 max tool calls, 240 s max wall clock, 60 s command timeout, 50,000-character objective (DB-enforced). File reads capped at 250,000 chars, command output at 1 MB, diffs at 200,000 chars.

**The eight active agent tools** are defined in `agent-foundation.ts`, *not* in `forge-tools.ts`: `list_files`, `read_file`, `write_file`, `delete_file`, `run_command`, `git_status`, `git_diff`. `read_file` blocks sensitive paths; `run_command` applies a deny-list covering shells, network tools (`curl`, `wget`, `ssh`), infrastructure CLIs, `git` itself, and dangerous npm subcommands.

**Sandbox:** Daytona ephemeral sandboxes with `ttlMinutes: 60`, cloned at a pinned `baseCommitSha` with HEAD verification, and explicit post-clone verification that no credential leaked into the git remote or config. Commands are shell-quoted via `quoteSandboxArgument`.

**Git safety model — genuinely well designed.** The agent is *forbidden* from committing or pushing. All Git writes go through a separate, user-driven continuity pipeline in `continuity-foundation.ts` requiring `confirmed: true` per operation, restricted to `forge/*` branches, with `main`/`master` explicitly blocked, and PR creation gated on a prior successful push. GitHub auth is a **GitHub App** issuing short-lived installation tokens; `github_connections` stores installation metadata and **no tokens at all**.

**The decisive architectural limitation: execution is synchronous inside the HTTP request.** The POST handler awaits the entire agent loop, bounded by `export const maxDuration = 300`. There is no queue, no worker, no durable scheduler. Run *state* is durable in Supabase and the client polls every 1500 ms, so a browser refresh does not lose history — but if the serverless invocation dies, the run dies with it. This is the single hardest constraint on FLOW, NEXUS and any long-lived task work, and it cannot be papered over.

### 5.6 Two parallel tool systems

`lib/forge/forge-tools.ts` declares a 14-entry catalog with a proper risk taxonomy — `READ` / `WRITE` / `EXECUTE` / `DESTRUCTIVE` / `REMOTE` plus a `requiresApproval` flag. It is **completely inert**: `FORGE_V1_ENABLED_TOOLS` is `[]` and `forgeExecutionProvider` is `null`. The live agent uses a separate hard-coded tool set with no approval mechanism and no permission enum.

The dormant catalog is nonetheless **the best existing sketch of the target tool contract** and should be the starting point for the platform tool layer rather than being deleted.

---

## 6. PRODUCT CAPABILITY MATRIX

Classification rule applied strictly: a placeholder page, a navigation label, a type definition or a filename **does not** count as implementation.

| Area | Status | Evidence |
| --- | --- | --- |
| **AI Core** (shared platform) | **MISSING** | No shared core module exists. Three parallel stacks: legacy `lib/*`, `lib/chat` (Nova), `lib/forge`. `lib/ai/contracts.ts` has zero implementers. |
| **Projects** | **PARTIAL** | Two unrelated implementations: `projects` (Nova, `lib/chat/conversation-store.ts`) — **tables not in any applied migration**; and `forge_projects` (`20260824_forge_v1_foundation.sql`). Not unified, not a shared context object. |
| **Conversations** | **PARTIAL** | `conversations` (Nova, unapplied schema) and `forge_conversations` (applied). Duplicated model. |
| **Messages** | **PARTIAL** | `messages` (Nova, unapplied) and `forge_messages` (applied). Nova adds retry idempotency via `user_message_id`. |
| **NOVA** | **PARTIAL** | Real: `lib/chat/*` (796 lines), 6 API routes, `components/NovaWorkspace.tsx`, safety layer, OpenAI web search, usage capture, 3 test files. Missing: streaming, project context injection, files, memory, tools beyond web search, artifacts, task creation, delegation. |
| **FORGE** | **PARTIAL (most complete pillar)** | Real: 2,444 lines in `lib/forge`, 29 API routes, 6 migrations, 11 test files, Daytona sandboxes, GitHub App, agentic loop with 8 tools, durable run/step persistence, user-confirmed Git publication. Missing: durable background execution, approval UI for writes, permission model, cost tracking. |
| **APEX** | **MISSING** | Four disabled `future: true` nav entries in `components/Shell.tsx:30-33`, all rendering "Bientôt". No route, no API, no lib, no table. |
| **MUSE** | **MISSING** | Nav label maps to `/generate` and `/creations` — the legacy text generator and SVG store. A repository-wide grep for `images.generate`, `dall-e`, `gpt-image`, `audio.speech`, text-to-speech, video, Replicate, fal.ai, ElevenLabs and Stability returns **zero matches**. No image, video, voice or music generation exists. |
| **CREATE** | **MISSING** | `components/VisualCreator.tsx` + `lib/visuals.ts` are a template-driven **SVG composer**: 3 fixed formats, colour/style presets, logo and background upload as data URLs, editable text fields, PNG/PDF export. No layers, no z-index, no undo/redo, no history, no canvas state model, no drag-and-drop, no Brand Kits. |
| **FLOW** | **MISSING** | `lib/workflows.ts` is types + `normalizeWorkflow` only. `/api/workflows` is CRUD. The only execution is `/api/agents/[id]/workflow`: **four hard-coded sequential OpenAI calls** inside one HTTP request. No triggers, schedules, conditions, branches, loops, variables, webhooks, retries or connector nodes. |
| **NEXUS** | **MISSING** | String appears nowhere in the codebase. |
| **Model Gateway** | **MISSING** | `lib/ai/contracts.ts` types only, zero implementers. Five uncoordinated OpenAI call sites, no routing, no fallback, no capability model. |
| **Memory** | **MISSING** | No memory table, module or retrieval logic. Nova context is the last 40 conversation turns. |
| **Files** | **MISSING** | Supabase Storage unused. No upload endpoint, no file table, no binary pipeline. Images are data URLs in request bodies; visuals are SVG text columns. |
| **Artifacts** | **PARTIAL (Forge-only)** | `forge_run_artifacts` stores git patches with publication/restore state (`20260825_forge_run_artifacts.sql`, `20260826_*`). Real and well-modelled, but exclusively a Forge git-diff artifact — not a general project artifact. |
| **Tasks / Jobs** | **MISSING** | No queue, no worker, no job table, no scheduler, no cron. `forge_agent_runs` is the closest analogue but is tied to one HTTP request. `crm_tasks` is CRM to-dos, unrelated. |
| **Agent Runtime** | **PARTIAL (Forge-only)** | A genuine run lifecycle, step budget, recovery phases, cancellation and validation gates exist — but only for Forge, only synchronously, and not reusable by another agent. |
| **Tools** | **PARTIAL (Forge-only)** | 8 live hard-coded agent tools. A dormant 14-entry risk-tagged catalog in `forge-tools.ts` (`FORGE_V1_ENABLED_TOOLS = []`). No shared registry, no schemas, no permission enforcement. |
| **Connectors** | **PARTIAL** | Exactly two: GitHub App (`lib/forge/github-*.ts`) and Daytona (`lib/forge/daytona-*.ts`). Both are well built and Forge-specific. No connector framework, no credential vault. |
| **Organizations** | **MISSING** | No `organizations`, `memberships` or `teams` table. Every entity is keyed directly to `auth.users`. |
| **Permissions / RBAC** | **MISSING** | No roles beyond Supabase `anon`/`authenticated`/`service_role`. No admin flag. The `READ`/`WRITE`/`EXECUTE`/`DESTRUCTIVE`/`REMOTE` taxonomy exists only in dead code. |
| **Usage** | **PARTIAL** | `usage_limits` counts generations for `/api/generate` only. Plan limits hard-coded in `lib/supabase-server.ts:15-20`. Nova stores token usage but never aggregates it. Four AI endpoints are entirely unmetered. |
| **Billing** | **PARTIAL** | Stripe checkout, customer portal and webhook all work; HMAC signature verified with `timingSafeEqual` (`lib/stripe.ts:60-79`). Gaps: no webhook timestamp tolerance (replay window), plan derivation from `checkout.session.completed` may not resolve a price id, quota enforcement limited to one endpoint, quota increment not atomic. |
| **Observability** | **PARTIAL** | `lib/server-diagnostics.ts` emits structured JSON to `console.error`; used by three routes. No error tracker, no analytics, no tracing, no metrics, no correlation ids. |
| **Admin** | **MISSING** | No `/admin` route, no role check, no control plane of any kind. |

---

## 7. SECURITY AUDIT

### 7.1 Findings by severity

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| S1 | **CRITICAL** | Next.js `^16.2.6` carries an unpatched RCE class (Image Optimization / AVIF) plus 10 further advisories. | `npm audit`; `package.json:14` |
| S2 | **CRITICAL** | `/api/generate-agent` performs paid OpenAI calls with **no authentication**. | No `getUserFromRequest` in the file |
| S3 | **CRITICAL** | `/api/agent-builder-v2` performs ~19 OpenAI calls per request with **no authentication**. | No `getUserFromRequest` in the file |
| S4 | **CRITICAL** | `/api/agents/[id]/run` **skips authentication entirely for official agents**. | `app/api/agents/[id]/run/route.ts:54-84` — auth is only required when `!officialAgent` |
| S5 | **HIGH** | **No rate limiting on any route** in the codebase. Amplifies S2–S4 into unbounded spend. | Repository-wide search |
| S6 | **HIGH** | Nova's tables exist only in an unapplied proposal; production schema state is unverified. | `PROPOSED_001_PROJECT_CONVERSATIONS.sql` vs `supabase/migrations/` |
| S7 | **HIGH** | RLS is universally bypassed — every server path uses the service role. | `lib/supabase-server.ts:379-397`; all `*-store.ts` |
| S8 | **HIGH** | Session tokens stored in `localStorage`; any XSS yields full account takeover. | `lib/supabase-client.ts:6,28-40` |
| S9 | **HIGH** | No `middleware.ts`; zero server-side route protection. | Filesystem search |
| S10 | **HIGH** | Quota enforcement covers only `/api/generate`; four AI endpoints are unmetered. | `app/api/generate/route.ts:51-59` |
| S11 | **HIGH** | Quota increment is read-check-write with no atomicity — concurrent requests exceed limits. | `lib/supabase-server.ts:109-120` |
| S12 | **MEDIUM** | Stripe webhook verifies HMAC but enforces **no timestamp tolerance** — replay is possible. | `lib/stripe.ts:60-79` |
| S13 | **MEDIUM** | Direct runtime command route applies only format validation, **not** the agent deny-list, so an authenticated user can run `curl`/`wget` in a sandbox. | `.../workspace/runtime/command/route.ts` vs `agent-foundation.ts:44` |
| S14 | **MEDIUM** | When Supabase is unconfigured, `/api/generate` is fully open. | `app/api/generate/route.ts:34-61` |
| S15 | **MEDIUM** | `/api/visuals` and `/api/brand` accept unbounded SVG / base64 payloads. | Both route files |
| S16 | **MEDIUM** | `PATCH /api/tasks` scopes by `user.id` but does not re-verify parent prospect ownership. | `app/api/tasks/route.ts:30-35` |
| S17 | **MEDIUM** | `set_updated_at()` is unpinned `search_path`; `handle_new_user()` is executable by `PUBLIC`/`anon`/`authenticated`. | Addressed by the security branch proposal |
| S18 | **LOW** | Free-plan quota advertised as 5 in the UI, enforced as 20 in code. | `app/pricing/page.tsx:10` vs `lib/supabase-server.ts:16` |
| S19 | **LOW** | No `engines` / `.nvmrc`; Node version unpinned across dev, CI and Vercel. | `package.json` |

### 7.2 Positive security findings

These are real and should not regress:

- **No route trusts a client-supplied user identifier.** Every authenticated handler derives identity from `getUserFromRequest` (a verified Supabase Auth call) and scopes queries by that id. This is the single most common serious flaw in comparable codebases and it is absent here.
- **The service-role key never reaches a client bundle**, and a test asserts it statically.
- **Forge's Git write model is exemplary**: the agent cannot commit or push; every Git write requires explicit per-operation `confirmed: true`; `main`/`master` are blocked; branches are restricted to `forge/*`.
- **No GitHub tokens are persisted** — only installation metadata. Tokens are short-lived and in-memory.
- **Secret redaction** is implemented in agent output, continuity output and OpenAI error logging.
- **Command injection is mitigated** in the Daytona path via explicit argument quoting.
- **No `dangerouslySetInnerHTML`** anywhere. No custom CORS. No open redirects.
- **RLS policies themselves are well written** — correctly `auth.uid()`-scoped, with proper `EXISTS` ownership chains and no permissive `using (true)`.

### 7.3 Security posture summary

The perimeter is thinner than the interior. Once a request is authenticated, the code is careful and consistent. The problems are at the boundary: three endpoints have no boundary at all, there is no rate limiting, and the database's own protections are switched off by the service role. Fixing the boundary is cheap relative to its value.

---

## 8. TEST / BUILD RESULTS

All commands run locally against `main` @ `1cffe0c`. Nothing touched external or production state.

| Command | Result | Detail |
| --- | --- | --- |
| `npm ci` | **PASS** (exit 0) | 558 packages in ~10 s |
| `npm run lint` | **PASS** (exit 0) | `eslint .` — zero errors, zero warnings |
| `npx tsc --noEmit` | **PASS** (exit 0) | `strict: true`, zero errors |
| `node --import tsx --test tests/*.test.ts` | **FAIL** (exit 1) | **194 pass / 3 fail** of 197, across 17 files |
| `npm run build` | **PASS** (exit 0) | Next 16 + Turbopack, 50 pages, all 57 API routes compiled |
| `npm audit` | **9 vulnerabilities** | 1 critical, 6 high, 1 moderate, 1 low |

### The three test failures are environmental, not code defects

All three failing files — `tests/auth-flow.test.ts`, `tests/nova-web-search-failure.test.ts`, `tests/nova-web-search-v1.test.ts` — and **only** those three call `module.registerHooks()`. Verified directly:

```
Node v22.14.0 → typeof module.registerHooks === "undefined"
```

`module.registerHooks()` landed in Node **22.15.0**. This environment runs 22.14.0. The 14 files that do not use the API all pass. The prior author's branch notes record 217 passing on Node 24.15.0, consistent with this explanation.

**No code change was made to "fix" this**, per Phase 0 rules. It is reported as-is. The underlying defect is process, not product: **the repository pins no Node version** (no `engines`, no `.nvmrc`, no `.node-version`) and has **no CI** (`.github/` does not exist), so nothing prevents this drift.

### Test infrastructure gap on `main`

`package.json` on `main` has **no `test` and no `typecheck` script** — only `dev`, `build`, `start`, `lint`. The 17 test files and 2,562 lines of test code are effectively unrunnable from a clean checkout. `tsx` had to be installed out-of-band to execute them for this audit. **`chore/security-production-readiness` adds both scripts**, which alone makes it worth landing.

### Coverage assessment

| Area | Files | Assessment |
| --- | --- | --- |
| Forge | 11 | **Strong.** Agent loop, completion gates, validation recovery, Daytona quoting/provisioning, workspace idempotence, continuity gates, publication confirmation, sensitive-file blocking, real-git integration via `spawnSync`, UI helpers, route-auth static analysis. |
| Nova | 3 | **Moderate.** Safety classifier, web-search request construction, source dedup, usage parsing, failure fallback. |
| Legacy product | 2 | **Weak.** `auth-flow`, `mobile-navigation` — both static source inspection. |
| Agent Builder (`src/`) | 0 | **None**, despite being 3,462 lines. |
| Billing / Stripe | 0 | **None** — webhook signature verification is untested. |
| RLS / database | 0 on `main` | **None on `main`.** `feat/noline-core-data-v1` adds 15 real PGlite tests covering RLS A/B isolation, cascades, reparenting attacks and migration idempotency — the most valuable test asset in the project. |
| Quota / usage | 0 | **None** — the known race is unguarded. |

Most critical missing coverage, in order: RLS/authorization enforcement (exists only on the unmerged branch), Stripe webhook verification, quota concurrency, and the entire Agent Builder module.

---

## 9. DEPENDENCY FINDINGS

### 9.1 Runtime dependencies — only 7, which is a genuine strength

| Package | Version | Note |
| --- | --- | --- |
| `next` | `^16.2.6` | **Critical advisories** — see below |
| `react` / `react-dom` | `19.0.0` | Pinned |
| `@supabase/supabase-js` | `2.114.0` | Used for **Auth only**; all data access is raw `fetch` to PostgREST |
| `openai` | `4.103.0` | Sole AI provider |
| `@daytona/sdk` | `0.207.0` | Sandbox execution |
| `lucide-react` | `0.468.0` | Icons |

No state manager, no data-fetching library, no ORM, no validation library (Zod or equivalent), no rate-limit library, no error tracker, no job queue. Input validation is hand-written throughout. The small surface is admirable; the missing validation and queue libraries are real gaps for the roadmap ahead.

### 9.2 `npm audit` on `main` — 9 advisories

| Package | Severity | Summary |
| --- | --- | --- |
| `next` ≤ 16.3.2 | **CRITICAL** | Unauthenticated RCE via Image Optimization AVIF; unauthenticated RCE on Windows hosts; middleware/proxy bypass with Turbopack + single locale; SSRF in rewrites and Server Actions; cache confusion; Server Action DoS; internal Server Function endpoint disclosure |
| `sharp` ≤ 0.35.4-rc.0 | HIGH | Inherited libvips and libheif CVEs (reachable via Next image optimizer) |
| `postcss` ≤ 8.5.22 | HIGH | `sourceMappingURL` path traversal → arbitrary `.map` disclosure |
| `brace-expansion` | HIGH | Three DoS advisories (ESLint chain) |
| `browserslist` ≤ 4.28.6 | HIGH | Unbounded memory growth; prototype write via untrusted stats |
| `js-yaml` 4.0.0–4.3.1 | HIGH | Quadratic CPU via merge keys and `!!omap` |
| `nanoid` ≤ 3.3.17 | HIGH | Infinite loop on negative/zero size (PostCSS chain) |
| `postcss-selector-parser` 6.1.0–6.1.2 | MODERATE | Uncontrolled AST recursion (Tailwind chain) |
| `baseline-browser-mapping` | LOW | Crash on invalid input |

`chore/security-production-readiness` resolves **all nine** to `npm audit` zero (`next` → `16.3.3` pinned, `postcss` → `8.5.23`, plus transitive bumps) and pins previously floating ranges. Per Phase 0 rules **no dependency was upgraded during this audit.**

### 9.3 Structural dependency observations

| Observation | Impact |
| --- | --- |
| No runtime schema validation library | Every route hand-parses `unknown`. Correct today, but does not scale to a tool-contract layer. |
| Supabase client used for Auth only | 3,000+ lines of hand-rolled PostgREST URL building; no typed query layer; no generated types. |
| No job queue | Hard blocker for FLOW, NEXUS and durable tasks. |
| No rate-limit primitive | Directly enables S5. |
| No error tracker | Production failures are only visible as Vercel console output. |
| `tsconfig.tsbuildinfo` is **tracked in git** | A 128 KB build artifact that dirties the tree on every typecheck. Should be gitignored. |
| Node version unpinned | Root cause of the 3 test failures. |
| No CI | Nothing enforces lint, typecheck, tests or audit on any change. |

---

## 10. DEPLOYMENT / ENVIRONMENT MAP

> **Environment variables are listed BY NAME ONLY. No value was read, printed or inferred.**
> `.env`, `.env.local` and all `.env.*.local` files are gitignored (`.gitignore:13-17`); only `.env.example` and `.env.local.example` are tracked, and both contain placeholders only.

### 10.1 Deployment configuration — CONFIRMED

| Item | Value | Source |
| --- | --- | --- |
| Platform | Vercel | `vercel.json:2` |
| Framework preset | `nextjs` | `vercel.json` |
| Install command | `npm install` | `vercel.json` |
| Build command | `npm run build` | `vercel.json` |
| Output directory | default | `vercel.json` |
| `reactStrictMode` | `true` | `next.config.mjs:3` |
| Bundler | Turbopack, root `process.cwd()` | `next.config.mjs:5-7` |
| Dist dir | `NEXT_DIST_DIR` or `.next` | `next.config.mjs:4` |
| Stripe webhook path | `/api/stripe/webhook` | `README.md:138` |
| Stripe events | `checkout.session.completed`, `customer.subscription.{created,updated,deleted}` | `README.md:141-146` |
| Max function duration | 300 s on two agent routes | route files |
| CI/CD | **MISSING** — no `.github/` | filesystem |

### 10.2 Environment variable names

**AI:** `OPENAI_API_KEY` · `OPENAI_MODEL` · `NOVA_MODEL` · `FORGE_MODEL` · `NOVA_AB_MODELS` · `NOVA_DEBUG_PROMPT` · `USE_MOCK`

**Supabase:** `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`

**Stripe:** `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_STARTER_PRICE_ID` · `STRIPE_PRO_PRICE_ID`

**GitHub App (Forge):** `GITHUB_APP_ID` · `GITHUB_APP_SLUG` · `GITHUB_APP_PRIVATE_KEY` · `GITHUB_APP_STATE_SECRET`

**Sandbox:** `DAYTONA_API_KEY`

**Application / platform:** `NEXT_PUBLIC_APP_URL` · `NEXT_DIST_DIR` · `NODE_ENV` · `VERCEL_ENV` · `VERCEL_DEPLOYMENT_ID`

**Observation:** `.env.example` documents only 11 of these ~24 names. Forge's GitHub App and Daytona variables — required for the most advanced subsystem in the product — are **entirely undocumented**. A fresh environment cannot be provisioned from the repository.

### 10.3 Environment state — UNKNOWN, and deliberately left so

Whether the production Supabase project has the Nova Core tables, which migrations were applied manually, the live Vercel project and domain, and the actual configured variable values are all **UNKNOWN from repository evidence**. The security branch's documentation makes production claims (Core absent, 4 security-advisor warnings, Free plan, no migration ledger, row fingerprint 3/9/55), but those are *branch documentation*, not independently verified here, and are reported as such.

**No production inspection, deployment or mutation was performed.** To resolve these would require read-only access to the Vercel project and the Supabase project — which must be an explicit, separately authorised step.

---

## 11. REUSABLE EXISTING WORK

A primary objective of Phase 0 is to avoid rebuilding valid work. The following is explicit guidance.

### 11.1 KEEP — preserve and build on

| Asset | Why |
| --- | --- |
| **Forge layering convention** (`-foundation` / `-store` / `-runtime` / `-provider` / `-client`) | The best structural idea in the codebase. Should become the Core convention. |
| **Forge agent loop** (`agent-foundation.ts`) | A real, tested agentic runtime: lifecycle states, step budgets, validation recovery phases, completion gates, cooperative cancellation. Do not rewrite. |
| **Forge Git safety model** (`continuity-foundation.ts`) | Per-operation `confirmed: true`, `forge/*`-only branches, `main`/`master` blocked, PR gated on push. This is the human-in-the-loop template for the whole platform. |
| **GitHub App integration** | Short-lived installation tokens, zero token persistence, signed OAuth state. Correct by design. |
| **Daytona provider** | Working sandbox isolation with TTL, pinned commit clone, credential-leak verification, argument quoting. |
| **Forge RLS policies and ownership chains** | Correct `EXISTS`-chained policies. Must not regress. |
| **Nova safety and web-search layer** (`nova-safety.ts`, `nova-web-search.ts`, `nova-web-metadata.ts`) | Untrusted-data prompt discipline and URL sanitisation, with tests. |
| **Nova retry idempotency** (`user_message_id`) | Subtle, correct, easy to lose in a rewrite. |
| **Stripe HMAC verification** (`lib/stripe.ts:60-79`) | `timingSafeEqual`, correct App Router raw-body handling. Needs only a timestamp tolerance. |
| **`handle_new_user()` migration version** | SECURITY DEFINER with `search_path` pinned. Keep this one, not the `schema.sql` variant. |
| **All 11 Forge test files** | 2,562 lines of genuine behavioural coverage including real-git integration. |
| **Agent Builder gateway pattern** (`src/modules/agent-builder/services/`) | The only provider-swappable abstraction that actually works. Template for the Model Gateway. |
| **Agent Builder JSON schemas** | Working strict structured outputs — directly reusable for tool contracts. |

### 11.2 EXTEND — good foundation, needs generalising

| Asset | Extension |
| --- | --- |
| `lib/ai/contracts.ts` | Implement it. The types are sound; they need a real `AIProvider` and a registry. |
| `lib/forge/forge-tools.ts` risk taxonomy | Inert today, but the right shape. Promote to the platform tool contract with schemas and enforcement. |
| `forge_agent_runs` / `forge_agent_steps` | Generalise to `agent_runs` / `agent_steps` usable by any agent. |
| `forge_run_artifacts` | Generalise from git-patch artifacts to project artifacts. |
| Nova `projects` / `conversations` / `messages` | Promote to the shared Core model that Forge also uses. |
| `usage_limits` | Extend from generation counts to token/cost attribution. |
| `lib/server-diagnostics.ts` | Extend into real structured observability with run and trace correlation. |

### 11.3 REFACTOR — eventually, not now

Dual `localStorage`/Supabase persistence (history, CRM, agents, brand, favorites, clients); the three coexisting architectural generations; `forge-store.ts` monolith; `runtime-runtime.ts` naming; `schema.sql` versus the migration chain; the 5 duplicated OpenAI call sites.

### 11.4 DEAD CODE CANDIDATES — do not delete during Phase 0

`components/ClientsView.tsx` · `components/AccountSummary.tsx` · `components/agent-builder/AgentBuilderV1.tsx` · `app/api/agent-builder/route.ts` · `lib/forge/runtime-provider.ts` (`unprovisionedRuntimeProvider`) · `lib/forge/workspace-provider.ts` (`metadata-only`) · `monthly_quotas` table.

Each needs a confirmation pass before removal; several are fallbacks that may be load-bearing in unconfigured environments.

### 11.5 EXPERIMENTAL WORK WORTH PRESERVING

`lib/chat/nova-ab.ts` plus `scripts/nova-model-ab.mjs` — an offline model A/B evaluation harness with regex quality dimensions. Not wired to production, and it uses Chat Completions while production Nova uses the Responses API, so results are not directly comparable. The *idea* is valuable for Model Gateway routing decisions and should be kept and aligned, not deleted.

### 11.6 SECURITY WORK THAT MUST NOT REGRESS

Server-side identity derivation on every authenticated route · service-role key confined to server modules (with a static test) · Forge agent prohibition on commit/push · per-operation publication confirmation · zero GitHub token persistence · secret redaction in agent and error output · command deny-list and shell-argument quoting · sensitive-path blocking in reads and patches · `search_path` pinning on `handle_new_user()` · every RLS policy currently defined.

---

## 12. BRANCH ANALYSIS

**No branch was merged. No branch was rebased, force-pushed or modified.** Inspection used `git show` and `git diff` against remote refs only.

### 12.1 `origin/feat/noline-core-data-v1`

| Field | Value |
| --- | --- |
| **Tip** | `bb9ec93` — `feat(core): migrate conversation data and enforce user-scoped RLS` |
| **Relation to main** | 1 ahead, 0 behind. Forks from the current `main` tip. |
| **Size** | 17 files, +1,347 / −79 |
| **Purpose** | Make the Nova Core schema real and enforce RLS on the Nova data path |

**Contents:**

- `supabase/migrations/20260911204606_noline_core_data_v1.sql` (+280) — a transactional migration creating `projects`, `conversations`, `messages`. It validates existing column types, nullability and primary keys before mutating; refuses incompatible foreign keys or unknown permissive policies; applies 12 per-operation RLS policies; revokes `PUBLIC`/`anon` and grants scoped CRUD to `authenticated`; sets lock and statement timeouts; issues `NOTIFY pgrst, 'reload schema'`. It is idempotent and aborts the whole transaction on any mismatch. It performs **no backfill and no deletion**.
- `lib/chat/core-supabase.ts` (+25) — a `server-only` transport using the anon key plus the **caller's** Bearer token, with no service-role access and no upstream error detail leaked.
- `lib/chat/conversation-store.ts` (±134) — converted from `userId: string` + service role to `user: CoreIdentity` + user JWT. Adds UUID and enum validation; adds `user_id` filters to updates and deletes; converts a now-unreachable write into a `NOT_FOUND` rather than a silent success.
- `app/api/nova/_shared.ts` and the five Nova route files — pass verified identity through; stricter UUID validation; logs without database detail.
- `tests/core-data-migration.test.cjs` (+118) — 7 PGlite scenarios: fresh creation, replay idempotency, CRUD and cascades, A/B RLS isolation including reparenting attacks, upgrade from the PROPOSED schema with rows preserved and Forge's `set_updated_at()` untouched, atomic abort on incompatible schema, abort on unknown permissive policy, abort on invalid legacy data.
- `tests/core-nova.test.cjs` (+165) — 8 scenarios against the real handlers: auth before any DB access, no service-role key present, identity from auth not body, cross-user 404 with no mutation, payload validation, message ordering, retry idempotency, 502 on generation failure, and a TOCTOU case where ownership changes between check and mutation.
- `package.json` / `eslint.config.mjs` — adds `test` and `typecheck` scripts, `server-only`, `tsx`, PGlite.
- `docs/CORE_DATA_V1.md` (+72) — thorough contract, limits and pre-deployment documentation.

**Value: very high.** It resolves the project's single largest correctness unknown (S6) and its most important structural weakness (S7, for Nova), and it introduces the only real database-level test coverage in the project. Its careful approach — separate `core_set_updated_at()` so Forge's shared function is not replaced, refusal to invent owners or repair data silently — indicates the author understood the production risk well.

**Integration risk: MEDIUM**, and entirely operational rather than technical:

1. The migration **must be applied before** the code that depends on RLS is deployed, or every Nova request fails.
2. The live database has **no migration ledger**, so the CLI cannot reconcile state — the branch's own runbook requires an isolated deployment directory.
3. The duplicate `20260824_*` prefix ordering hazard still blocks any global `db reset`.
4. `package.json` and the lockfile **conflict with the security branch** — detected by the prior author via `merge-tree` and documented in both branches.
5. Forge and all other subsystems still require the service role; the key cannot be removed.

**Recommended next action:** Land **after** the security branch to keep the dependency conflict one-directional. Before applying: obtain read-only access to the real Supabase project, run `supabase/core-data-preflight.sql`, take a verified backup, rehearse on a copy, then apply the migration and only then deploy the code. **Do not merge without owner authorisation.**

### 12.2 `origin/chore/security-production-readiness`

| Field | Value |
| --- | --- |
| **Tip** | `ce3256a` — `docs(security): prepare Supabase hardening and production runbook` |
| **Parent** | `b8b712f` — `fix(security): patch Next.js and vulnerable dependencies` |
| **Relation to main** | 2 ahead, 0 behind. Forks from the current `main` tip. |
| **Size** | 11 files, +1,707 / −245 |
| **Purpose** | Eliminate dependency vulnerabilities and prepare (not apply) Supabase function hardening |

**Contents:**

- **Dependency patch** — `next` `^16.2.6` → `16.3.3` (pinned), `eslint-config-next` → `16.3.3`, `postcss` → `8.5.23`, `sharp` → 0.35.4, plus `baseline-browser-mapping`, `browserslist`, `brace-expansion`, `js-yaml`, `nanoid`, `postcss-selector-parser`. Adds `tsx 4.20.6` as a devDependency. Result: **`npm audit` clean, exit 0.**
- **Missing scripts** — adds `"typecheck": "tsc --noEmit"` and `"test": "node --import tsx --test tests/*.test.ts"`. This alone makes the 17 test files runnable from a clean checkout.
- `supabase/proposals/20260912084200_security_function_hardening.sql` — deliberately placed under `proposals/`, **not** `migrations/`. Pins `set_updated_at()`'s `search_path`; revokes `EXECUTE` on `handle_new_user()` from `PUBLIC`/`anon`/`authenticated` while granting it to `supabase_auth_admin`. Includes preflight body-hash checks and aborts on Auth-trigger drift.
- `supabase/proposals/verify-security-functions.mjs` — 8 PGlite checks rehearsing the proposal: signup simulation, seven historical update triggers, ACL behaviour, replayability, rollback on inherited ACL surprises, and body-drift detection.
- `scripts/security/core-readiness-snapshot.sql` — a **READ ONLY** transaction ending in `ROLLBACK`, producing a JSON snapshot of row counts and fingerprints, orphan checks, policies, triggers, functions, grants and role flags.
- Five documents under `docs/security/`: `supabase-readiness.md`, `npm-remediation.md`, `core-production-runbook.md`, `validation.md`, `runtime-compatibility.md`.

**Value: very high and low-risk.** The dependency patch resolves the only CRITICAL finding in this audit (S1). The two added npm scripts fix the test-infrastructure gap. The SQL is correctly quarantined as a proposal rather than smuggled into the migration chain.

**Integration risk: LOW for the dependency commit**, MEDIUM for the SQL proposal (which is explicitly not intended for automatic application).

**The prior author's own verdict is recorded in `docs/security/validation.md` and should be respected:**

> `SECURITY READINESS : NO-GO` — `CORE DATA V1 APRÈS SECURITY : NO-GO`

Critically, the same document clarifies that these verdicts concern **overall production readiness**, not the patch: *"le volet correctif npm est PASS ; les deux NO-GO ne signalent pas un échec du patch Next ni des tests."* The blockers listed are a proven restorable backup, staging validation with real user journeys, and independent review of the SQL proposal — all operational prerequisites, not code defects.

**Recommended next action:** Land **first** (before the Core branch) to resolve S1 and unblock the test scripts. Keep the SQL proposal unapplied pending staging review.

### 12.3 `origin/backup/agent-builder-v2.1`

| Field | Value |
| --- | --- |
| **Tip** | `fceea4c` — `Backup complet avant Agent Builder V3` |
| **Relation to main** | 1 ahead, **56 behind**. Merge base `d4a844f`. |
| **Purpose** | Explicit pre-V3 snapshot of Agent Builder |

Its content — the `src/modules/agent-builder` extraction and `AgentBuilderV1` — is already present in `main` in evolved form. **Value: archival only. Integration risk: HIGH and pointless** (56 commits of divergence, superseded content).

**Recommended next action:** Leave untouched. Consider tagging and deleting the branch later as housekeeping, with owner approval. **Do not merge.**

---

## 13. GAP ANALYSIS

`CURRENT` is repository evidence. `TARGET` is the master plan. `PHASE` refers to [§17](#17-phased-master-roadmap).

| Subsystem | CURRENT | TARGET | GAP | DEPENDENCIES | RISKS | PHASE |
| --- | --- | --- | --- | --- | --- | --- |
| **Core** | MISSING. Three parallel stacks, no shared module. | One shared Core: identity, projects, conversations, files, artifacts, runs, tasks, usage. | Create `lib/core/*` and migrate Nova onto it; plan Forge convergence. | Core migration landed | Premature abstraction; touching working Forge | **1** |
| **Nova** | PARTIAL. Chat + safety + web search; no streaming, no project context, no files, no memory. | Project-aware assistant with streaming, files, memory, tools, artifacts, delegation. | Streaming; context injection; tool loop; artifacts; usage surfacing. | Core; Model Gateway; Files | Rewriting the working safety layer | **2** |
| **Forge** | PARTIAL — most complete. Synchronous loop, sandbox, GitHub App, confirmed publication. | Durable, permissioned coding agent on shared runtime. | Durable execution beyond 300 s; permission model; approval UI; cost tracking; Core migration. | Tasks/Jobs; Permissions; Agent Runtime | **Regressing the best-working subsystem** | **3** |
| **Apex** | MISSING. Four "Bientôt" nav entries. | Architecture/engineering specialist able to review and reject Forge output. | Everything. Needs a second agent on shared runtime plus a review contract. | Agent Runtime; Tools; Forge artifacts | Building before runtime is shared | **4** |
| **Muse** | MISSING. Nav label on the legacy generator; zero multimodal code. | Image, video, voice, music via Model Gateway. | Everything, including the entire binary asset pipeline. | Model Gateway; **Files/Storage**; Usage/Cost | Uncapped media spend; no Storage at all | **5** |
| **Create** | MISSING. SVG template composer with PNG/PDF export. | Layered visual editor with history, templates, assets, Brand Kits, Muse integration. | Canvas state model; layers; undo/redo; assets; Brand Kits. | Files; Artifacts; Muse | Largest single build; scope explosion | **6** |
| **Flow** | MISSING. CRUD plus 4 hard-coded sequential LLM calls. | Trigger/action/condition engine on shared task infrastructure. | Entire execution engine. | **Tasks/Jobs**; Tools; Connectors; Permissions | Inventing a second execution engine | **7** |
| **Nexus** | MISSING. Not present in the codebase. | Autonomous multi-agent orchestrator. | Everything. | **All of the above being stable** | Building before contracts stabilise — the plan's own warning | **8** |
| **Model Gateway** | MISSING. Types with zero implementers; 5 uncoordinated call sites. | Capability routing with fallback, cost and policy awareness. | Implement `AIProvider`; registry; router; consolidate call sites. | `lib/ai/contracts.ts`; Usage | Over-abstracting with one provider | **1–2** |
| **Memory** | MISSING. Last 40 turns only. | Conversation, user, project, org, agent-working memory with provenance and permissions. | Everything. Plan says do **not** build a generic table yet. | Core; Projects; Files | Premature generic schema | **2+** |
| **Files** | MISSING. Storage unused; data URLs and SVG text. | Project-scoped files with metadata, provenance, versions, permissions. | Buckets; policies; upload/download; quotas; virus/type handling. | Core; Storage policies | Unbounded payloads (S15); cost | **1–2** |
| **Artifacts** | PARTIAL (Forge git patches only). | General project artifacts with ownership, provenance, versions. | Generalise `forge_run_artifacts`. | Core; Files | Breaking Forge publication | **2** |
| **Tasks / Jobs** | MISSING. No queue, no worker. | Durable lifecycle: QUEUED/RUNNING/WAITING/NEEDS_APPROVAL/FAILED/COMPLETED/CANCELLED. | Entire subsystem plus a worker execution target. | Core; infra decision | **Vercel's 300 s ceiling forces an infra choice** | **1–3** |
| **Agent Runtime** | PARTIAL (Forge-only, synchronous). | Shared runtime: lifecycle, context, model selection, tool permissions, streaming, cancellation, retries, artifacts, usage, approvals. | Extract and generalise Forge's loop; add durability. | Tasks; Tools; Model Gateway | Destabilising Forge during extraction | **3** |
| **Tools** | PARTIAL. 8 hard-coded Forge tools; dormant risk catalog. | Standardised registry with schemas, permissions, timeouts, retries, cost, audit. | Registry; schemas; enforcement; audit trail. | Permissions; Agent Runtime | Unpermissioned tools before RBAC | **2–3** |
| **Connectors** | PARTIAL. GitHub App + Daytona, both Forge-specific. | Connector framework with credential vault and explicit scopes. | Framework; vault; scope model. | Permissions; Core | Credential handling | **7** |
| **Organizations** | MISSING. Everything keyed to `auth.users`. | Orgs, memberships, isolation. | Entire model plus RLS rewrite across all tables. | Core; Permissions | **Retrofitting org scope later is expensive** — decide early | **1 (decide) / 9 (build)** |
| **Permissions / RBAC** | MISSING. Only Supabase built-in roles. | READ / WRITE / EXECUTE / DEPLOY / EXTERNAL / SPEND separation. | Entire model. | Core; Orgs decision | **Must precede autonomous execution** | **1–3** |
| **Usage** | PARTIAL. Generation counts on one route; unaggregated Nova tokens. | Full attribution by user, org, project, agent, provider, model, tokens, media, cost, margin. | Cost model; aggregation; per-agent attribution; atomic counters. | Core; Model Gateway | Unmetered spend (S10) | **1–2** |
| **Billing** | PARTIAL. Stripe works; enforcement thin. | Subscriptions, credits, quotas, PAYG, org limits. | Credits; quotas beyond one route; timestamp tolerance; atomic increments. | Usage | Revenue leakage; replay (S12) | **2** |
| **Observability** | PARTIAL. JSON to `console.error`. | Full AI execution provenance and tracing. | Error tracking; run tracing; correlation ids; cost and latency metrics. | Core; Agent Runtime | Flying blind during autonomy | **2–3** |
| **Admin** | MISSING. | Control plane over users, orgs, agents, models, usage, costs, security events. | Everything, including the role model it depends on. | Permissions; Usage; Observability | Admin surface is high-value attack surface | **9** |

### Cross-cutting conclusions

Three dependencies gate most of the roadmap and should be treated as the real critical path:

1. **Durable task execution.** Vercel's 300 s function ceiling makes long-running agent work impossible today. Forge already bumps against it. FLOW and NEXUS are unbuildable without an answer. This is an **infrastructure decision the owner must make**, not something the codebase can resolve.
2. **Files and Storage.** Supabase Storage is entirely unused. MUSE, CREATE, and any real Files or Artifacts capability all block on it.
3. **The organization decision.** Every table is keyed to `auth.users`. Adding org scope later means rewriting every RLS policy and every ownership chain in the codebase. The decision — single-user or multi-tenant — should be made in Phase 1 even if the implementation is deferred to Phase 9.

---

## 14. TARGET ARCHITECTURE

### 14.1 Principles applied

A **modular monolith** is the correct target. The existing Next.js application already is one; it works, it deploys, it builds in 15 seconds. Nothing in the evidence justifies microservices. The only component that genuinely needs to live outside the Next.js request lifecycle is the **durable task worker**, because of the 300 s serverless ceiling — and that is a runtime constraint, not an architectural preference.

The Forge `-foundation` / `-store` / `-runtime` / `-provider` / `-client` convention should become the platform-wide standard, since it already demonstrably works at scale in this codebase.

### 14.2 Proposed target structure

```
+---------------------------------------------------------------+
|                      PRESENTATION (Next.js)                    |
|  app/**/page.tsx (RSC)  ->  components/** (client)             |
|  Nova UI | Forge UI | Apex UI | Muse UI | Create UI | Flow UI  |
+---------------------------------------------------------------+
                              |
+---------------------------------------------------------------+
|              EDGE / BOUNDARY  (currently MISSING)              |
|   middleware.ts : session, route protection, rate limiting     |
+---------------------------------------------------------------+
                              |
+---------------------------------------------------------------+
|                    API LAYER  app/api/**                       |
|  Thin handlers: authenticate -> validate -> delegate -> map    |
+---------------------------------------------------------------+
                              |
+===============================================================+
|                    lib/core/   (SHARED CORE)                   |
|                                                                |
|  identity/     users, sessions, (orgs - deferred)              |
|  projects/     PROJECT as the central domain object            |
|  conversations/  conversations + messages                      |
|  files/        uploads, metadata  (needs Supabase Storage)     |
|  artifacts/    generalised from forge_run_artifacts            |
|  runs/         agent_runs + agent_steps (from Forge)           |
|  tasks/        durable queue + lifecycle states                |
|  usage/        tokens, media units, cost attribution           |
|  permissions/  READ|WRITE|EXECUTE|DEPLOY|EXTERNAL|SPEND        |
|  audit/        immutable action log                            |
+===============================================================+
        |                |                |                |
+---------------+ +--------------+ +-------------+ +-------------+
| MODEL GATEWAY | | TOOL LAYER   | | AGENT       | | CONNECTORS  |
| implements    | | registry +   | | RUNTIME     | | GitHub      |
| AIProvider    | | schemas +    | | extracted   | | Daytona     |
| capability    | | permissions  | | from Forge  | | (+ future)  |
| routing +     | | + audit      | | + durable   | | credential  |
| fallback      | | (from        | | execution   | | vault       |
| + cost        | | forge-tools) | |             | |             |
+---------------+ +--------------+ +-------------+ +-------------+
        |                |                |                |
+---------------------------------------------------------------+
|                          AGENTS                                |
|   NOVA        assistant / interface  -> talks to the user      |
|   FORGE       coding agent                                     |
|   APEX        architecture + review (may reject FORGE)         |
|   MUSE        multimodal generation                            |
|   NEXUS       mission orchestrator  -> coordinates the others  |
|               (LAST: requires all contracts above to be stable)|
+---------------------------------------------------------------+
        |                                        |
+-----------------+                  +---------------------------+
| CREATE          |                  | FLOW                      |
| visual editor   |<-- MUSE assets   | automation on core/tasks   |
| -> FORGE for    |                  | + tools + connectors      |
|    Design->App  |                  |                           |
+-----------------+                  +---------------------------+
        |
+---------------------------------------------------------------+
|                      DATA / INFRASTRUCTURE                     |
|  Supabase Postgres  (RLS ENFORCED - not service-role bypassed) |
|  Supabase Auth      (cookie sessions, not localStorage)        |
|  Supabase Storage   (currently UNUSED - required for Files)    |
|  Daytona sandboxes  |  Stripe  |  Vercel                       |
|  Durable worker     (NEW - required: 300s ceiling today)       |
+---------------------------------------------------------------+
```

### 14.3 Boundaries the target must enforce

| Boundary | Rule |
| --- | --- |
| Core ↔ Agents | Agents depend on Core. Core never imports an agent. |
| NOVA ↔ NEXUS | NOVA is the user interface. NEXUS coordinates missions. They must not merge. |
| Server ↔ Client | Client never touches the database. All access through API handlers. |
| Data access | Prefer user-JWT + RLS. Service role becomes the documented exception, not the default. |
| Tools ↔ Permissions | No tool executes without a declared permission and an audit record. |
| Provider coupling | Agents address capabilities, not providers. |
| Long-running work | Anything exceeding a request goes to Tasks, never a synchronous handler. |
| VYRA | **Not part of this product.** No VYRA module. NEXUS is the orchestrator. Any future sharing crosses an explicit, intentional boundary. |

---

## 15. SECURITY / PERMISSION GATES

Architecture and planning only. Nothing below was implemented.

The governing principle, restated from the master plan:

```
READ  ≠  WRITE  ≠  EXECUTE  ≠  DEPLOY  ≠  EXTERNAL COMMUNICATION  ≠  SPEND MONEY
```

| Gate | Permission | Isolation | Audit trail | Human approval | Cost control |
| --- | --- | --- | --- | --- | --- |
| **NOVA tool use** (read-only: web search, file read) | `tool.read` | None needed | Tool name, inputs, duration, run id | No | Per-conversation token cap |
| **NOVA write tools** (create artifact, write project file) | `tool.write` + project ownership | Project scope | Before/after, actor, run id | No (reversible, project-scoped) | Storage quota |
| **FORGE read access** (repository read, code search) | `repo.read` | GitHub App `contents: read` | Repository, ref, paths | No | — |
| **FORGE write access** (sandbox file write/delete) | `repo.write` | Sandbox only — **never the host** | Full diff persisted as artifact | No **inside the sandbox**; yes to leave it | Sandbox TTL |
| **FORGE command execution** | `exec.sandbox` | Ephemeral sandbox, deny-list, **egress policy required** | Command, args, cwd, exit, truncated output | No for allow-listed; **yes for network or unknown binaries** | Wall-clock and step budget |
| **FORGE Git write** (branch, commit, push, PR) | `git.write` | `forge/*` branches only; `main`/`master` blocked | Commit SHA, branch, PR URL, approver | **YES — already implemented** (`confirmed: true`) | — |
| **FORGE deployment** | `deploy.*` — **separate from `repo.write`** | Environment-scoped; preview ≠ production | Deployment id, environment, approver, timestamp | **YES, always, for production** | Infrastructure spend cap |
| **MUSE paid generation** | `spend.media` | Provider-scoped | Prompt, model, provider, units, cost, output artifact | **YES above a per-request cost threshold** | Hard per-user/org/project budget; pre-flight estimate |
| **FLOW external actions** (email, webhook, third-party write) | `external.send` + per-connector scope | Connector credential scope; **SSRF allow-list** | Target, payload digest, response status | **YES for first execution of each new external target** | Per-run action cap |
| **NEXUS autonomous missions** | `mission.run` — composes all of the above | Inherits the **most restrictive** gate of every delegated step | Full mission tree: goals, decomposition, agents, tools, costs, approvals | **YES at mission start, and at every escalation** | Mission budget with hard stop |

### Gate rules that follow from the audit

1. **Repository access must never imply production execution.** Forge already separates these; the model must be preserved as `deploy.*` is introduced.
2. **`confirmed: true` in `continuity-foundation.ts` is the working prototype** of a human-approval gate. Generalise it rather than inventing a second mechanism.
3. **Sandbox egress is currently UNKNOWN** — the agent deny-list blocks `curl` and `wget` in the tool path, but the direct runtime command route does not (S13), and Daytona's network policy is not visible in the repository. This must be determined before any autonomous execution.
4. **No gate can be enforced before the permission model exists.** Permissions are therefore a Phase 1–3 prerequisite, not a Phase 8 concern.
5. **Cost gates require the usage layer.** Budgets cannot be enforced against a cost model that does not exist, which is why usage tracking precedes MUSE.

---

## 16. MINIMUM DATA MODEL EVOLUTION

Only what the next phases actually require. No speculative long-term schema.

### 16.1 Already specified — land the existing branch

| Table | Why | Phase | Relation | RLS | Can wait? |
| --- | --- | --- | --- | --- | --- |
| `projects`, `conversations`, `messages` | Nova's code already depends on them; they exist in no applied migration. | **1** | `auth.users`; parents of everything | Per-operation `auth.uid()` policies, `anon` revoked | **NO — P0** |

This is `feat/noline-core-data-v1`. Do not rewrite it.

### 16.2 Phase 1 additions

| Table | Why needed | Phase | Relation to existing | Security / RLS | Can wait? |
| --- | --- | --- | --- | --- | --- |
| `files` | No file storage exists. Blocks Nova attachments, Muse outputs, Create assets. Requires Supabase Storage buckets and policies alongside. | 1 | `projects`, `auth.users` | Owner-scoped; Storage policies must mirror table policies; MIME and size limits | No — blocks Phase 2 |
| `usage_events` | Append-only record of every AI call: tokens, media units, provider, model, cost. Today only Nova captures tokens and nothing aggregates. Must exist **before** expensive workloads. | 1 | `auth.users`, `projects`, future `agent_runs` | Owner read-only; **service-role insert only** — users must not write their own usage | No — cheap now, very expensive to retrofit |

### 16.3 Phase 2–3 additions

| Table | Why needed | Phase | Relation | Security / RLS | Can wait? |
| --- | --- | --- | --- | --- | --- |
| `artifacts` | Generalise `forge_run_artifacts` into project artifacts (documents, reports, images, code). Needs provenance: which agent, model, run, inputs. | 2 | `projects`, `files`, `agent_runs` | Owner + project scope; provenance immutable | Partially — Nova can start with files |
| `tasks` | Durable work beyond the 300 s request ceiling. States: `QUEUED`, `RUNNING`, `WAITING`, `NEEDS_APPROVAL`, `FAILED`, `COMPLETED`, `CANCELLED`. Shared by Forge, Muse, Flow, Nexus. **Requires an execution target decision first.** | 2–3 | `projects`, `agent_runs` | Owner read; service-role write; `NEEDS_APPROVAL` transitions audited | No — gates Phases 3, 5, 7, 8 |
| `agent_runs` / `agent_steps` | Generalise the Forge tables so any agent can use them. Prefer a forward migration that keeps `forge_*` working during transition. | 3 | `projects`, `conversations`, `tasks` | Mirror existing Forge policies | Yes — until a second agent exists |
| `permissions` / `grants` | Enforce READ/WRITE/EXECUTE/DEPLOY/EXTERNAL/SPEND. Required before any autonomous execution. | 3 | `auth.users`, `projects` | Self-referential; only service role may grant | No — gates all autonomy |

### 16.4 Explicitly deferred

| Entity | Why deferred |
| --- | --- |
| `memory` | The master plan explicitly says not to create a generic memory table during audit. Requires real retrieval requirements first. |
| `organizations` / `memberships` | **Decide in Phase 1, build in Phase 9.** Retrofitting org scope means rewriting every RLS policy and ownership chain — so the decision cannot wait even though the tables can. |
| `connectors` / `credentials` | Only two connectors exist, both Forge-specific. A framework is unjustified until Flow needs it. |
| `flows` / `flow_runs` | Should reuse `tasks`, not introduce a parallel engine. |
| `missions` | Nexus is Phase 8. Building its schema now is exactly the premature work the plan warns against. |

### 16.5 Migration hygiene requirements

Before any new migration is added, three existing problems must be resolved:

1. **Define `set_updated_at()` in a migration** — it is currently only in the unapplied proposal, yet four applied migrations depend on it.
2. **Resolve the `20260824_*` ordering hazard** — five files share a prefix and the dependency order is wrong lexicographically.
3. **Establish a migration ledger** — production reportedly has no `supabase_migrations.schema_migrations` table, so state cannot be reconciled.

All future migrations should use full timestamps (`YYYYMMDDHHMMSS_`), be idempotent and transactional, and be forward-only. **No applied migration should be modified.**

---

## 17. PHASED MASTER ROADMAP

The master plan's proposed sequence is broadly validated by the evidence, with **one substantive adjustment**: a **Phase 0.5** is inserted. The security patch, the unauthenticated endpoints and the Core schema uncertainty are prerequisites, not Phase 1 work — Phase 1 cannot be safely executed while a critical RCE advisory and three anonymous paid-AI endpoints are live.

Prioritisation uses `P0`–`P3`, complexity `S/M/L/XL`, risk `LOW/MEDIUM/HIGH/CRITICAL`. **No calendar estimates** — sequencing is dependency-based.

### PHASE 0 — AUDIT ✅ COMPLETE

This document plus the capability matrix and roadmap. **Stop gate: awaiting owner approval.**

### PHASE 0.5 — STABILISATION (prerequisite)

**Objective:** make the repository safe to build on. Nothing here is new product.

| # | Item | Priority | Complexity | Risk | Dependencies |
| --- | --- | --- | --- | --- | --- |
| 0.5.1 | Land `chore/security-production-readiness` dependency commit (Next 16.3.3, audit → 0) | **P0** | S | LOW | Owner approval |
| 0.5.2 | Add `test` + `typecheck` scripts (included in 0.5.1) | **P0** | S | LOW | 0.5.1 |
| 0.5.3 | Add `engines` / `.nvmrc` pinning Node ≥ 22.15 | **P0** | S | LOW | — |
| 0.5.4 | Add CI running lint, typecheck, tests, build, audit | **P0** | S | LOW | 0.5.2, 0.5.3 |
| 0.5.5 | Require auth on `/api/generate-agent`, `/api/agent-builder-v2`, official-agent path of `/api/agents/[id]/run` | **P0** | S | **LOW code / HIGH if skipped** | — |
| 0.5.6 | Add rate limiting to all AI endpoints | **P0** | M | MEDIUM | 0.5.5 |
| 0.5.7 | Verify real production Supabase schema (read-only preflight) | **P0** | S | MEDIUM — **needs owner access** | Owner credentials |
| 0.5.8 | Land `feat/noline-core-data-v1` — migration applied **before** code | **P0** | M | **HIGH** | 0.5.1, 0.5.7, verified backup |
| 0.5.9 | Define `set_updated_at()` in a migration; resolve `20260824_*` ordering; establish ledger | **P0** | M | MEDIUM | 0.5.7 |
| 0.5.10 | Gitignore `tsconfig.tsbuildinfo` | P3 | S | LOW | — |

**Acceptance gates:** `npm audit` = 0 · lint, typecheck, build pass · **all 197 tests pass on pinned Node** · CI green on every PR · no unauthenticated AI endpoint remains · Core tables verified present in the target database · a verified restorable backup exists.

### PHASE 1 — CORE FOUNDATION

**Objective:** one shared Core, with RLS actually enforced.

| # | Item | Priority | Complexity | Risk | Dependencies |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Establish `lib/core/*` using the Forge layering convention | P1 | M | LOW | 0.5.8 |
| 1.2 | Migrate Nova onto `lib/core`; make PROJECT the central object | P1 | M | MEDIUM | 1.1 |
| 1.3 | **Decide: single-user or multi-tenant.** Documented decision, implementation may defer | **P0** | S | **HIGH if deferred** | Owner decision |
| 1.4 | Supabase Storage: buckets, policies, `files` table, upload/download with size and MIME limits | P1 | L | MEDIUM | 1.1, 1.3 |
| 1.5 | `usage_events` + cost model; instrument all five OpenAI call sites | P1 | M | LOW | 1.1 |
| 1.6 | Model Gateway v1: implement `AIProvider`, registry, capability routing; consolidate call sites | P1 | L | MEDIUM | 1.5 |
| 1.7 | `middleware.ts`: route protection + rate limiting | P1 | M | MEDIUM | 0.5.6 |
| 1.8 | Migrate sessions from `localStorage` to cookies (`@supabase/ssr`) | P1 | M | **HIGH — touches all auth** | 1.7 |
| 1.9 | Atomic quota enforcement across all AI endpoints | P1 | M | MEDIUM | 1.5 |
| 1.10 | Permission model foundations (enum + checks, no UI yet) | P1 | M | MEDIUM | 1.1, 1.3 |
| 1.11 | **Decide: durable execution target** (Vercel 300 s is the constraint) | **P0** | S | **HIGH** | Owner decision |

**Acceptance gates:** Nova runs entirely on `lib/core` with RLS enforced via user JWT · file upload/download works with quotas · every AI call emits a usage event with cost · one gateway call site · unauthenticated users cannot reach protected pages · sessions in cookies · org decision and execution-target decision both documented.

### PHASE 2 — NOVA

**Objective:** NOVA becomes the first genuinely complete agent on the Core.

Scope: streaming responses (SSE) · project context injection · file attachments · artifacts from conversations · a real tool-calling loop with permissions · usage and cost surfaced in the UI · task creation · conversation-scoped memory (**not** a generic memory table).

Priority P1 · Complexity L · Risk MEDIUM · Depends on Phase 1.

**Acceptance gates:** streaming verified end-to-end · Nova reads project files and cites them · artifacts persist with provenance · every tool call is permission-checked and audited · cost is visible per conversation · no regression in the safety or web-search layers (all existing Nova tests still pass).

### PHASE 3 — FORGE ON SHARED RUNTIME

**Objective:** durable, permissioned Forge — without regressing what already works.

Scope: extract the agent loop into a shared Agent Runtime · `tasks` table and a durable worker · migrate Forge to Core projects/conversations · generalise `agent_runs`/`agent_steps` · permission enforcement (`repo.read`/`repo.write`/`exec.sandbox`/`git.write`) · approval UI generalising `confirmed: true` · per-run cost tracking · resolve the sandbox egress question (S13).

Priority P1 · Complexity **XL** · Risk **HIGH** · Depends on Phases 1, 2 and decision 1.11.

> **Explicit caution.** Forge is the most valuable working subsystem in the repository. The extraction must be incremental with `forge_*` tables kept operational throughout, and all 11 Forge test files must pass at every step. A regression here costs more than the refactor gains.

**Acceptance gates:** an agent run survives beyond 300 s · all Forge tests still pass · every tool call permission-checked · Git writes still require explicit confirmation · cost tracked per run · sandbox egress policy documented and enforced.

### PHASE 4 — APEX

**Objective:** a second agent on the shared runtime, proving the runtime is genuinely shared.

Scope: architecture analysis · technical audits · security and performance review · structured review of Forge output with the ability to **reject** it · structured recommendation outputs.

Priority P2 · Complexity L · Risk MEDIUM · Depends on Phase 3.

**Acceptance gates:** Apex runs on the same runtime with no Forge-specific code · Apex can read Forge artifacts and emit a structured verdict · a rejection measurably changes Forge's next run · no duplicated runtime code.

### PHASE 5 — MUSE

**Objective:** multimodal generation, built in cost-controlled order.

Order: image → image editing → video → voice → music. All through the Model Gateway; all outputs become files and artifacts; hard budget caps and approval above a cost threshold.

Priority P2 · Complexity **XL** · Risk **HIGH (cost)** · Depends on Phases 1.4, 1.5, 1.6, 3.

**Acceptance gates:** generation routes through the gateway, never a hard-coded provider · every output is a file with full provenance · per-user/org/project budgets enforced with a pre-flight estimate · spend above threshold requires approval.

### PHASE 6 — CREATE

**Objective:** a real editor foundation before the full vision.

Start with canvas state model, layers, z-order, undo/redo history, selection, alignment, grouping. Then templates, assets, Brand Kits. Then Muse integration. Design → Website → Application via Forge is **late** scope.

Priority P2 · Complexity **XL** · Risk MEDIUM · Depends on Phases 1.4, 5.

**Acceptance gates:** layered document model persisted as an artifact · undo/redo across all operations · Muse assets insertable directly · exports preserve fidelity · Brand Kits applied consistently.

### PHASE 7 — FLOW

**Objective:** automation reusing shared execution primitives — never a second engine.

Scope: triggers, actions, conditions, branches, loops, variables · schedules and webhooks · retries, timeouts, error handling · human approval nodes · connector and agent nodes.

Priority P2 · Complexity **XL** · Risk **HIGH** · Depends on Phases 3 (tasks), 2–3 (tools), 1.10 (permissions).

**Acceptance gates:** flows execute on the shared `tasks` infrastructure · external actions gated by `external.send` with an SSRF allow-list · every run fully audited · no parallel execution engine introduced.

### PHASE 8 — NEXUS

**Objective:** orchestrate mature capabilities — never compensate for missing ones.

Required stable foundations: Agent Runtime, Tasks, Tools, Permissions, context handoff, Observability, cost tracking, human approval. **If any is immature, Nexus is premature** — this is the master plan's own instruction and the evidence supports it strongly.

Scope: objective decomposition · planning · agent selection · task assignment · parallelism and dependencies · context handoffs · budgets, limits, retries, timeouts · evaluation, critique, validation · recovery and escalation · human approval.

Priority P3 · Complexity **XL** · Risk **CRITICAL** · Depends on Phases 3, 4, 5, 7.

**Acceptance gates:** a multi-agent mission completes with a full audit tree · mission budgets enforced with a hard stop · every escalation surfaces to a human · Nexus adds no agent-specific special-casing.

### PHASE 9 — PLATFORM EXPANSION

Organizations and teams (if decided in 1.3) · admin control plane · collaboration · templates and marketplace · mobile companion · local/private AI · enterprise capabilities.

Priority P3 · Complexity XL · Risk MEDIUM · Depends on all prior phases.

---

## 18. P0 BLOCKERS

Ordered by execution sequence. Each must be cleared before Phase 1 begins.

| # | Blocker | Why it blocks | Resolution | Complexity | Risk |
| --- | --- | --- | --- | --- | --- |
| **B1** | **Critical dependency vulnerability.** Next.js `^16.2.6` — RCE class plus 10 advisories; 9 total. | Deploying new features on a known-RCE base is indefensible. | Land the `chore/security-production-readiness` dependency commit. Already prepared and validated to audit 0. | S | LOW to fix |
| **B2** | **Three unauthenticated paid-AI endpoints.** `/api/generate-agent`, `/api/agent-builder-v2` (~19 calls/request), official-agent path of `/api/agents/[id]/run`. | Anonymous unbounded OpenAI spend. Worsens with every AI feature added. | Require `getUserFromRequest` on all three; add rate limiting. | S | **CRITICAL if left** |
| **B3** | **Nova Core schema is not in any applied migration.** `projects`, `conversations`, `messages` exist only in a file marked "do not execute". | The entire Nova data path may be running on unverified or absent schema. Nothing can be built on an unknown foundation. | Read-only preflight against the real Supabase project, then land `feat/noline-core-data-v1` (migration first, code second). | M | **HIGH** |
| **B4** | **No verified restorable backup.** The prior author's own NO-GO cites this. | Applying the Core migration without one is unrecoverable. | Owner must provision and verify a restorable backup covering Auth and Forge, and rehearse restoration. **Owner action — cannot be resolved in code.** | — | **CRITICAL** |
| **B5** | **RLS universally bypassed.** All paths use the service role. | Authorization has no database backstop. One missing filter is an IDOR. | Core branch fixes Nova. Generalise the user-JWT pattern to legacy and Forge over Phases 1–3. | L | **HIGH** |
| **B6** | **Migration chain cannot be applied cleanly.** `set_updated_at()` undefined; `20260824_*` ordering inverted; no production ledger. | No reliable path to reproduce or advance the schema. | Define the function in a migration, resolve ordering, establish the ledger. Forward-only; do not modify applied migrations. | M | MEDIUM |
| **B7** | **No CI and no Node pinning.** No `.github/`, no `engines`, no `.nvmrc`. | Nothing enforces quality gates; caused the 3 test failures observed here. | Pin Node ≥ 22.15; add CI for lint, typecheck, tests, build, audit. | S | LOW to fix |
| **B8** | **Durable execution target undecided.** Vercel's 300 s ceiling; Forge already constrained. | Phases 3, 5, 7 and 8 are unbuildable without an answer. | **Owner architectural decision.** Options include Vercel background functions, a queue with an external worker, or Supabase-based job processing. | — | **HIGH** |
| **B9** | **Organization model undecided.** Every entity keyed to `auth.users`. | Retrofitting org scope means rewriting every RLS policy and ownership chain. | **Owner product decision in Phase 1.** Implementation may defer to Phase 9; the decision may not. | — | **HIGH if deferred** |

---

## 19. RISKS / OPEN QUESTIONS

### 19.1 Risks

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| R1 | **Forge regression during Core extraction.** The most valuable subsystem is also the one Phase 3 refactors most. | **HIGH** | Incremental extraction; keep `forge_*` operational; all 11 test files green at every step; no big-bang rewrite. |
| R2 | **Core migration applied to an unknown production schema.** | **HIGH** | Read-only preflight, verified backup, rehearsal on a copy, maintenance window, documented rollback. |
| R3 | **Uncontrolled AI spend.** Three anonymous endpoints, no rate limiting, no cost model, Muse ahead. | **HIGH** | B2 immediately; usage events in Phase 1; hard budgets before Phase 5. |
| R4 | **Building pillars before the Core exists** — seven products on three divergent stacks. | **HIGH** | Enforce the phase order. Do not start Nexus, Create or Flow early. |
| R5 | **Serverless 300 s ceiling** blocks durable agent work. | **HIGH** | Decide B8 in Phase 1 before committing to Phases 3, 5, 7, 8. |
| R6 | **Single-maintainer bus factor.** All 65 commits by one author; no CI; no ADRs. | MEDIUM | CI in Phase 0.5; these audit documents as the first shared reference; ADRs going forward. |
| R7 | **Sandbox egress is unverified.** Agent deny-list is bypassed on the direct command route (S13); Daytona network policy not visible. | MEDIUM | Determine and document the policy; apply the deny-list uniformly. |
| R8 | **`localStorage` sessions.** Any XSS yields account takeover. | MEDIUM | Migrate to cookie sessions in Phase 1.8. |
| R9 | **Dual persistence drift.** Six features have both `localStorage` and Supabase paths. | MEDIUM | Consolidate opportunistically during Core migration; do not big-bang. |
| R10 | **Model availability unverified.** `NOVA_MODEL` defaults to `gpt-5.4-mini`; the provider catalog is not in the repository. | LOW | Verify against the provider; add a fallback in the Model Gateway. |
| R11 | **Branch conflict.** Both active branches modify `package.json` and the lockfile. | LOW | Land security first, then Core; regenerate and verify the lockfile. |
| R12 | **Premature abstraction.** Building a full Model Gateway for one provider risks over-engineering. | LOW | Keep gateway v1 minimal; the existing `contracts.ts` types are already the right scope. |

### 19.2 Open questions requiring owner decision

| # | Question | Why it matters | Blocks |
| --- | --- | --- | --- |
| Q1 | **Is the deployed production Supabase schema actually the one in this repository?** The `saveGeneratedText` compatibility fallback suggests the application itself is unsure. | Everything depends on knowing the real schema. | B3, Phase 1 |
| Q2 | **Does a verified, restorable backup exist?** | The Core migration is unsafe without one. | B4 |
| Q3 | **Single-user or multi-tenant?** | Retrofitting org scope means rewriting all RLS and ownership chains. | B9, Phase 1 |
| Q4 | **What is the durable execution target?** | Gates Phases 3, 5, 7, 8. | B8 |
| Q5 | **Should the legacy marketing SaaS be preserved, migrated, or sunset?** It owns most of the UI but is absent from the target vision. | Determines whether Phase 1 must carry it forward. | Phase 1 scope |
| Q6 | **Is `main` currently deployed to production, and to which Vercel project and domain?** Not determinable from the repository. | Determines the urgency of B1 and B2. | B1, B2 |
| Q7 | **Should the nav labels be corrected now?** "Muse" points at the legacy generator and "Apex" is entirely disabled — this misrepresents capability. | Expectation management; trivially cheap. | — |
| Q8 | **Is provider diversity a real requirement, or is OpenAI sufficient?** | Determines whether the Model Gateway is v1 scope or deferred. | Phase 1.6 |
| Q9 | **What are the actual cost budgets** per user, per plan, per organisation? | Cannot enforce budgets against an undefined policy. | Phase 1.5, Phase 5 |
| Q10 | **Is `backup/agent-builder-v2.1` still needed?** 56 commits behind, content superseded. | Housekeeping only. | — |

### 19.3 Items that remain UNKNOWN

Deliberately not converted into assumptions:

- The live production database schema, applied migration set, and row counts (the security branch documents claims; they were not independently verified here).
- Whether `PROPOSED_001_PROJECT_CONVERSATIONS.sql` was ever executed manually.
- Daytona's sandbox network egress policy.
- The Vercel project, domain and environment-variable configuration.
- Whether the configured model identifiers exist in the provider catalog.
- Whether any production traffic currently reaches the unauthenticated endpoints.

---

## 20. RECOMMENDED PHASE 1 SCOPE

**Recommendation: do not begin Phase 1 as originally framed.** Execute **Phase 0.5 (Stabilisation)** first. Phase 1 cannot be built safely on a base with a critical RCE advisory, three anonymous paid-AI endpoints, and a data model whose tables may not exist.

### Phase 0.5 — immediate scope

**Objective:** make the repository safe, verifiable and reproducible. No new product surface.

**Deliverables**

1. Land the security branch dependency commit — `npm audit` to 0, Next 16.3.3.
2. `test` and `typecheck` scripts available (included above).
3. Node pinned to ≥ 22.15 via `engines` and `.nvmrc`; all 197 tests then pass.
4. CI running lint, typecheck, tests, build and audit on every PR.
5. Authentication required on all three currently open AI endpoints.
6. Rate limiting on every AI endpoint.
7. Read-only production schema preflight (**requires owner access**).
8. Verified restorable backup (**owner action**).
9. Core migration applied, then the Core branch code deployed.
10. `set_updated_at()` defined in a migration; `20260824_*` ordering resolved; migration ledger established.

**Acceptance gates:** `npm audit` = 0 · lint, typecheck, build pass · **197/197 tests pass** · CI green · no unauthenticated AI endpoint · Core tables verified present · backup verified restorable · all Forge tests still passing.

**Explicitly out of scope:** any new feature, any pillar implementation, any dependency upgrade beyond the prepared security patch, any large refactor.

### Phase 1 — immediately following

**Objective:** one shared Core with RLS genuinely enforced, and the two architectural decisions made.

**Deliverables**

1. `lib/core/*` established on the Forge layering convention.
2. Nova migrated onto `lib/core`; PROJECT becomes the central domain object.
3. **Decision documented: single-user or multi-tenant** (Q3 / B9).
4. **Decision documented: durable execution target** (Q4 / B8).
5. Supabase Storage enabled: buckets, policies, `files` table, upload/download with size and MIME limits.
6. `usage_events` with a cost model; all five OpenAI call sites instrumented.
7. Model Gateway v1 implementing the existing `AIProvider` contract; call sites consolidated.
8. `middleware.ts` providing route protection and rate limiting.
9. Sessions migrated from `localStorage` to cookies.
10. Atomic quota enforcement across all AI endpoints.
11. Permission model foundations (enum plus checks; no UI).

**Acceptance gates:** Nova operates entirely through `lib/core` with RLS enforced via user JWT and no service-role fallback · files upload and download with quotas enforced · every AI call emits a usage event carrying cost · exactly one gateway call site remains · anonymous users cannot reach protected pages · sessions are cookie-based · both architectural decisions documented · **no Forge regression — all 11 Forge test files pass**.

**Deliberately deferred:** Nova streaming and tools (Phase 2) · any Forge refactor (Phase 3) · Apex, Muse, Create, Flow, Nexus · organizations implementation (Phase 9) · generic memory · connector framework · admin control plane.

---

## APPENDIX A — AUDIT METHOD AND LIMITS

**Method.** Read-only inspection of the working tree at `1cffe0c`; branch inspection via `git show` and `git diff` against remote refs without checkout; local execution of lint, typecheck, tests, build and `npm audit`; targeted verification of every critical claim by direct file reading.

**Change-control compliance.** No deployment. No production access. No production data touched. No destructive database operation. No secret value printed. No credential rotated. No code deleted. No history rewritten. No force push. No branch merged. No dependency upgraded. No large refactor. No applied migration modified. No Phase 1 implementation.

**Limits.** All production claims are `UNKNOWN`; the repository is the only source of truth used. Runtime behaviour was not exercised — no server was started and no authenticated end-to-end flow was executed. Three tests could not run on the available Node version and are reported as failures with their root cause. Claims sourced from branch documentation are attributed as such rather than presented as verified fact.

**Environment.** Node v22.14.0 · npm 10.9.7 · Linux · `npm ci` exit 0 · `tsx@4.20.6` installed with `--no-save --no-package-lock` (manifests byte-verified unchanged) · working tree restored to clean.

---

## APPENDIX B — COMPANION DOCUMENTS

| Document | Contents |
| --- | --- |
| `docs/NOLINE_STUDIO_AI_CAPABILITY_MATRIX.md` | Concise AREA / STATUS / EVIDENCE / GAP / TARGET PHASE table |
| `docs/NOLINE_STUDIO_AI_ROADMAP.md` | PHASE / OBJECTIVE / DEPENDENCIES / DELIVERABLES / ACCEPTANCE GATES |
| `docs/NOLINE_AI_ARCHITECTURE.md` | Pre-existing 24-line architecture note (unmodified) |

`docs/` already existed and contained one document, so it is the established location. No new directory structure was invented.

---

**END OF PHASE 0 MASTER AUDIT — STOP GATE ACTIVE.**
**No implementation may begin without explicit owner approval.**
