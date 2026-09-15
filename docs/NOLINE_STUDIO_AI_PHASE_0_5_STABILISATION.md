# NØLINE Studio AI — Phase 0.5A · Production Truth & Stabilisation Plan

| Field | Value |
| --- | --- |
| **Phase** | 0.5A — READ / VERIFY / ANALYZE / PLAN |
| **Status** | Complete. Awaiting owner approval before Phase 0.5B. |
| **Date** | 2026-09-15 |
| **Base commit** | `1cffe0cfb6052470cbf34b8366d31d5bb9085c22` (`main`) |
| **Branch** | `cursor/phase-0-master-audit-e71b` (documentation only) |
| **Baseline** | [`NOLINE_STUDIO_AI_MASTER_AUDIT.md`](./NOLINE_STUDIO_AI_MASTER_AUDIT.md) (approved) |
| **Companion** | [`ADR_DURABLE_EXECUTION.md`](./ADR_DURABLE_EXECUTION.md) |

**Change control observed.** No deployment. No production mutation. No migration applied. No branch merged or cherry-picked. No push to `main`. No Core implementation. No pillar implementation. No refactor. No dependency upgraded. No secret value printed or requested. Only documentation was created, on the audit branch.

### Evidence classes used in this document

Every material claim is tagged so the owner can see exactly how much weight it carries.

| Tag | Meaning |
| --- | --- |
| **[VERIFIED]** | Directly observed during Phase 0.5A from an authoritative source (GitHub API, repository contents, git). |
| **[VERIFIED-PRIOR]** | Observed and documented by the previous author on a stated date, with the method inspectable in the repository, but **not independently re-verified here** because this environment has no credentials. |
| **[INFERRED]** | A conclusion deduced from verified facts. The deduction is shown. |
| **[UNKNOWN]** | Not determinable. The specific missing evidence is named. |

---

## 0. Executive summary

Phase 0.5A set out to replace assumption with evidence on seven questions. Six are now answered; one is answered only at second hand.

**The finding that changes the risk picture:** `main` @ `1cffe0c` — the exact commit audited in Phase 0, containing all three unauthenticated paid-AI endpoints, the Next.js advisories and no rate limiting — **is live in Vercel Production right now**, and **the GitHub repository is public**. Anyone can read the source, identify that `/api/generate-agent` and `/api/agent-builder-v2` require no authentication, and call them against the production URL. The second of those spends **20 OpenAI structured-output calls per request**. There is no rate limit, no quota check and no authentication in front of it.

This is not a latent risk awaiting a decision. It is an open, documented, presently-exploitable cost-and-abuse channel.

**The finding that changes the plan:** the repository's migration chain **cannot be replayed**. Two independent, provable defects mean a fresh database cannot be built from `supabase/migrations/`. Production therefore diverges from the repository by construction, and — crucially — **no staging environment can currently be created**, which means the "prove it on staging first" gate that both this plan and the prior author's runbook depend on is presently impossible to satisfy. Fixing the migration chain is a prerequisite for almost everything else.

**The finding that constrains the database:** the Supabase project is on the **Free** plan. Managed daily backups and PITR are Pro-and-above features. No backup, retention policy or restoration exercise has ever been verified. Under the owner's own rule, **database migration is NO-GO** and stays NO-GO until a restorable backup is proven.

**The encouraging finding:** the two unmerged branches are better than expected and largely complementary. `chore/security-production-readiness` takes `npm audit` to zero and supplies the missing `test`/`typecheck` scripts. `feat/noline-core-data-v1` replaces service-role access with the user's own JWT for Nova — making RLS genuinely enforcing for the first time anywhere in this codebase — and its migration is transactional, validates before mutating, and deliberately avoids touching Forge's shared trigger function. Their only conflict with each other is `package.json`, and the resolution is known. Neither was merged.

**Recommended sequence.** Application-layer stabilisation (0.5B) can proceed and should proceed urgently: it touches no database and no data, and it closes the exploitable endpoints. Database migration stays blocked behind a proven backup. Phase 1 Core stays blocked behind both, plus a multi-tenant decision that should be taken *now*, while production contains only **67 rows** in the three Core tables and retrofitting `org_id` is nearly free.

---

## 1. PRODUCTION DEPLOYMENT TRUTH

### 1.1 Verdict

> **`main` @ `1cffe0cfb6052470cbf34b8366d31d5bb9085c22` IS DEPLOYED TO VERCEL PRODUCTION.** **[VERIFIED]**
> It is the current `main` tip, the commit audited in Phase 0, and the most recent Production deployment. It has been live since **2026-09-05T13:48:36Z**.

### 1.2 Evidence

Obtained from the GitHub Deployments and Statuses APIs via the authenticated read-only `gh` CLI. **[VERIFIED]**

| Fact | Value |
| --- | --- |
| Repository | `yNono57/noline-ai-studio` |
| **Repository visibility** | **PUBLIC** (`"private": false`, `"visibility": "public"`) |
| Default branch | `main` |
| Vercel scope / team | `nonolp57-4104s-projects` |
| Vercel project | `noline-ai-studio` |
| Production deployment id | `6281691954` |
| Deployed SHA | `1cffe0cfb6052470cbf34b8366d31d5bb9085c22` |
| Environment | `Production` |
| State | `success` — "Deployment has completed" |
| Created | `2026-09-05T13:48:36Z` |
| Deployment URL | `https://noline-ai-studio-bw3bacjqr-nonolp57-4104s-projects.vercel.app` |
| Vercel dashboard | `https://vercel.com/nonolp57-4104s-projects/noline-ai-studio/5pzHpppSZACwHFx9Q1zhi7Fsxsby` |
| Repository homepage field | `https://noline-ai-studio.vercel.app` |
| Deployment history | **64 Production**, 7 Preview |
| Check runs on `main` HEAD | **0** — independently confirms no CI |

Commit-status evidence, verbatim from the API:

```
context:     "Vercel"
state:       "success"
description: "Deployment has completed"
target_url:  "https://vercel.com/nonolp57-4104s-projects/noline-ai-studio/5pzHpppSZACwHFx9Q1zhi7Fsxsby"
created_at:  "2026-09-05T13:48:36Z"
sha:         "1cffe0cfb6052470cbf34b8366d31d5bb9085c22"
```

### 1.3 What this means, stated plainly

The Phase 0 audit assessed a commit. That commit is production. Every Phase 0 finding is therefore a **live production finding**, not a hypothetical:

- `/api/generate-agent` — no authentication, calls OpenAI. **Live.**
- `/api/agent-builder-v2` — no authentication, **20 OpenAI calls per request**. **Live.**
- `/api/agents/[id]/run` official-agent path — no authentication, calls OpenAI. **Live.**
- No rate limiting anywhere in the codebase. **Live.**
- Next.js `^16.2.6` with an AVIF-class advisory affecting the always-exposed image optimiser. **Live.**

The **public repository** compounds all of these. An attacker does not need to discover the unauthenticated endpoints by probing; the source code showing the missing auth check is published, and the production hostname is in the repository's own homepage field. Discovery cost is zero.

### 1.4 Preview deployments

Both unmerged branches have successful Preview deployments, corroborating the prior author's claim that the security branch built and served correctly. **[VERIFIED]**

| SHA | Branch | Environment | Created |
| --- | --- | --- | --- |
| `ce3256a8` | `chore/security-production-readiness` | Preview · success | 2026-09-12T08:48:12Z |
| `b8b712ff` | `chore/security-production-readiness` | Preview · success | 2026-09-12T08:44:11Z |
| `bb9ec93a` | `feat/noline-core-data-v1` | Preview · success | 2026-09-11T20:58:54Z |

**Disclosure:** pushing the Phase 0 documentation branch automatically produced Preview deployment `6449667202` (`9088837`, 2026-09-15T01:16:35Z). This is the Vercel Git integration behaving normally for any push to this repository. It is a **Preview**, not Production; nothing was promoted, and the deployment contains only documentation changes. Noted because Phase 0.5A committed to disclosing every production-adjacent side effect.

### 1.5 What remains UNKNOWN

| Unknown | Missing evidence | Why it matters |
| --- | --- | --- |
| **Vercel plan** (Hobby / Pro / Enterprise) | Vercel API or dashboard access. Not derivable from GitHub or the repository. | Sets the function ceiling: 300 s Hobby vs 800 s Pro vs 1800 s beta. Blocks ADR stage S0. Hobby also prohibits commercial use, and this project has live Stripe billing. |
| Custom production domain | Vercel project settings | `noline-ai-studio.vercel.app` appears in the repository homepage field but is not confirmed as the assigned production alias. |
| Production environment variables | Vercel dashboard | Cannot confirm which of the ~24 variables the code reads are actually set. `.env.example` documents only 11. |
| Branch protection on `main` | Returns HTTP 403 "Resource not accessible by integration" — the token lacks admin scope | Cannot confirm whether direct pushes to a production-deploying branch are restricted. |
| Whether auto-deploy on push to `main` is enabled | Vercel project settings | 64 Production deployments tracking `main` commits strongly suggest yes, but this is inference, not configuration. |

### 1.6 Immediate consequence

Because `main` auto-deploys to Production (inferred from 64 Production deployments tracking `main`), **any merge to `main` ships to production**. Every remediation in §4–§8 must therefore be treated as a production deployment, validated on a Preview first, and merged deliberately — never as a routine merge.

