# NØLINE STUDIO AI — CAPABILITY MATRIX

**Base commit:** `1cffe0cfb6052470cbf34b8366d31d5bb9085c22` (`main`)
**Companion to:** [`NOLINE_STUDIO_AI_MASTER_AUDIT.md`](./NOLINE_STUDIO_AI_MASTER_AUDIT.md) · [`NOLINE_STUDIO_AI_ROADMAP.md`](./NOLINE_STUDIO_AI_ROADMAP.md)

## Status definitions

| Status | Meaning |
| --- | --- |
| `CONFIRMED` | Implemented, wired into the running application, and supported by concrete evidence. |
| `PARTIAL` | A real implementation exists but is incomplete relative to the target, or is scoped to one subsystem instead of shared. |
| `MISSING` | No implementation. A navigation label, placeholder page, type definition or filename does **not** count. |
| `UNKNOWN` | Cannot be determined from repository evidence. Never converted into an assumption. |

---

## Matrix

| AREA | STATUS | EVIDENCE | GAP | TARGET PHASE |
| --- | --- | --- | --- | --- |
| **AI Core** | `MISSING` | No shared core module. Three parallel stacks: legacy `lib/*.ts`, `lib/chat/*` (Nova), `lib/forge/*` (35 files). `lib/ai/contracts.ts` defines `AIProvider` with **zero implementers**. | Create `lib/core/*` for identity, projects, conversations, files, artifacts, runs, tasks, usage, permissions, audit. Adopt the Forge layering convention platform-wide. | **1** |
| **Projects** | `PARTIAL` | Two unrelated models. Nova: `projects` in `lib/chat/conversation-store.ts` — **tables exist in no applied migration**, only `supabase/PROPOSED_001_PROJECT_CONVERSATIONS.sql`. Forge: `forge_projects` in `20260824_forge_v1_foundation.sql`. | Unify into one Core `projects` table. Make PROJECT the central context object linking conversations, files, artifacts, runs, tasks. | **0.5 / 1** |
| **Conversations** | `PARTIAL` | `conversations` (Nova, unapplied schema) and `forge_conversations` (applied). Duplicated model, no shared abstraction. | Single Core conversations model used by every agent. | **0.5 / 1** |
| **Messages** | `PARTIAL` | `messages` (Nova, unapplied) and `forge_messages` (applied). Nova adds retry idempotency via `user_message_id` in `app/api/nova/conversations/[conversationId]/messages/route.ts`. | Unify; preserve the idempotency behaviour; add pagination for long conversations. | **0.5 / 1** |
| **NOVA** | `PARTIAL` | `lib/chat/*` (796 lines, 8 files), 6 API routes, `components/NovaWorkspace.tsx`, `nova-safety.ts` classifier, OpenAI Responses API with native `web_search`, token usage captured to `messages.metadata.usage`, 3 test files. | No streaming · no project context injection · no file attachments · no memory · no tools beyond web search · no artifacts · no task creation · no delegation. | **2** |
| **FORGE** | `PARTIAL` — most complete pillar | 2,444 lines in `lib/forge` (35 files), 29 API routes, 6 migrations, **11 test files**. Agentic loop with lifecycle `QUEUED→PLANNING→RUNNING⇄VALIDATING→COMPLETED/FAILED/CANCELLED` (`agent-foundation.ts:5`), 8 tools, 60-step budget, Daytona ephemeral sandboxes, GitHub App, durable run/step persistence, user-confirmed Git publication. | **Execution is synchronous inside the HTTP request** (`maxDuration = 300`) — no queue or worker · no permission model · no approval UI for writes · no cost tracking · not on shared Core. | **3** |
| **APEX** | `MISSING` | Four disabled `future: true` navigation entries in `components/Shell.tsx:30-33`, all rendering "Bientôt". No route, no API, no lib, no table. Mentioned in `docs/NOLINE_AI_ARCHITECTURE.md` as intent only. | Everything: a second agent on the shared runtime, plus a structured review contract able to reject Forge output. | **4** |
| **MUSE** | `MISSING` | Navigation label maps to `/generate` and `/creations` — the legacy text generator and SVG store. A repository-wide search for `images.generate`, `dall-e`, `gpt-image`, `audio.speech`, text-to-speech, video generation, Replicate, fal.ai, ElevenLabs and Stability returns **zero matches**. | All image, video, voice and music generation, plus the entire binary asset pipeline it depends on. | **5** |
| **CREATE** | `MISSING` | `components/VisualCreator.tsx` + `lib/visuals.ts`: template-driven **SVG composer**. 3 fixed formats (1080×1080, 1080×1920, 1640×624), colour and style presets, logo/background upload as data URLs, editable text, PNG and PDF export. | No canvas state model · no layers or z-index · no undo/redo · no history · no drag-and-drop · no asset library · no Brand Kits · no animation. | **6** |
| **FLOW** | `MISSING` | `lib/workflows.ts` is types + `normalizeWorkflow` only. `/api/workflows` is CRUD. The only execution is `/api/agents/[id]/workflow` — **four hard-coded sequential OpenAI calls** in one request (`maxDuration = 300`). | No triggers, schedules, conditions, branches, loops, variables, webhooks, delays, retries, error handling, approvals, connector nodes or agent nodes. | **7** |
| **NEXUS** | `MISSING` | The string does not appear anywhere in `app/`, `lib/`, `src/`, `components/` or `supabase/`. | Everything. Must come **last** — requires stable Agent Runtime, Tasks, Tools, Permissions, context handoff, Observability, cost tracking and human approval. | **8** |
| **Model Gateway** | `MISSING` | `lib/ai/contracts.ts` defines `AIProvider`, `Model`, `ModelCapabilities`, `GenerationRequest/Result/Chunk` — imported by only 2 files, and only for message types. **Five uncoordinated OpenAI call sites**: `nova-openai.ts`, `forge-openai.ts`, `/api/generate`, `/api/generate-agent`, `/api/agents/[id]/run`, `openai-agent-builder.gateway.ts`. | No capability routing, no fallback, no cost or latency awareness, no second provider. Nova uses the Responses API while everything else uses Chat Completions. | **1–2** |
| **Memory** | `MISSING` | No memory table, module or retrieval logic. Nova context is the last 40 conversation turns (`nova-web-search.ts:38-47`). | Conversation, user, project, organization and agent-working memory with ownership, provenance, permissions, isolation, retrieval and deletion. Plan says **do not** create a generic table yet. | **2+** |
| **Files** | `MISSING` | **Supabase Storage entirely unused** — no `storage.buckets` DDL, no `storage.objects` policies, no `.upload(`, `createSignedUrl` or `getPublicUrl` anywhere. Images are data URLs in request bodies; visuals are SVG `text` columns. | Buckets, policies, `files` table, upload/download, size and MIME limits, quotas. **Hard prerequisite for Muse, Create and Artifacts.** | **1** |
| **Artifacts** | `PARTIAL` — Forge only | `forge_run_artifacts` (`20260825_forge_run_artifacts.sql`, extended by `20260826_forge_v15_continuity.sql` and `..._github_publication.sql`) stores git patches with restore and publication state. Well modelled and tested. | Generalise from git-diff artifacts to project artifacts (documents, reports, images, code) with ownership, project association, metadata, provenance, versions and permissions. | **2** |
| **Tasks / Jobs** | `MISSING` | No queue, no worker, no job table, no scheduler, no cron. `forge_agent_runs` is the closest analogue but is bound to a single HTTP request. `crm_tasks` is unrelated CRM to-dos. | Durable lifecycle: `QUEUED`, `RUNNING`, `WAITING`, `NEEDS_APPROVAL`, `FAILED`, `COMPLETED`, `CANCELLED`. **Blocked on an owner decision about the execution target** — Vercel's 300 s ceiling. | **2–3** |
| **Agent Runtime** | `PARTIAL` — Forge only, synchronous | Real run lifecycle, 60-step budget, 48 tool-call cap, 240 s wall clock, validation recovery phases (`NORMAL`/`DIAGNOSTIC`/`CORRECTION_REQUIRED`/`REVALIDATION_REQUIRED`), cooperative cancellation, completion gates — all in `lib/forge/agent-foundation.ts`. | Not shared, not durable, no streaming, no permissions, no cost. Must be extracted and generalised **without regressing Forge**. | **3** |
| **Tools** | `PARTIAL` — Forge only | 8 live tools hard-coded in `agent-foundation.ts` (`list_files`, `read_file`, `write_file`, `delete_file`, `run_command`, `git_status`, `git_diff`) with a command deny-list and sensitive-path blocking. A **dormant** 14-entry risk-tagged catalog in `lib/forge/forge-tools.ts` — `FORGE_V1_ENABLED_TOOLS = []`, `forgeExecutionProvider = null`. | No shared registry, no input/output schemas, no permission enforcement, no timeouts or retry policy per tool, no cost metadata, no audit trail. The dormant catalog is the right **shape** and should be promoted. | **2–3** |
| **Connectors** | `PARTIAL` | Exactly two, both well built and both Forge-specific: GitHub App (`lib/forge/github-*.ts`, short-lived installation tokens, **zero token persistence**) and Daytona (`lib/forge/daytona-*.ts`). | No connector framework, no credential vault, no scope model. Email, calendar, cloud storage, databases, deployment platforms and CRM all absent. | **7** |
| **Organizations** | `MISSING` | No `organizations`, `memberships` or `teams` table. **Every entity is keyed directly to `auth.users`.** | Entire model plus an RLS rewrite across every table. **Decide in Phase 1 even if built in Phase 9** — retrofitting org scope is expensive. | **1 (decide) / 9 (build)** |
| **Permissions / RBAC** | `MISSING` | No roles beyond Supabase `anon` / `authenticated` / `service_role`. No admin flag. The `READ`/`WRITE`/`EXECUTE`/`DESTRUCTIVE`/`REMOTE` taxonomy exists **only in dead code** (`forge-tools.ts`). | `READ ≠ WRITE ≠ EXECUTE ≠ DEPLOY ≠ EXTERNAL ≠ SPEND`. **Must exist before any autonomous execution.** | **1–3** |
| **Usage** | `PARTIAL` | `usage_limits` counts generations for `/api/generate` only. Plan limits hard-coded in `lib/supabase-server.ts:15-20`. Nova stores token usage in message metadata but never aggregates it. | Four AI endpoints entirely unmetered. No cost model, no per-agent or per-provider attribution. Quota increment is **not atomic** (`lib/supabase-server.ts:109-120`). | **1–2** |
| **Billing** | `PARTIAL` | Stripe checkout, customer portal and webhook all functional via raw REST (`lib/stripe.ts`, no SDK). HMAC signature verified with `timingSafeEqual` and correct App Router raw-body handling. | No webhook timestamp tolerance (replay window) · plan derivation from `checkout.session.completed` may not resolve a price id · no credits · no PAYG · no org limits · **zero test coverage**. | **2** |
| **Observability** | `PARTIAL` | `lib/server-diagnostics.ts` emits structured JSON to `console.error`; used by 3 routes. Ad-hoc `console.error` elsewhere. | No error tracker, no analytics, no tracing, no metrics, no correlation ids, no run-level provenance. Cannot answer "which agent, which model, which tools, what cost". | **2–3** |
| **Admin** | `MISSING` | No `/admin` route, no role check, no control plane. | Dashboard, users, organizations, projects, agents, models, providers, generations, tasks, missions, usage, costs, revenue, errors, logs, feature flags, security events. | **9** |

