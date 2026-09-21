# NØLINE Core — Phase 1A

## Responsibility

NØLINE Core defines stable, provider-independent domain contracts shared by present and future product agents. It standardizes typed identity, ownership, projects, conversations, messages, artifacts, runs, durable-task states, file metadata, usage/cost attribution, capabilities, immutable audit events, and persistence ports.

The contracts are intentionally small TypeScript modules under lib/core. They contain no database client and no runtime singleton. Existing product persistence remains authoritative during Phase 1A.

## Dependency direction

Product agents and boundary adapters may import Core contracts:

    NOVA / FORGE / future agents
                 ↓
          product-side adapters
                 ↓
             NØLINE Core
                 ↓
         repository port contracts

Core never imports NOVA, FORGE, provider SDKs, route handlers, or persistence implementations. NOVA and FORGE compatibility mappings live in their existing product directories and are pure functions; they do not change runtime behavior or storage paths.

## Ownership and IDs

Entity identifiers are opaque string types to prevent accidental cross-entity assignment. Ownership is an explicit discriminated union: user-owned today, with an organization-owned shape available for future compatibility. Phase 1A creates no organization table and assigns no organization behavior.

## Durable execution boundary

Task and AgentRun can represent QUEUED, RUNNING, WAITING, NEEDS_APPROVAL, FAILED, COMPLETED, and CANCELLED. These are contracts only. There is no queue, worker, scheduler, retry engine, or autonomous orchestration in Phase 1A.

## Security and accountability

Permissions use explicit capabilities and deny unknown capabilities by default. They do not use a global isAdmin boolean. Audit events preserve actor, action, agent, run, tool, resource, timestamp, result, and exact cost attribution. Currency uses integer minor units rather than floating-point values.

## What Core does not do

Core does not call model providers, execute shell commands, deploy applications, contain UI, implement workflow scheduling, run workers or queues, perform autonomous orchestration, implement Supabase Storage, replace NOVA/FORGE persistence, implement Model Gateway, or become NEXUS.

Core has no knowledge of Vercel, Daytona, GitHub implementation details, billing plans, or pricing.

## Incremental adoption

Phase 1A proves that existing NOVA and FORGE records can be represented without changing their behavior. Later phases may add persistence adapters or runtime services behind these ports, one bounded integration at a time, after the Phase 0.5 production-safety gates are complete.