---

## 2. PRODUCTION DATABASE TRUTH

### 2.1 Method and its honest limits

The owner authorised read-only verification **only if authenticated tooling was already available**. It is not:

| Tool | Status |
| --- | --- |
| `supabase` CLI | **ABSENT** |
| `psql` / `pg_dump` | **ABSENT** |
| `DATABASE_URL`, `SUPABASE_*`, any connection string | **ABSENT** — 36 environment variables present, zero matching any credential pattern |
| Supabase MCP connector | Not available in this environment |
| Network egress to `*.vercel.app` | **Blocked** (`SSL_ERROR_SYSCALL`) |

No credentials were requested, because requesting them would exceed Phase 0.5A's mandate.

Therefore **no direct database verification was performed in Phase 0.5A.** What follows is drawn from the prior author's read-only audit of **2026-09-12**, recorded in `docs/security/supabase-readiness.md` and `docs/security/validation.md` on `chore/security-production-readiness`. Its method is inspectable: `scripts/security/core-readiness-snapshot.sql` opens with

```sql
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';
```

and contains only `SELECT`s over `pg_catalog` plus row counts and `md5` fingerprints. **I read this script and confirm it is genuinely read-only and cannot mutate.** The findings are tagged **[VERIFIED-PRIOR]** throughout: credible, dated, method-inspectable — but three days stale and not re-confirmed.

### 2.2 Observed production state — 2026-09-12 **[VERIFIED-PRIOR]**