---

## Cross-cutting infrastructure

| AREA | STATUS | EVIDENCE | GAP | TARGET PHASE |
| --- | --- | --- | --- | --- |
| **Authentication** | `CONFIRMED` | Supabase Auth email/password. Server verification via `getUserFromRequest` → `GET /auth/v1/user` (`lib/supabase-server.ts:30-46`). Signup, login, password reset all implemented. | Sessions stored in `localStorage` (`lib/supabase-client.ts:6,28-40`) — XSS yields account takeover. No `@supabase/ssr`, no cookie sessions. | **1** |
| **Route protection** | `MISSING` | **No `middleware.ts` exists anywhere.** All pages render for anonymous visitors; protection is client-side UI only. | Server-side route protection plus rate limiting at the edge. | **1** |
| **API authorization** | `PARTIAL` | **Strong positive:** no route trusts a client-supplied user identifier. Every authenticated handler derives identity server-side and scopes queries by it. | Three endpoints have **no authentication at all**: `/api/generate-agent`, `/api/agent-builder-v2` (~19 model calls/request), and the official-agent path of `/api/agents/[id]/run` (`route.ts:54-84`). | **0.5** |
| **RLS enforcement** | `PARTIAL` | Every repository-defined table has `ENABLE ROW LEVEL SECURITY`. Policies are correctly `auth.uid()`-scoped with `EXISTS` ownership chains. No `using (true)` anywhere. | **Every server path uses `supabaseAdmin()` with the service role, bypassing RLS entirely.** Policies are correct but inert. `feat/noline-core-data-v1` fixes this for Nova. | **0.5 → 3** |
| **Supabase Storage** | `MISSING` | No buckets, no policies, no upload code. `@supabase/storage-js` present only transitively. | Complete binary asset pipeline. Blocks Files, Artifacts, Muse and Create. | **1** |
| **Rate limiting** | `MISSING` | No rate-limit code or library anywhere in the repository. | Per-user and per-IP limits on all AI endpoints. Amplifies the unauthenticated-endpoint findings into unbounded spend. | **0.5** |
| **Input validation** | `PARTIAL` | Hand-written parsing throughout (`parseProjectInput`, `parseNovaMessageInput`, etc.). Correct but unsystematic. No schema library. | `/api/visuals` and `/api/brand` accept unbounded SVG and base64 payloads. A schema validation layer is needed before a tool-contract system. | **1** |
| **Migrations** | `PARTIAL` | 16 migration files. No destructive operations. Heavy `IF NOT EXISTS` usage. | `set_updated_at()` is **called by 4 applied migrations but defined only in the unapplied proposal**. Five files share the `20260824` prefix with inverted dependency order. Production reportedly has **no migration ledger**. | **0.5** |
| **Generated DB types** | `MISSING` | No `database.types.ts`, no `supabase gen types`. All row types hand-written. | Schema drift is invisible to the compiler. | **1** |
| **Tests** | `PARTIAL` | 17 files, 2,562 lines. **194/197 pass**; the 3 failures use `module.registerHooks()`, unavailable on Node 22.14 (added in 22.15) — environmental, not a code defect. | No `test` or `typecheck` script on `main` — the suite is unrunnable from a clean checkout. Zero coverage for RLS, Stripe, quotas and the 3,462-line Agent Builder module. | **0.5** |
| **CI/CD** | `MISSING` | No `.github/` directory, no workflows. Vercel builds on push only. | Nothing enforces lint, typecheck, tests or audit on any change. | **0.5** |
| **Runtime pinning** | `MISSING` | No `engines` field, no `.nvmrc`, no `.node-version`. | Root cause of the 3 observed test failures. | **0.5** |
| **Dependency security** | `PARTIAL` | `npm audit`: **9 advisories — 1 critical, 6 high, 1 moderate, 1 low.** Critical is the Next.js Image-Optimization / AVIF RCE class affecting all versions ≤ 16.3.2; `main` pins `^16.2.6`. | Fully resolved to audit 0 by the prepared, unmerged `chore/security-production-readiness` branch. | **0.5** |
| **Deployment** | `CONFIRMED` (config) / `UNKNOWN` (state) | Vercel with `vercel.json` (`framework: nextjs`, `npm install`, `npm run build`), documented in `VERCEL_DEPLOYMENT.md`. | ~24 environment variable names in use; only 11 documented in `.env.example`. **Forge's GitHub App and Daytona variables are entirely undocumented.** Live project, domain and configuration are `UNKNOWN`. | **0.5** |

