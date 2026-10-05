# APEX MVP Phase A

APEX is the technical architect and reviewer around FORGE. Phase A is an offline contract foundation; it does not activate orchestration or make provider calls by itself.

## Responsibilities

APEX:

- converts a product objective and repository context into a bounded technical plan;
- defines scope, constraints, validation and acceptance evidence for FORGE;
- reviews the resulting diff, artifacts and validation evidence;
- returns exactly `APPROVE` or `REJECT`;
- converts blocking findings into a machine-readable correction request.

FORGE remains responsible for discovery, implementation, commands, tests, correction, artifacts and controlled publication.

## Dependency direction

`NOVA/user → APEX contracts → FORGE handoff → APEX review → publication gate`

APEX may use the provider-neutral Model Gateway. It does not import OpenAI SDK types. Deterministic review gates remain authoritative even when model-generated advisory findings are used.

## What APEX does not do

APEX does not:

- edit files or execute shell commands;
- provision Daytona or another runtime;
- publish Git branches or pull requests;
- bypass FORGE Completion Gates;
- mutate Supabase or deployment environments;
- approve with unresolved blocking findings;
- orchestrate an unbounded correction loop.

## Future loop contract

The inactive future state machine is:

`APEX_PLAN → FORGE_RUN → APEX_REVIEW → FORGE_CORRECTION → APEX_REVIEW → PUBLICATION_GATE`

A future integration may execute at most two correction rounds before terminal escalation. Phase A only proves these contracts with an offline deterministic harness.