| Property | Value |
| --- | --- |
| Supabase project ref | `wkjdsdkoidkmheusbwop` (`noline-ai-studio`) |
| Region | `eu-west-1` |
| Health | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1.155` |
| Organisation | `rqunhujktsfmvjhkltrq` |
| **Plan** | **Free** (confirmed via `get_organization`) |
| **Core table rows** | **3 `projects` / 9 `conversations` / 55 `messages`** |
| Referential integrity | **Zero orphans** across all three Core tables |
| **Migration ledger** | **`supabase_migrations.schema_migrations` ABSENT**; `list_migrations` returned `[]` |
| `public.set_updated_at()` | **PRESENT** — PL/pgSQL, `RETURNS trigger`, SECURITY INVOKER, owner `postgres`, **no `search_path` set** |
| `public.core_set_updated_at()` | Absent — Core V1 not applied |
| `public.handle_new_user()` | PRESENT — SECURITY DEFINER, `search_path = ''`, EXECUTE granted to `PUBLIC`/`anon`/`authenticated` |
| Security advisors | **4 WARN**, 0 ERROR |
| Performance advisors | **21 WARN + 19 INFO** = 40 |

### 2.3 The three-way comparison the owner requested

#### Repository migrations vs actual remote schema

| Repository says | Production actually has | Verdict |
| --- | --- | --- |
| 16 migrations in `supabase/migrations/` | **No ledger exists at all** — nothing records what was applied | **DIVERGENT.** Production cannot state its own schema version. |
| `projects`, `conversations`, `messages` exist **only** in `supabase/PROPOSED_001_PROJECT_CONVERSATIONS.sql`, a file whose header says *"PROPOSITION UNIQUEMENT : ne pas exécuter sans revue"* and which is **not** in `migrations/` | **All three tables EXIST and hold 3/9/55 rows, with 12 RLS policies** | **DIVERGENT — and this is the decisive finding.** The "do not execute" file was executed, out-of-band. |
| `set_updated_at()` is **defined by no migration** — only inside the PROPOSED file | Exists in production with **seven** UPDATE triggers attached | **DIVERGENT.** Created out-of-band; five applied migrations depend on it (see §8.1). |
| 16 migrations replayed in order should reproduce production | **Chain cannot replay at all** (§8.1, §8.2) | **UNREPRODUCIBLE.** |

#### Application expectations vs actual remote schema

| Application expects | Production has | Verdict |
| --- | --- | --- |
| `lib/chat/conversation-store.ts` reads/writes `projects`, `conversations`, `messages` | Present with data | **MATCHES.** Nova works in production — the Phase 0 concern that it might be broken is resolved: it works *because* the schema was applied manually. |
| `lib/supabase-server.ts` writes `generations`, `usage_limits`, `profiles`, `subscriptions` | Present (implied by 64 production deployments and Stripe operation) | **[INFERRED]** Consistent; not directly enumerated in the 2026-09-12 snapshot, which scoped to Core + Forge tables. |
| Forge tables `forge_*`, `github_connections` | Present, with RLS policies and update triggers | **MATCHES.** |
| `generated_texts`, `monthly_quotas`, `favorites`, `clients` defined in `supabase/schema.sql` | Not enumerated in the snapshot | **[UNKNOWN]** — no TypeScript references these; likely present but dead. |

### 2.4 Conclusions

1. **Production schema is authoritative; the repository is not.** The repository is an incomplete, non-replayable *description* of a database that was partly built by hand. Any future migration must be written defensively against what is actually there — which is precisely the discipline the Core branch's migration already adopts (§12).
2. **The Phase 0 "Nova tables missing" finding is now refined, not overturned.** The tables are not missing from *production*; they are missing from the *migration chain*. The defect is process, not outage. The Phase 0 concern that Nova might be silently failing in production is **resolved as NO** — Nova has live data.
3. **`set_updated_at()` is shared infrastructure.** Seven triggers across Core and Forge depend on one unpinned-`search_path` function. Any change to it is a Forge-affecting change and requires Forge validation — which is exactly why the Core branch namespaces its own copy rather than modifying it (§12.2).
4. **The data is tiny.** 67 rows across the three Core tables. This is materially important for §9: retrofitting `org_id` onto 67 rows is close to free today, and that will never be more true than it is now.

### 2.5 What must be re-verified before any migration

- Re-run `scripts/security/core-readiness-snapshot.sql` immediately before any write window; confirm 3/9/55 (or record the new baseline) and capture the content fingerprints.
- Enumerate the legacy tables the 2026-09-12 snapshot did not cover.
- Confirm the plan has not changed and re-run the advisors.

---

## 3. BACKUP / RECOVERY TRUTH

### 3.1 Verdict

> **NO VERIFIED, RESTORABLE BACKUP EXISTS.** **[VERIFIED-PRIOR]**
> Under the owner's Decision 1, **database migration is NO-GO** and remains NO-GO until this changes.

### 3.2 Evidence

The prior author's audit is unambiguous (`docs/security/supabase-readiness.md`, 2026-09-12):

> *"Le plan Free a été vérifié par le connecteur. Les sauvegardes quotidiennes administrables sont documentées pour Pro/Team/Enterprise ; PITR nécessite Pro ou plus […] **Ne pas considérer une sauvegarde quotidienne gérée ou PITR comme disponible pour ce projet Free.** […] aucun export, rétention ou exercice de restauration n'a été fourni ou vérifié."*

| Question | Answer | Source |
| --- | --- | --- |
| Is the project on a plan with managed daily backups? | **No** — Free | **[VERIFIED-PRIOR]** |
| Is PITR available? | **No** — requires Pro+, the add-on, and compatible compute | **[VERIFIED-PRIOR]** |
| Does a recent logical export exist? | **UNKNOWN** — none provided or found | **[VERIFIED-PRIOR]** |
| Has any restoration ever been exercised? | **No** | **[VERIFIED-PRIOR]** |
| Last successful backup date? | **UNKNOWN** | **[VERIFIED-PRIOR]** |
| Are Storage objects covered? | **No** — a PostgreSQL backup never includes Storage. (Phase 0 found Storage is currently unused, so present exposure is nil.) | **[INFERRED]** |

The Management API endpoint `GET /v1/projects/{ref}/database/backups` exists but was never called: no Management API token was extracted or requested, and dashboard access was unavailable. That remains true in Phase 0.5A.

`ACTIVE_HEALTHY` is a liveness signal. It says nothing whatsoever about recoverability. These must not be conflated.

### 3.3 Required before database migration becomes GO

All five, in order. Each produces an artifact the owner can point to.

| # | Requirement | Acceptance evidence |
| --- | --- | --- |
| **B1** | Produce a full logical export (`pg_dump`) covering `public`, `auth`, roles, grants, RLS policies, functions and triggers. | Dump file exists, size and checksum recorded, stored **outside the Git repository** and outside Supabase. |
| **B2** | Verify coverage. Confirm the dump contains the three Core tables at the expected row counts, all `forge_*` tables, `auth.users`, and the RLS policies. | A documented manifest, not an assumption. |
| **B3** | **Restore it into an isolated, empty database and prove the application runs against it.** A backup that has never been restored is a hypothesis. | Restored row counts match; Nova and Forge smoke tests pass against the restored copy. |
| **B4** | Record the recovery objectives: how long a restore takes (RTO) and how much data a restore would lose (RPO). | Written figures from the B3 exercise, not estimates. |
| **B5** | Decide whether the recurring backup mechanism is a Supabase paid plan or a self-managed scheduled export, and schedule it. | A running, monitored schedule. |

**B3 is the gate.** B1 and B2 are necessary but prove nothing on their own.

### 3.4 Note on plan upgrade

Upgrading Supabase to Pro would satisfy B5 with managed daily backups and unlock PITR and leaked-password protection (advisor #4). It does **not** satisfy B3 — a restoration exercise is still required, because managed backups fail silently more often than teams expect. Plan upgrade is a **commercial decision for the owner**; this document does not presume it.

---

## 4. SECURITY P0 REMEDIATION PLAN — dependencies

### 4.1 Current state

`main` carries **9 vulnerable packages**: 1 critical, 6 high, 1 moderate, 1 low. **[VERIFIED]** — reproduced in Phase 0.

### 4.2 Exposure analysis, refined

The Phase 0 audit reported the Next.js advisories as a single critical finding. The prior author's per-advisory analysis (`docs/security/npm-remediation.md`) allows a more precise statement, and the distinction matters for prioritisation:

| Advisory | Severity | Actually exposed in this production? | Reasoning |
| --- | --- | --- | --- |
| `GHSA-p293-qw3h-jr36` / `CVE-2026-75604` — Next.js RCE | **Critical** | **NO** | Affects App/Pages Router hosted on **Windows**. Production is Linux on Vercel. Local Windows development is potentially affected. |
| `GHSA-2xp9-vwfh-vxw4` — Next.js AVIF decode/optimise bypass | **Critical** | **YES** | The image optimiser is an exposed route **even with no `next/image` import**. This is the genuinely production-exposed critical issue. |
| `GHSA-rgj7-g3m4-5g8c` — sharp / libheif | High | **YES** — same path as above | Native decoder reached through the optimiser. |
| Middleware bypass, Server-Actions DoS, SSRF, cache poisoning, Edge payload, rewrite SSRF, SVG DoS, disclosure | High/Moderate | **Reduced** | The repository contains **no** Server Actions, no middleware, no rewrites and no custom server. |
| PostCSS, browserslist, brace-expansion, js-yaml, nanoid, postcss-selector-parser | High→Low | **Build chain only** | No proven path from untrusted input to these on the production host. |

**Net:** one critical issue is genuinely live in production — the AVIF/image-optimiser path. The headline Windows RCE is not exposed here. This does not reduce the urgency of patching (the build chain must be clean regardless, and "not currently exposed" is a fragile property), but it does mean the dependency issue is **less acute than the unauthenticated endpoints in §5**, which are exploitable today by anyone reading the public repository.

### 4.3 Remediation — already built, not merged

`chore/security-production-readiness` takes `npm audit` to **0 vulnerabilities**. **[VERIFIED-PRIOR]**, and independently corroborated by a successful Vercel Preview build **[VERIFIED]**.

| Package | Before | After | Relationship |
| --- | --- | --- | --- |
| `next` | 16.2.6 | **16.3.3** | direct, runtime |
| `eslint-config-next` | 16.2.6 | **16.3.3** | direct, tooling — pinned to match `next` |
| `sharp` | 0.34.5 | 0.35.4 | optional dep of Next |
| `postcss` | 8.5.15 | 8.5.23 | direct dev + Next/Tailwind, with `$postcss` override |
| `baseline-browser-mapping` | 2.10.33 | 2.11.22 | transitive |
| `browserslist` | 4.28.2 | 4.28.9 | transitive |
| `brace-expansion` | 1.1.15 / 5.0.6 | 1.1.18 / 5.0.9 | transitive, both majors kept |
| `js-yaml` | 4.2.0 | 4.3.2 | ESLint |
| `nanoid` | 3.3.12 | 3.3.19 | PostCSS |
| `postcss-selector-parser` | 6.1.2 | 6.1.4 | Tailwind |

Method is sound: targeted `package.json` edits plus scoped `npm update`, **no `npm audit fix --force`**, and **no application dependency touched** — Daytona, Supabase, OpenAI, React and Tailwind are all unchanged. That restraint is what makes this branch low-risk.

### 4.4 Residual risk and required validation

The Next 16.2 → 16.3 minor bump is the only real regression surface: cache/routing behaviour, Turbopack, AVIF handling and native `sharp` binaries. Mitigations already in place are 217 passing tests, a green Turbopack production build and a successful Vercel Preview.

**Required before merge:**
1. Re-run `npm audit` at merge time — the zero result is dated 2026-09-12 and new advisories appear continuously.
2. Exercise the Preview manually: authenticated Nova conversation, a Forge run, image rendering.
3. Confirm the production build output still emits 50 pages and all 57 API routes.

### 4.5 Recommendation

Merge the dependency remediation **as part of Phase 0.5B**, together with §5 and §6, in a single reviewed deployment. It is ready, validated, and its exposure profile is well understood.

---

## 5. AUTHENTICATION PLAN FOR OPEN AI ENDPOINTS

### 5.1 The three endpoints

| Endpoint | Auth today | Cost per request | Live in production? |
| --- | --- | --- | --- |
| `/api/generate-agent` | **None** | 1 OpenAI chat completion, `max_tokens: 1800` | **Yes** |
| `/api/agent-builder-v2` | **None** | **20 model calls** — 5 sequential, then `Promise.all` of 5, then `Promise.all` of 10, all JSON-schema structured outputs | **Yes** |
| `/api/agents/[id]/run` (official-agent path) | **None** — `if (!officialAgent)` skips the auth check | 1 OpenAI call | **Yes** |

`/api/agent-builder-v2` is the severe one. Twenty structured-output model calls, no authentication, no quota check, no rate limit, and the route declares **no `maxDuration`** so it inherits the 300 s default. A trivial script could drive substantial OpenAI spend, and because the repository is public the absence of an auth check is documented for the attacker in advance.

### 5.2 The systemic defect behind them

The individual missing checks are symptoms. The root cause is that **the authentication helper fails open**:

```ts
export async function getUserFromRequest(request: Request) {
  if (!isSupabaseServerConfigured()) return null;   // ← unconfigured ⇒ "no user"
  ...
}
```

`lib/supabase-server.ts:30-31`. "Supabase is not configured" and "this request is anonymous" return the identical value, `null`. **18 API routes** then wrap their auth check in `if (isSupabaseServerConfigured()) { ... }`, so if the environment variables were ever absent or misnamed in production, every one of those routes would silently serve unauthenticated.

This is a latent full-application authentication bypass, gated only on environment configuration being correct. It has not fired — production clearly has Supabase configured — but it is one misconfiguration away, and it deserves fixing as a class rather than endpoint by endpoint.

Encouragingly, `feat/noline-core-data-v1` already fixes exactly this pattern for Nova: its `authenticate()` throws **503** when Supabase is unconfigured and **401** when the token is absent or rejected, cleanly separating the two cases (§12.2).

### 5.3 Remediation

Deliberately minimal and mechanical. This is stabilisation, not redesign.

**Step 1 — make the helper fail closed.**

Introduce a strict variant that distinguishes the three outcomes, modelled directly on the Core branch's `authenticate()`:

- Supabase not configured → **503 Service Unavailable** (never "anonymous")
- No/invalid bearer token → **401 Unauthorized**
- Valid token → the user

Keep the existing `getUserFromRequest` untouched so no current caller changes behaviour. Additive only.

**Step 2 — apply it to the three endpoints.**

| Endpoint | Change |
| --- | --- |
| `/api/generate-agent` | Require authentication at the top of `POST`, before `getOfficialAgent`. Preserve the existing `OPENAI_API_KEY`-absent demo fallback so the public demo mode still works when no key is configured. |
| `/api/agent-builder-v2` | Require authentication before constructing `AgentBuilderService`. **Additionally gate on quota** — this single request costs 20 model calls and must count against the user's plan. |
| `/api/agents/[id]/run` | Delete the `if (!officialAgent)` exemption at lines 54-84 so official and custom agents follow the same authenticated path. |

**Step 3 — client updates.** The corresponding UI components must send `Authorization: Bearer <token>`, matching the pattern already used by Nova and Forge clients. No new mechanism is required.

**Step 4 — audit the class.** Review all 18 `isSupabaseServerConfigured()` call sites and record, per route, whether unauthenticated access is intentional. Fix any further unintended cases. Do not change intentional public routes in 0.5B.

### 5.4 Deliberate non-goals for 0.5B

Not now: unifying Nova's, Forge's and legacy's three parallel auth helpers; moving sessions from `localStorage` to httpOnly cookies (a real HIGH finding from Phase 0, but a cross-cutting change belonging to Phase 1); introducing middleware-based route protection. Each is correct and each is too large for a stabilisation sprint.

### 5.5 Acceptance criteria

1. Unauthenticated `POST` to all three endpoints returns **401** and performs **zero** OpenAI calls.
2. Authenticated requests behave exactly as before.
3. With Supabase env vars removed, all three return **503**, never 200.
4. `/api/agent-builder-v2` returns **429** when the caller's quota is exhausted.
5. All 197 existing tests still pass; new tests cover the 401, 503 and quota paths.

---

## 6. RATE LIMITING PLAN

### 6.1 Current state

**There is no rate limiting anywhere in the codebase.** **[VERIFIED]** — no limiter, no counter, no `Retry-After`, no `429` emitted by any route. The only spend control is the monthly quota in `usage_limits`, which is checked by `/api/generate` and `/api/visuals` only — and never by any of the three unauthenticated endpoints.

### 6.2 Design constraints

Any design must respect four facts about this system:

1. **Serverless.** Vercel functions are stateless and horizontally scaled; an in-memory counter is per-instance and therefore not a limit.
2. **No Redis, no Upstash, no KV** exists in the project today. Introducing one is a new dependency and a new secret.
3. **Supabase Postgres is already present** and already the system of record for quota.
4. **The maintainer is one person.** The mechanism must be simple enough to reason about at 2 a.m.

### 6.3 Recommended approach: Postgres-backed fixed-window counters

A single table, one atomic upsert per request.

```
rate_limit_counters
  subject_type   text     -- 'user' | 'ip' | 'org'
  subject_id     text
  bucket         text     -- logical endpoint group
  window_start   timestamptz
  count          integer
  PRIMARY KEY (subject_type, subject_id, bucket, window_start)