---

## Summary

| Status | Count | Areas |
| --- | --- | --- |
| `CONFIRMED` | 2 | Authentication, Deployment configuration |
| `PARTIAL` | 17 | Projects, Conversations, Messages, Nova, Forge, Artifacts, Agent Runtime, Tools, Connectors, Usage, Billing, Observability, API authorization, RLS enforcement, Input validation, Migrations, Tests |
| `MISSING` | 18 | AI Core, Apex, Muse, Create, Flow, Nexus, Model Gateway, Memory, Files, Tasks/Jobs, Organizations, Permissions/RBAC, Admin, Route protection, Supabase Storage, Rate limiting, Generated DB types, CI/CD, Runtime pinning |
| `UNKNOWN` | — | Production database schema and state; Daytona egress policy; live Vercel configuration |

**Of the seven named product pillars, two are real (NOVA `PARTIAL`, FORGE `PARTIAL` and most complete) and five do not exist (APEX, MUSE, CREATE, FLOW, NEXUS).**

The binding constraint is not any individual pillar. It is that **the shared Core they are all supposed to stand on does not exist yet**, and three prerequisites block starting it: a critical dependency vulnerability, three unauthenticated paid-AI endpoints, and a Nova data model whose tables appear in no applied migration.

See [`NOLINE_STUDIO_AI_MASTER_AUDIT.md` §18](./NOLINE_STUDIO_AI_MASTER_AUDIT.md#18-p0-blockers) for the full P0 blocker list.