```

An `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count` is atomic and correct under concurrency. A daily job prunes expired windows.

**Why this and not Upstash Redis:** Redis is the better long-term answer and is what a mature system would use. But it adds a vendor, a secret and an availability dependency for a project that currently has no rate limiting *at all*. The gap between "none" and "Postgres counters" is enormous; the gap between "Postgres counters" and "Redis" is a latency optimisation. Take the first step now. Revisit when the durable-execution engine is chosen (§ADR), since Inngest and Upstash both bring throttling primitives that may make a separate limiter redundant.

**Fixed windows, not sliding:** fixed windows permit a burst at a window boundary. That is an acceptable imprecision for abuse prevention and it keeps the implementation to a single SQL statement. Precision is not the goal; bounding spend is.

### 6.4 Proposed boundaries

Every AI endpoint is limited by **user**; unauthenticated-by-design surfaces are limited by **IP**. Figures below are starting points to be tuned from observed traffic, not derived constants.

| Bucket | Endpoints | Limit | Rationale |
| --- | --- | --- | --- |
| `ai:heavy` | `/api/agent-builder-v2` | **3 / hour / user**, **10 / day / user** | 20 model calls per request. This is the single most expensive operation in the product. |
| `ai:standard` | `/api/generate`, `/api/generate-agent`, `/api/agents/[id]/run`, `/api/visuals` | **20 / hour / user** | Normal interactive generation. |
| `ai:chat` | `/api/nova/.../messages` | **60 / hour / user** | Conversational; higher natural frequency. |
| `ai:agent-run` | `/api/forge/.../agent-runs` | **10 / hour / user**, max **1 concurrent** | Long-running and expensive. Concurrency is already enforced by a DB unique index — keep that as the authority. |
| `sandbox` | Forge workspace/runtime creation | **20 / hour / user** | Daytona sandboxes cost money per provision. |
| `auth` | Login, signup, password reset | **10 / 15 min / IP** | Credential stuffing. Supabase applies its own limits; this is defence in depth. |
| `billing` | `/api/stripe/checkout`, `/api/stripe/portal` | **10 / hour / user** | Prevents session-creation abuse. |
| `webhook` | `/api/stripe/webhook` | **Exempt** | Stripe-signature authenticated. Must not be limited — dropping webhooks corrupts billing state. |

### 6.5 Response contract

On exceed: **HTTP 429**, a `Retry-After` header, and a neutral French error message consistent with the rest of the API. Never leak the limit value or the current count.

### 6.6 Global cost circuit breaker

Separate from per-user limits, and arguably more important: a **platform-wide daily OpenAI spend ceiling**. If aggregate model calls in 24 h exceed a configured threshold, AI endpoints return 503 and the owner is alerted. Per-user limits bound one abuser; a global ceiling bounds the invoice. Given that Phase 0 found no cost observability of any kind, this is the single highest-value control in this section.

### 6.7 Sequencing

Rate limiting requires a migration, and **database migration is NO-GO** until §3 clears. Two options:

- **6.7a (recommended for 0.5B):** ship §5 authentication **without** the limiter. Authentication alone removes anonymous abuse entirely — the dominant risk — and requires no schema change. Authenticated abuse is bounded by existing quotas.
- **6.7b (0.5C, after backup):** add the `rate_limit_counters` table and enforce the boundaries above.

This split is what makes urgent action possible while the database stays correctly frozen.

---

## 7. NODE / CI REPRODUCIBILITY PLAN

### 7.1 The problem

Phase 0 found 3 of 197 tests failing. The cause is environmental, not a code defect: the three failing files call `module.registerHooks()`, which is `undefined` on Node **22.14.0** — the API landed in **22.15.0**. **[VERIFIED]**

The deeper issue is that nothing in the repository states which Node version is required:

| Missing | Consequence |
| --- | --- |
| No `engines` field in `package.json` | No declared minimum |
| No `.nvmrc` / `.node-version` | Contributors and CI silently diverge |
| No `test` or `typecheck` script on `main` | The suite is not runnable by convention — Phase 0 had to install `tsx` manually to run it |
| No `.github/workflows/` | Zero automated verification; **0 check runs** on `main` HEAD **[VERIFIED]** |
| Vercel Node version unpinned | Build runtime unknown |

### 7.2 Runtime decision

> **Minimum supported Node: `>=22.15.0`.** Pin CI and local development to the current **Node 22 LTS**.

Rationale: 22.15.0 is the lowest version satisfying the test suite's actual requirement, and staying on the 22 LTS line avoids a simultaneous major-runtime change during a stabilisation phase. The prior author validated the security branch on Node 24 locally, so the code is not 22-bound — but choosing 24 now would mean changing the runtime and the dependencies in the same sprint, and one variable at a time is the point of stabilisation.

**Changes:**
- `package.json` → `"engines": { "node": ">=22.15.0" }`
- Add `.nvmrc` containing the pinned 22 LTS version
- Set the Vercel project's Node version to 22.x to match **(owner action — dashboard)**

### 7.3 Scripts

Both branches already add these; the Core branch's version is a strict superset and is the one to adopt:

```json
"typecheck": "tsc --noEmit",
"test": "node --import tsx --test tests/*.test.ts && npm run test:core",
"test:core": "node --conditions=react-server --import tsx --test tests/core-*.test.cjs"
```

with `tsx@4.20.6` as a devDependency. Until the Core branch is integrated, the `test:core` half is inert but harmless.

### 7.4 CI gates

A single workflow on push and pull request, all six gates required, no `continue-on-error`:

| # | Gate | Command | Fails on |
| --- | --- | --- | --- |
| 1 | Install | `npm ci` | Lockfile drift or unresolvable deps |
| 2 | Lint | `npm run lint` | Any ESLint error |
| 3 | Typecheck | `npm run typecheck` | Any TypeScript error |
| 4 | Test | `npm test` | Any failing test |
| 5 | Build | `npm run build` | Build failure |
| 6 | Security | `npm audit --audit-level=high` | Any high or critical advisory |

Notes on gate 6: fail on **high and above** rather than all severities, so a low-severity transitive advisory cannot block an urgent security fix — the exact deadlock worth designing out in advance. Add a scheduled weekly run of the same workflow so newly published advisories surface without waiting for a commit.

Concurrency should cancel superseded runs per branch. A matrix is unnecessary: one Node version, matching production.

### 7.5 Branch protection (owner action)

CI is advisory until `main` requires it. Recommended, once CI is green and stable: require all six checks to pass before merge to `main`, and require pull requests rather than direct pushes. This matters more here than in most projects because **`main` auto-deploys to Production** (§1.6) — today, a direct push ships to users with no verification whatsoever.

Current branch protection state is **[UNKNOWN]** (§1.5) — the token cannot read it.

### 7.6 Acceptance criteria

1. `npm test` passes **197/197** on Node ≥ 22.15.0.
2. All six gates pass on the audit branch before any Phase 0.5B merge.
3. A deliberately broken commit is rejected by CI.
4. The Vercel build Node version matches `.nvmrc`.

---

## 8. MIGRATION CHAIN REMEDIATION

### 8.1 Defect 1 — `set_updated_at()` is referenced but never defined **[VERIFIED]**

Five applied migrations attach triggers calling `public.set_updated_at()`:

| Migration | Line |
| --- | --- |
| `20260824_forge_v1_foundation.sql` | 40, 46 |
| `20260824_forge_v13_workspace_foundation.sql` | 43 |
| `20260824_forge_v13_runtime_phase1.sql` | 42 |
| `20260824_forge_github_connection.sql` | 56 |

The function is defined in exactly one place in the repository:

```
supabase/PROPOSED_001_PROJECT_CONVERSATIONS.sql:37
```

— the file marked *"do not execute without review"*, which is **not** in `supabase/migrations/`.

**Consequence:** replaying the migration chain against an empty database fails. The function does not exist, so the trigger creation errors.

**Corroboration:** production *has* the function with seven triggers attached (§2.2), which proves it was created out-of-band — the PROPOSED file, or part of it, was run manually.

### 8.2 Defect 2 — the `20260824` group is ordered wrongly **[VERIFIED]**

All five Forge migrations share the date prefix `20260824`, so replay order is decided by the lexicographic sort of the remaining filename. That order is:

| Replay position | File |
| --- | --- |
| 1 | `20260824_forge_github_connection.sql` |
| 2 | `20260824_forge_v13_runtime_phase1.sql` |
| 3 | `20260824_forge_v13_workspace_foundation.sql` |
| 4 | `20260824_forge_v14_agentic_execution_loop.sql` |
| 5 | `20260824_forge_v1_foundation.sql` ← **last** |

`"v1"` sorts *after* `"v13"` and `"v14"` because `'1' < '3'` at the third character. So the foundation runs last — yet:

- `20260824_forge_v13_workspace_foundation.sql:8` → `references public.forge_projects(id)`
- `20260824_forge_v14_agentic_execution_loop.sql:7-10` → references `forge_projects`, `forge_conversations`, `forge_workspaces`, `forge_workspace_runtimes`

and `forge_projects` / `forge_conversations` are created by `20260824_forge_v1_foundation.sql` (lines 5, 18) — the file that runs *last*.

**Consequence:** replay fails at position 2 or 3 with an undefined-table error, independently of Defect 1.

### 8.3 Defect 3 — there is no migration ledger **[VERIFIED-PRIOR]**

`supabase_migrations.schema_migrations` does not exist in production and `list_migrations` returns `[]`. Nothing records what has been applied. Migration state is unknowable from the database, and any tool that consults the ledger will believe **nothing** has been applied — and, if allowed to, would attempt to replay all 16 migrations against a populated production database.

### 8.4 Defect 4 — remote/local divergence

Established in §2.3. Production contains objects no migration creates (`projects`, `conversations`, `messages`, their 12 RLS policies, `set_updated_at()`). The repository cannot reproduce production, and production cannot be described by the repository.

### 8.5 Why these compound into something worse than their sum

Individually these are hygiene problems. Together they produce a specific, serious operational consequence:

> **No staging environment can currently be created from the repository.**

Both this plan and the prior author's runbook depend on "validate on staging first". That gate is **currently impossible to satisfy** — you cannot stand up a database that resembles production, because the migrations do not replay and the only complete description of production is production itself.

Fixing the chain is therefore not cleanup deferred until convenient. It is the prerequisite that makes every subsequent database change verifiable.

### 8.6 Remediation plan

Strictly additive. **Never rename, edit or delete an applied migration** — production has already run them, and renaming would desynchronise any future ledger.

| Step | Action | Risk |
| --- | --- | --- |
| **M1** | Add `supabase/migrations/00000000000000_bootstrap_shared_functions.sql` defining `public.set_updated_at()` with `create or replace` and an explicit `set search_path = ''`. The all-zero prefix guarantees it sorts first. Idempotent, so it is a no-op against production. | **Low.** `create or replace` on an identical body is safe; it also closes security advisor #1. |
| **M2** | Resolve the ordering. Two viable routes:<br>**(a)** Add a `docs/MIGRATION_ORDER.md` declaring the canonical order and drive replay from it — zero risk, but relies on discipline.<br>**(b)** Renumber the five `20260824_*` files to distinct ordered prefixes — correct, but rewrites history that production has already applied. **Only safe while no ledger exists** (§8.3), which is, ironically, right now. | **(a)** none · **(b)** medium, and it must precede M3. |
| **M3** | Establish the ledger. Create `supabase_migrations.schema_migrations` and **backfill it with every migration already applied**, marking them applied without re-running them. Do not let any tool replay them. | **High — the most dangerous step in this plan.** Requires a verified backup (§3) and a write window. |
| **M4** | Reconcile the out-of-band objects. Add a migration that declares `projects`, `conversations`, `messages` and their policies using `create table if not exists` plus validation guards, so a fresh database gets them and production is unaffected. **The Core branch's migration already does exactly this** (§12.2) — this step is largely satisfied by that work. | Low, given the Core migration's validate-before-mutate design. |
| **M5** | Prove it. Replay the full chain against an empty PGlite or local Postgres in CI and assert it completes. Add this as a seventh CI gate. | None — it is a test. |

**Sequencing:** M1, M2(a) and M5 are **repository-only**, mutate nothing, and can proceed in Phase 0.5B. M3 and M4 touch production and are **blocked behind the backup gate**.

That split matters: it means the "no staging possible" problem can be **fixed in 0.5B without touching production at all** — M1 + M2(a) + M5 together make the chain replayable into a fresh database, which is precisely what a staging environment needs.

---

## 9. MULTI-TENANT FOUNDATION

### 9.1 The owner's constraint, and the evidence that shapes it

The owner directed: target multi-tenant; do not retrofit organisation scope after the whole data model is built; but do not perform a speculative full rewrite in Phase 0.5. Define the **minimum** foundation.

Two facts from this phase bear directly on where that minimum sits:

1. **Production holds 67 rows** in the three Core tables — 3 projects, 9 conversations, 55 messages **[VERIFIED-PRIOR]**. The migration cost of adding `org_id` is, today, effectively zero.
2. **The Core branch's migration is unapplied and still editable** (§12). Adding `org_id` to it costs a diff. Adding `org_id` after it ships costs a second migration against live data — small now, larger every month.

Those two facts converge on a clear conclusion: **the cheapest possible moment to introduce organisation scope is the moment the Core tables are first created — which has not happened yet.** Missing it is not fatal, but it is a needless future cost, and it is exactly the retrofit the owner asked to avoid.

### 9.2 Recommended minimum foundation

Four tables and one column. Nothing more.

```
organizations
  id            uuid pk default gen_random_uuid()
  name          text not null check (length(btrim(name)) > 0)
  slug          text unique not null
  created_by    uuid not null references auth.users(id)
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()

organization_members
  organization_id uuid not null references organizations(id) on delete cascade
  user_id         uuid not null references auth.users(id) on delete cascade
  role            text not null check (role in ('owner','admin','member','viewer'))
  created_at      timestamptz not null default now()
  primary key (organization_id, user_id)

organization_invitations          -- deferrable to Phase 1 if scope must shrink
  id, organization_id, email, role, token_hash, expires_at, accepted_at

+ organization_id  uuid references organizations(id)   -- added to projects
```

**Deliberately excluded from the minimum:** granular per-resource permissions, custom roles, nested teams, per-organisation billing, SSO, audit logs. Each is real and each belongs later. Four fixed roles cover every access decision the product makes today.

### 9.3 Scope model

> **The organisation owns projects. Everything else inherits scope through its project.**

Only `projects` gains `organization_id`. `conversations` reach the organisation through `project_id`; `messages` through `conversation_id`. This is the decision that keeps the change small: one new column on one table, rather than a denormalised `org_id` on every table.

The trade-off is honest: RLS policies on `messages` must join two levels up. At 67 rows this is irrelevant; at scale it is a known, solvable indexing problem, and denormalising later is a mechanical change. Correctness first, denormalise on evidence.

Forge's tables (`forge_projects` and descendants) follow the identical pattern when Forge becomes org-aware — **not in Phase 1**. Legacy tables are explicitly out of scope (§10).

### 9.4 Role semantics

| Role | Can |
| --- | --- |
| `owner` | Everything, including deleting the organisation and managing billing. Exactly one per organisation, non-removable. |
| `admin` | Manage members and all projects. Cannot delete the organisation. |
| `member` | Create projects; read and write projects in the organisation. |
| `viewer` | Read only. |

Enforcement lives in **RLS policies**, not application code. This is the point at which the Phase 0 finding — that RLS is defined everywhere and enforced nowhere, because every server path uses the service-role key — must finally be corrected. The Core branch already demonstrates the correct mechanism (§12.2): call PostgREST with the **user's own JWT** and let the database decide.

### 9.5 RLS implications

Current Core policies are `user_id = auth.uid()`. They become membership predicates:

```sql
-- projects
using (
  organization_id in (
    select organization_id from organization_members
    where user_id = (select auth.uid())
  )
)
```

Note `(select auth.uid())` rather than bare `auth.uid()` — this is the `auth_rls_initplan` optimisation that Supabase's performance advisor flags **21 times** in production today (§2.2), and that the Core branch already applies to its 12 policies. Writing new policies the optimised way costs nothing and avoids adding to that count.

Write policies additionally check role: `member` and above for insert/update, `admin` and above for delete.

**Critical implementation note:** a naive membership policy on `organization_members` itself recurses infinitely (to read your membership you must read your membership). The standard resolution is a `SECURITY DEFINER` helper function with a pinned `search_path` that bypasses RLS for that specific lookup. This must be designed carefully — and given advisor findings #2 and #3 concern exactly the risks of `SECURITY DEFINER` functions with loose grants, it should be written with `search_path = ''` and EXECUTE granted only to `authenticated`.

### 9.6 Migration strategy from current user-owned data

Every existing user becomes the owner of a personal organisation. Nothing is shared until someone is invited. No user-visible behaviour changes on day one.

| Step | Action |
| --- | --- |
| 1 | Create the tables with RLS enabled. |
| 2 | For each distinct `user_id` in `projects`, create one organisation (name derived from the user's email local part) and one `organization_members` row with role `owner`. **At 3 projects, this is 1–3 organisations.** |
| 3 | Backfill `projects.organization_id` from that mapping. Assert zero nulls. |
| 4 | Set `organization_id NOT NULL`. |
| 5 | Replace `user_id`-based policies with membership policies, in the same transaction. |
| 6 | Keep `projects.user_id` as the creator record. Do not drop it — it is useful provenance and dropping it is irreversible. |
| 7 | Add a trigger creating a personal organisation for each new signup, mirroring the existing `handle_new_user()` pattern. |

Steps 1–5 are one transactional migration. At this data volume it completes in milliseconds.

### 9.7 Recommendation on timing

Three options, with the honest trade-off for each:

| Option | Description | Assessment |
| --- | --- | --- |
| **A** | Add `org_id` to the Core branch migration **before it is ever applied**. | **Cheapest in total cost**, and it is precisely what "do not retrofit later" means. But it enlarges a migration that has already been carefully validated, and it must not be rushed. |
| **B** *(recommended)* | Apply Core V1 **as designed** (user-scoped), then apply the multi-tenant migration as the **first** Phase 1 change, before any new Core table is added. | Preserves the validated Core migration intact, keeps each change reviewable in isolation, and still retrofits at 67 rows. Honours the owner's intent — organisation scope arrives before the data model is built out, not after. |
| **C** | Defer multi-tenancy past Phase 1. | **Not recommended.** This is the retrofit the owner explicitly ruled out, and the cost grows with every table and row added. |

**Option B** is recommended: it separates two changes that both deserve independent review, and the marginal cost over Option A is negligible at this data volume. Under no circumstances Option C.

---

## 10. LEGACY SURFACE INVENTORY

Per Decision 6, the legacy marketing SaaS is **PRESERVED**. Nothing here is deleted, rewritten or disabled in Phase 0.5. Classifications describe eventual intent only.

### 10.1 Classification summary

| Classification | Count |
| --- | --- |
| KEEP | 2 |
| **MIGRATE** | **13** |
| REPLACE | 2 |
| SUNSET CANDIDATE | 1 |
| **Total surfaces** | **18** |

### 10.2 Inventory

| # | Surface | Persistence | API auth | Multi-tenant blocker | Class |
| --- | --- | --- | --- | --- | --- |
| 1 | `/` landing | none | n/a | Copy still describes legacy SaaS | **KEEP** |
| 2 | `/dashboard` | **localStorage only** — 4 keys | none | Every metric is per-browser; no server truth | **MIGRATE** |
| 3 | `/generate` | `generations` + `generated_visuals` + 4 localStorage keys | partial | `user_id` only; client context from localStorage | **REPLACE** → MUSE |
| 4 | `/generators` | in-memory config | none | Global catalog; fine as-is | **KEEP** |
| 5 | `/creations` | `generated_visuals` + localStorage | yes* | `user_id` only | **MIGRATE** |
| 6 | `/history` | `generations` + localStorage | partial | Dual store; local rows leak across users on a shared browser | **MIGRATE** |
| 7 | `/templates` | in-memory + localStorage | none | Custom templates cannot be org-shared | **MIGRATE** |
| 8 | `/brand` | `client_brands` + localStorage | partial | **`user_id` UNIQUE** — one brand per user, not per client | **MIGRATE** |
| 9 | `/clients` | **localStorage only** | none | **`public.clients` table exists with RLS but no API or UI touches it** | **MIGRATE** |
| 10 | `/crm` | `crm_prospects` / `crm_tasks` / `crm_timeline` + localStorage | **yes** | `user_id` only; not linked to `clients` | **MIGRATE** |
| 11 | `/presentation` | none (reads localStorage) | none | Depends on localStorage clients | **MIGRATE** |
| 12 | `/documents` | none | none | Pure link hub; duplicates sidebar; "Favoris" and "Historique IA" both point at `/history` | **SUNSET CANDIDATE** |
| 13 | `/agents`, `/agents/[id]` | `agents` + `generations` + localStorage | **partial — official path unauthenticated** | `user_id` only | **MIGRATE** |
| 14 | `/workflows` | `workflows` | **yes** | `user_id`; `client_id` is a free-text UUID, not an FK | **MIGRATE** |
| 15 | `/agent-builder` | React state → `agents` | **NO** | 20 unauthenticated model calls | **REPLACE** |
| 16 | `/pricing`, `/settings`, Stripe | `profiles`, `subscriptions`, `usage_limits` | **yes** | Billing is per-user; target is per-organisation | **MIGRATE** |
| 17 | `/login`, `/auth/reset-password` | Supabase Auth + localStorage session | n/a | No org creation, invite or selection flow | **MIGRATE** |
| 18 | Shared chrome (`Shell`, `MobileNavigation`, widgets) | `noline-favorites` | n/a | Nav has no org context; favorites local-only | **MIGRATE** |

\* auth enforced only when Supabase is configured — see the fail-open pattern in §5.2.

### 10.3 The structural obstacle: ten localStorage keys

The single largest barrier to multi-tenancy is not schema. It is that **ten product data keys live in the browser** and can never be shared between members of an organisation, or even between a user's own devices:

`noline-generation-history` · `noline-visual-history` · `noline-agency-clients` · `noline-active-client-id` · `noline-client-brand` · `noline-crm-prospects` · `noline-agent-library` · `noline-custom-sector-templates` · `noline-favorites` · `noline-supabase-session`

Six surfaces run **dual persistence** — localStorage *and* Supabase, merged at read time: `/history`, `/brand`, `/crm`, `/agents`, `/creations`, `/generate`. Each must converge on a single server-side source of truth before it can be org-scoped. This is the real migration work, and it is larger than adding `org_id` columns.

### 10.4 Tables used only by legacy surfaces

Candidates for eventual `org_id` retrofit, none in Phase 1:
`generations`, `generated_visuals`, `client_brands`, `agents`, `workflows`, `crm_prospects`, `crm_tasks`, `crm_timeline`, `clients`, `favorites`, `official_agents`.

Apparently dead — defined in `supabase/schema.sql`, referenced by no TypeScript: `generated_texts`, `monthly_quotas`. Presence in production is **[UNKNOWN]**.

### 10.5 Duplication found

Thirteen duplicate systems were identified. The notable ones: two client systems (localStorage vs an unused `public.clients` table with RLS already defined), two history stores, two brand stores, two agent libraries, two favorites stores, two quota tables, two official-agent sources (`lib/official-agents.ts` vs a seeded `official_agents` table the UI never reads), a dead `/api/agent-builder` route that merely re-exports `/api/generate`, and two unreferenced components (`ClientsView.tsx`, `AgentBuilderV1.tsx`).

None is removed in Phase 0.5. Recorded so consolidation is a decision rather than a discovery.

---

## 11. SECURITY BRANCH REUSE ANALYSIS

`chore/security-production-readiness` — 11 files, +1707/−245. Merge state vs `main`: **CLEAN / MERGEABLE** **[VERIFIED]**. Open as draft PR #2.

### 11.1 File-level classification

| File | Δ | Classification | Reasoning |
| --- | --- | --- | --- |
| `package.json` | +9/−6 | **REUSE WITH MODIFICATION** | Dependency versions are correct and should be taken verbatim. The `test` script must come from the **Core** branch instead (superset — see §13.3). This is the only conflict between the two branches. |
| `package-lock.json` | +796/−239 | **REUSE WITH MODIFICATION** | Regenerate after resolving `package.json` rather than merging textually. Auto-merges cleanly but a regenerated lockfile is the only trustworthy one. |
| `.gitignore` | +1 | **REUSE AS-IS** | Trivial. |
| `docs/security/npm-remediation.md` | +57 | **REUSE AS-IS** | Per-advisory exposure analysis; the best security documentation in the repository. |
| `docs/security/supabase-readiness.md` | +127 | **REUSE AS-IS** | The sole source of production database truth (§2). Load-bearing. |
| `docs/security/validation.md` | +64 | **REUSE AS-IS** | Dated evidence of test/lint/build/audit results. |
| `docs/security/runtime-compatibility.md` | +63 | **REUSE AS-IS** | Node/runtime constraints; feeds §7. |
| `docs/security/core-production-runbook.md` | +305 | **REUSE WITH MODIFICATION** | Careful runbook with preflight, write freeze, postflight and rollback. Must be updated for the migration-chain fixes in §8 and for whichever multi-tenant timing option (§9.7) is chosen. |
| `scripts/security/core-readiness-snapshot.sql` | +97 | **REUSE AS-IS** | Verified genuinely read-only. Reusable as the standard pre/post-migration snapshot. High value. |
| `supabase/proposals/20260912084200_security_function_hardening.sql` | +67 | **REUSE WITH MODIFICATION** | Fixes advisors #1–#3. Transactional, no DML, fingerprint-guarded against drift, self-rollbacking. **But** it alters `set_updated_at()`, on which **seven triggers across Core and Forge** depend — so it requires Forge staging validation, which requires a working staging environment, which requires §8. Correctly parked outside `migrations/`. |
| `supabase/proposals/verify-security-functions.mjs` | +121 | **REUSE AS-IS** | Eight PGlite checks including idempotency, rollback and drift detection. Establishes the testing pattern the project should adopt for all future migrations. |

### 11.2 Verdict

**REUSE — near-entirely, with a known package.json resolution.**

Nothing in this branch is SUPERSEDED or DO NOT USE. It is disciplined work: no `npm audit fix --force`, no application dependency touched, security proposals deliberately kept out of the active migration path, and the author's own honest **NO-GO** verdict recorded rather than glossed.

Two caveats:
- The zero-vulnerability result is dated **2026-09-12** and must be re-verified at merge.
- The SQL hardening proposal is **not** part of Phase 0.5B. It touches production functions and is blocked behind both the backup gate and a working staging environment.

---

## 12. CORE-DATA BRANCH REUSE ANALYSIS

`feat/noline-core-data-v1` — 17 files, +1347/−79. Merge state vs `main`: **CLEAN / MERGEABLE** **[VERIFIED]**. Open as draft PR #1.

### 12.1 File-level classification

| File | Δ | Classification | Reasoning |
| --- | --- | --- | --- |
| `supabase/migrations/20260911204606_noline_core_data_v1.sql` | +280 | **REUSE WITH MODIFICATION** | See §12.2. Excellent engineering; the only change needed is the multi-tenant decision (§9.7). |
| `lib/chat/core-supabase.ts` | +25 | **REUSE AS-IS** | The single most important file on either branch. See §12.3. |
| `app/api/nova/_shared.ts` | +25/−8 | **REUSE AS-IS** | Fail-closed authentication. Directly supplies the §5.3 Step 1 pattern. |
| `lib/chat/conversation-store.ts` | +78/−56 | **REUSE AS-IS** | Rewires the store onto the user-JWT client. |
| 5 × `app/api/nova/**/route.ts` | +12/−12 | **REUSE AS-IS** | Mechanical propagation of the identity type. |
| `tests/core-data-migration.test.cjs` | +118 | **REUSE AS-IS** | PGlite migration tests — idempotency, rejection of incompatible layouts. |
| `tests/core-nova.test.cjs` | +165 | **REUSE AS-IS** | **15 RLS tests with two real users.** The only genuine multi-user isolation testing in the project. |
| `eslint.config.mjs` | +11 | **REUSE AS-IS** | Scoped CommonJS override for the new `.cjs` tests. Narrow and correct. |
| `package.json` | +8/−2 | **REUSE WITH MODIFICATION** | Take its **scripts** and its new deps (`server-only`, `@electric-sql/pglite`, `tsx`); take **versions** from the security branch. |
| `package-lock.json` | +521/−1 | **REUSE WITH MODIFICATION** | Regenerate. |
| `supabase/core-data-preflight.sql` | +30 | **REUSE AS-IS** | Read-only preflight. |
| `supabase/PROPOSED_001_PROJECT_CONVERSATIONS.sql` | +2 | **REUSE AS-IS** | Adds a superseded-by pointer. Good hygiene — keeps the historical record while removing ambiguity. |
| `docs/CORE_DATA_V1.md` | +72 | **REUSE AS-IS** | Design rationale. |

### 12.2 Why the migration is good work

Verified by reading it:

- **Transactional** — `begin` / `commit`, so partial application is impossible.
- **Validates before mutating.** A `do $$` block checks column types, nullability, primary keys and unexpected RLS policies, and raises rather than proceeding. Its comment states the principle exactly: *"IF NOT EXISTS is not validation."*
- **Handles both empty and populated schemas** — it works against a fresh database *and* against production's existing 3/9/55 rows. This is precisely the defensive posture §2.4 concluded is mandatory.
- **Does not touch Forge.** It creates a namespaced `core_set_updated_at()` rather than modifying the shared `set_updated_at()` that seven triggers depend on. The comment is explicit: *"Namespaced trigger: do not replace the function used by Forge."* This is exactly right, and it is the kind of restraint that distinguishes safe migrations from dangerous ones.
- **`not valid` then `validate constraint`** throughout — minimises lock duration on every added constraint.
- **Refuses conflicting foreign keys** rather than silently altering delete behaviour.
- **No backfill, no deletion, no ownership inference** — stated in the header and honoured.

This migration partially satisfies remediation step **M4** in §8.6.

### 12.3 Why `core-supabase.ts` matters more than its 25 lines suggest

Phase 0's most structural finding was that **RLS is defined on every table and enforced on none**, because every server path uses `supabaseAdmin()` with the service-role key, which bypasses RLS entirely. Security rested wholly on each handler remembering to filter by `user_id`.

`coreSupabase()` breaks that pattern for the first time anywhere in this codebase. It calls PostgREST with the **anon key plus the user's own JWT**, so Postgres evaluates the RLS policies. Three details show care:

1. `import "server-only"` — a build-time guarantee the module can never reach the client bundle.
2. The type comment states the invariant: *"Never service role."*
3. Upstream error bodies are **never propagated** — only a status code — because PostgREST errors can contain private row values.

This is the correct template for every future data path, and the direction §9.4 depends on for org-scoped RLS.

### 12.4 The one change needed

`projects` is created with `user_id` and no `organization_id`. Per §9.7 this is either amended before application (Option A) or followed immediately by a multi-tenant migration (Option B, recommended). Either way the decision must be taken **before** this migration is applied, because after application the retrofit is a second migration against live data.

### 12.5 Verdict

**REUSE — with the multi-tenant decision taken first, and the backup gate cleared.**

Nothing is SUPERSEDED or DO NOT USE. The branch is stronger than Phase 0 could assess from commit messages alone. Its constraint is not quality but **sequencing**: it is a database migration, and database migration is NO-GO until §3 clears.

---

## 13. EXACT PHASE 0.5B CHANGESET

**Not authorised by this document.** This is the precise proposal for owner approval.

### 13.1 Governing principle

> **Phase 0.5B touches no database, no data and no production configuration.**

Every item below is a repository change, verifiable by CI and a Vercel Preview before it reaches production. This is what makes urgent security remediation possible while the database stays correctly frozen behind the backup gate.

### 13.2 Proposed changes

#### Group A — CI and reproducibility *(no runtime impact)*

| # | Change | Files |
| --- | --- | --- |
| A1 | Add `"engines": { "node": ">=22.15.0" }` | `package.json` |
| A2 | Add `.nvmrc` pinned to Node 22 LTS | `.nvmrc` *(new)* |
| A3 | Add `test`, `test:core`, `typecheck` scripts; add `tsx@4.20.6` | `package.json` |
| A4 | Add CI workflow — install, lint, typecheck, test, build, `npm audit --audit-level=high`; plus weekly schedule | `.github/workflows/ci.yml` *(new)* |
| A5 | Scoped ESLint override for `tests/*.test.cjs` | `eslint.config.mjs` |

#### Group B — Dependency remediation *(from PR #2)*

| # | Change | Files |
| --- | --- | --- |
| B1 | Apply the §4.3 version table; regenerate the lockfile | `package.json`, `package-lock.json` |
| B2 | Re-run `npm audit`; confirm 0 at merge time | — |
| B3 | Import the four security docs and the read-only snapshot script | `docs/security/**`, `scripts/security/**` |

#### Group C — Authentication *(the urgent group)*

| # | Change | Files |
| --- | --- | --- |
| C1 | Add a fail-closed `requireUser()` — 503 unconfigured, 401 unauthenticated. Additive; existing helper untouched | `lib/supabase-server.ts` or a new `lib/auth/require-user.ts` |
| C2 | Require auth on `/api/generate-agent`, preserving the no-API-key demo fallback | `app/api/generate-agent/route.ts` |
| C3 | Require auth **and a quota check** on `/api/agent-builder-v2` | `app/api/agent-builder-v2/route.ts` |
| C4 | Remove the `if (!officialAgent)` auth exemption | `app/api/agents/[id]/run/route.ts` |
| C5 | Send `Authorization: Bearer` from the affected clients | `components/AgentDetailView.tsx`, `src/modules/agent-builder/**` |
| C6 | Tests for 401, 503 and quota-exceeded on all three | `tests/*.test.ts` |

#### Group D — Migration chain, repository-only

| # | Change | Files |
| --- | --- | --- |
| D1 | Add `00000000000000_bootstrap_shared_functions.sql` defining `set_updated_at()` with `search_path = ''`, idempotent | `supabase/migrations/` *(new)* |
| D2 | Add `docs/MIGRATION_ORDER.md` declaring the canonical replay order (§8.6 M2a) | `docs/` *(new)* |
| D3 | Add a CI test replaying the full chain into empty PGlite | `tests/` *(new)* |

Together D1–D3 make a staging environment creatable for the first time — **without touching production**.

### 13.3 The package.json resolution

The single point where the two branches conflict. The resolution, confirmed by both the prior author and this analysis:

```
scripts       ← CORE      (test + test:core + typecheck — strict superset)
dependencies  ← SECURITY versions + CORE's server-only
devDependencies ← SECURITY versions + CORE's @electric-sql/pglite + tsx@4.20.6
overrides     ← SECURITY ($postcss)
lockfile      ← REGENERATE, never merge textually
```

Never replace Core's `package.json` wholesale with the security branch's.

### 13.4 Explicitly excluded from 0.5B

| Excluded | Reason |
| --- | --- |
| Any database migration | Backup gate (§3) |
| `supabase/proposals/*security_function_hardening.sql` | Touches a function seven Forge triggers depend on; needs staging |
| Migration ledger creation (M3) | Highest-risk step in the plan; needs a backup |
| `rate_limit_counters` table | Needs a migration (§6.7) |
| Multi-tenant tables | Phase 1, after the §9.7 decision |
| httpOnly cookie sessions | Cross-cutting; Phase 1 |
| Unifying the three auth helpers | Refactor; out of scope |
| Any legacy surface change | Decision 6 — preserve |
| Durable execution | ADR is PROPOSED; unapproved |
| Merging PR #1 or PR #2 as-is | Superseded by this composed changeset |

### 13.5 Execution and acceptance

Proposed as a **single branch off `main`**, one commit per group (A, B, C, D), merged as one reviewed pull request — because `main` auto-deploys to Production and the deployment should be deliberate and atomic.

Acceptance, all required:

1. All six CI gates pass.
2. `npm audit` reports **0** high or critical.
3. `npm test` passes **197/197** on Node ≥ 22.15.0.
4. Unauthenticated calls to the three endpoints return **401** with **zero** OpenAI calls.
5. With Supabase env vars absent, those endpoints return **503**, never 200.
6. Vercel Preview builds and serves; Nova and Forge manually exercised against it.
7. Migration chain replays into an empty database in CI.
8. `git diff --stat` confirms **no change** under `supabase/migrations/` other than D1, and no change to any application data path.

---

## 14. GO / NO-GO CONDITIONS

### 14.1 Application stabilisation (Phase 0.5B) — **GO, conditional**

Recommended to proceed, because it closes a live, presently-exploitable abuse channel on a public repository, and because it touches no data.

| Condition | Status |
| --- | --- |
| Changeset touches no database or production data | **MET** by design (§13.1) |
| Dependency remediation validated | **MET** — tests, build and Preview green **[VERIFIED-PRIOR]** |
| Rollback available | **MET** — revert the commit; Vercel redeploys the prior build |
| CI gates defined | **MET** (§7.4) |
| Owner approval | **PENDING** |
| `npm audit` re-verified at merge | **PENDING** — dated result |
| Preview manually exercised | **PENDING** |

### 14.2 Database migration — **NO-GO**

Unchanged from the prior author's verdict, and now with fuller reasoning.

| Blocker | Status | Clears when |
| --- | --- | --- |
| **No verified restorable backup** | **BLOCKING** — Free plan, no managed backups, no PITR, no restoration ever exercised | §3.3 B1–B5, with **B3 (proven restore) mandatory** |
| **Migration chain cannot replay** | **BLOCKING** | §8.6 M1, M2, M5 — all repository-only, deliverable in 0.5B |
| **No staging environment can exist** | **BLOCKING** — consequence of the above | Once the chain replays |
| **No migration ledger in production** | **BLOCKING** for any tool-driven migration | §8.6 M3 — itself requires the backup |
| Multi-tenant decision not taken | **BLOCKING** for Core V1 specifically | Owner decides §9.7 |
| Hosted Auth/Forge staging validation | **BLOCKING** | Requires staging |

Six blockers. The backup is the hard one; the rest are tractable and three of them are fixed by Phase 0.5B.

### 14.3 Phase 1 Core — **NO-GO**

| Prerequisite | Status |
| --- | --- |
| Phase 0.5B complete and deployed | Not started |
| Backup proven restorable | Not met |
| Migration chain replayable | Not met |
| Staging environment exists and is validated | Not met |
| Multi-tenant foundation decided (§9.7) | Owner decision pending |
| Durable execution ADR accepted | **PROPOSED**, Q1–Q3 unresolved |
| Rate limiting in place | Not met — blocked on migration |
| Three unauthenticated endpoints closed | Not met — Phase 0.5B |

### 14.4 The one thing that should not wait

Everything above is a sequenced plan. One item stands outside it.

The three unauthenticated paid-AI endpoints are **live in production on a public repository**, and `/api/agent-builder-v2` spends 20 model calls per anonymous request with no quota and no rate limit. If the owner wishes to act before approving the full 0.5B changeset, **Group C alone** (§13.2) is a small, self-contained, database-free change that closes the exposure. It can ship independently of Groups A, B and D.

---

## 15. REMAINING OWNER DECISIONS

Ordered by urgency. Blocking items prevent the next phase.

| # | Decision | Why it is needed | Blocks |
| --- | --- | --- | --- |
| **D1** | **Approve Phase 0.5B** (§13), or approve **Group C alone** as an emergency fix. | Three unauthenticated paid endpoints are live on a public repository. | 0.5B |
| **D2** | **Authorise the backup programme** (§3.3 B1–B5), including whether to upgrade Supabase from Free to Pro. | Nothing touching the database can proceed without a proven restore. | All DB work, Phase 1 |
| **D3** | **Multi-tenant timing** — §9.7 Option A (amend Core V1 before applying) or **Option B (recommended)** (apply Core V1, then multi-tenant as the first Phase 1 change). | Determines whether PR #1's migration is edited or applied as-is. At 67 rows this is the cheapest it will ever be. | Core V1, Phase 1 |
| **D4** | **Confirm the Vercel plan** (Hobby / Pro / Enterprise). | Sets the function ceiling (300 s vs 800 s vs 1800 s beta) and gates ADR stage S0. Hobby also prohibits commercial use, and Stripe billing is live. | ADR, Forge headroom |
| **D5** | **Durable execution** — accept ADR Option B (Inngest) or select Option A (Vercel Workflows). Resolve ADR Q1–Q3. | Shapes the Phase 1 `tasks` table and the Agent Runtime interface. | Phases 3, 5, 7, 8 |
| **D6** | **Migration ordering method** — §8.6 M2(a) declared order, or M2(b) renumbering. Renumbering is only safe while no ledger exists, which is now. | Determines whether history is rewritten. | Ledger creation |
| **D7** | **Repository visibility** — should `noline-ai-studio` remain **public**? | A public repository makes every unauthenticated endpoint trivially discoverable. Going private is a one-click mitigation, though not a substitute for authentication. | Nothing, but it changes the risk profile today |
| **D8** | **Branch protection on `main`** — require CI and pull requests? | `main` auto-deploys to Production; today an unverified direct push ships to users. Current state is **[UNKNOWN]**. | Nothing, but it prevents a class of accident |
| **D9** | **Rate limiting mechanism** — Postgres counters (§6.3) or a Redis/Upstash service. | Postgres needs no new vendor; Redis is faster but adds a dependency and may be redundant once the durable-execution engine is chosen. | 0.5C |
| **D10** | **Global OpenAI spend ceiling** (§6.6) — what daily figure should trip the circuit breaker? | Per-user limits bound one abuser; only a global ceiling bounds the invoice. There is currently no cost observability at all. | 0.5C |
| **D11** | **Legacy `/documents`** — confirm SUNSET CANDIDATE. | The only surface with no distinct persistence or capability. Not removed in 0.5. | Nothing now |
| **D12** | Whether to grant read-only Supabase and Vercel access to future phases. | §2 rests on 2026-09-12 second-hand evidence; §1.5 has five UNKNOWNs resolvable only with dashboard or API access. | Verification quality |

---

## Appendix A — Verification performed in Phase 0.5A

| Check | Method | Result |
| --- | --- | --- |
| Production deployment | `gh api repos/.../deployments`, `.../status` | **[VERIFIED]** `main` @ `1cffe0c` live since 2026-09-05 |
| Repository visibility | `gh api repos/...` | **[VERIFIED]** PUBLIC |
| CI existence | `gh api .../check-runs` | **[VERIFIED]** 0 check runs |
| Branch protection | `gh api .../branches/main/protection` | **[UNKNOWN]** — HTTP 403, token lacks scope |
| Open PRs | `gh pr list` | **[VERIFIED]** #1 and #2, both open drafts, both MERGEABLE/CLEAN vs `main` |
| Inter-branch conflict | `git merge-tree --write-tree` | **[VERIFIED]** conflict in `package.json` only |
| Branch diffs | `git diff --numstat`, full diffs | **[VERIFIED]** 11 and 17 files |
| Migration ordering defect | `ls`, `grep` on FK references | **[VERIFIED]** replay fails |
| `set_updated_at()` undefined | `grep -rn` across `supabase/` | **[VERIFIED]** defined only in the PROPOSED file |
| Unauthenticated endpoints | Direct file reads | **[VERIFIED]** all three; 20 model calls in agent-builder-v2 |
| Fail-open auth pattern | `grep -rln isSupabaseServerConfigured app/api` | **[VERIFIED]** 18 routes |
| Snapshot script is read-only | Read `core-readiness-snapshot.sql` | **[VERIFIED]** `begin ... read only`, SELECT-only |
| Production database state | Prior author's audit, 2026-09-12 | **[VERIFIED-PRIOR]** |
| Backup status | Prior author's audit, 2026-09-12 | **[VERIFIED-PRIOR]** none |
| Legacy inventory | Full source traversal | **[VERIFIED]** 18 surfaces |
| Production HTTP liveness | `curl` to the public homepage | **BLOCKED** — sandbox egress (`SSL_ERROR_SYSCALL`). No API endpoint was probed. |

## Appendix B — Change-control attestation

No deployment · no production mutation · no migration applied · no branch merged or cherry-picked · no push to `main` · no Core or pillar implementation · no refactor · no dependency changed · no secret printed, requested or stored · no legacy surface modified.

Files created: `docs/NOLINE_STUDIO_AI_PHASE_0_5_STABILISATION.md`, `docs/ADR_DURABLE_EXECUTION.md`. No other file in the repository was modified.

One disclosed side effect: pushing this documentation branch triggers a Vercel **Preview** deployment (§1.4). No promotion to Production occurred or was requested.

---

**PHASE 0.5A COMPLETE. No implementation is authorised by this document.**
