---
id: ST-071
title: Commands as load, decide, save
type: tech-task
context: BC-Repair
priority: must
size: M
risk: medium
events: []
depends_on: [ST-003]
labels: [foundation, architecture]
status: in-progress
---

## Task
Implements the core command shape decided in the architecture review 2026-09-27 (decisions Q1–Q22, grilling session with `/improve-codebase-architecture`): **Q2, Q11, Q12, Q14, Q22**. Cross-cutting; filed under `BC-Repair` like the other foundation tasks (ST-001, ST-059, ST-003).

**Split.** The story review of 2026-09-27 (`docs/reviews/2026-09-27-story-review-st-067-073.md`, decision 1) split the original task in two. This task keeps the core shape. The other half, ST-074, was dissolved in the backlog restructuring of 2026-09-27 (foundation work pulled in just in time); its parts follow in the stories that first need them: the typed acting person and the test-seam rules in ST-073 (Q3, Q5, Q20), the insert-only history helper in ST-012 (Q13), `context.run` in ST-018 (Q6), the event catalogue and its check against `events.yaml` in ST-050 (Q4, Q15).

**Ordering.** This task comes right after ST-003 and before ST-004. ST-004, ST-007 and ST-018 – the first stories with real commands on team members, machines and triage – follow it and are built on the shape described here (their files are not changed by this task).

Today every command (`src/platform/command/index.ts`, `src/modules/repair/report-problem-command.ts`) is a free-form `run` function that validates, writes rows, calls `updateAtVersion` and assembles journal rows by hand (`JournalEvent` with an untyped `data`). The review decided one shape for all commands instead:

- **Q2 – load → decide → save.** Each aggregate module runs its commands as: load the current state of the aggregate (with its version) → a pure decision `decide(state, input, { clock, newId })` that returns the new state plus domain events, or a domain rejection → save (with the version check) → the command layer journals the events. State-based persistence, no event sourcing (`docs/adr/0002-modular-monolith-state-based-persistence.md`). Until ST-050 adds the event catalogue, each command maps its domain events to journal entries itself, following the rule that the journal holds no free text a person typed (rule of 2026-09-27, `OPEN_QUESTIONS.md`, ST-003).
- **Q14 – creating commands** use the same shape with "no state yet": no load, no version check; the new aggregate is saved at version 0.
- **Q11 – rejections before conflicts.** The decision runs on the freshly loaded state, so a domain rejection (e.g. "already triaged by Eva", ST-018) is returned first; saving then checks the version the user saw. `version-conflict` is returned only when nothing domain-specific explains the difference.
- **Q12 – one aggregate per command.** A command belongs to one aggregate. Its decision may also create new aggregates of the same module (e.g. recording a defect during triage), saved in the same transaction. Anything else goes through `context.run` (ST-018) or a policy.
- **Q22 – conversion.** Converts CMD-ReportProblem, the test stand-in commands (`src/platform/command/execute-command.integration.test.ts`, `src/modules/repair/problem-report-version.integration.test.ts`) and their tests. `updateAtVersion` is replaced by the save step with the version check.

What `executeCommand` already guarantees (authorization first, one transaction, one point in time, at least one journaled event per successful command) stays unchanged.

## Acceptance Criteria
- [x] CMD-ReportProblem runs as a creating command without load: a decision returns the new problem report and `EVT-ProblemReported` or `description-required`; the stored problem report has version 0 (integration test at `executeCommand`). – `src/modules/repair/report-problem-command.integration.test.ts` (version 0 shown by a first change at version 0 being accepted and a second rejected); decision table `report-problem.test.ts`.
- [x] The journal entry of a reported problem still contains no description (integration test via `journalOf`). – same file, "journals the reported problem without its description".
- [x] A command on an existing aggregate loads it, decides and saves it with the version the user saw; the saved aggregate's version is one higher (integration test with a converted test stand-in on the problem report). – `src/modules/repair/problem-report-version.integration.test.ts`, "loads the problem report, decides and saves it one version higher" (stand-in in `problem-report-stand-ins.test-support.ts`).
- [x] When another person changed the aggregate first and the decision on the fresh state rejects the command, the result is the domain rejection, not `version-conflict`; when the decision accepts but the version differs from the one the user saw, the result is `version-conflict`; in both cases nothing is stored and nothing is journaled (integration tests with test stand-ins). – same file, "returns the domain rejection, not a version conflict, when the fresh state explains it".
- [x] The existing concurrency test ("exactly one of two concurrent commands on the same aggregate version succeeds") and the `not-found` test stay green after the conversion. – same file – both kept, converted to the new stand-in.
- [x] A decision that also creates a new aggregate of the same module saves both in one transaction; if the command is rejected afterwards, neither exists (integration test with a test stand-in). – same file, "saves a new aggregate the decision creates…" and "saves neither the changed nor the created aggregate when the command fails on its version" (created aggregates are inserted first, so the rollback is real).
- [x] `context.runAsSystem` still runs policies journaled as the system; the existing policy tests stay green. – `src/modules/repair/problem-report-policies.integration.test.ts` – policies now declared with `policies: … trigger(…)`; both tests moved there from the platform test (the platform test may not import Repair's stand-ins).
- [x] No `updateAtVersion` call is left under `src/`; the save step is the only place that checks the version. – `updateAtVersion` and `defineCommand` removed from `src/platform/command/index.ts`; `grep -rn updateAtVersion src` is empty; the version check lives only in `aggregateStore` (`src/platform/command/aggregate.ts`).
- [x] Every behaviour asserted by an existing test is still asserted after the conversion; no assertion is dropped (evidence: list old test → new test in the pull request). Converts the existing code (no test weakened). – old → new test table in the pull request; no assertion dropped.
- [x] `npm run verify` is green (lint, module boundaries, types, tests, traceability). – local and CI.
- [x] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "Writing a command" (load → decide → save, creating commands, one aggregate per command), "Version check" (rejection before conflict), and the seam catalog rows for commands and decisions. – sections "Writing a command", "Version check", "Automatic policies", module file table and seam catalog; the user approves in the pull request.

## Out of Scope
- The typed acting person and the test-seam rules for read models (ST-073), the history helper (ST-012), `context.run` (ST-018), the event catalogue and its check against `events.yaml` (ST-050) – all moved from the dissolved ST-074
- Login and the acting person from the session (ST-004, ST-069)
- The Server Action runner and `currentPerson()` (ST-073)
- The photo module and the storage seam (ST-016, moved from the dissolved ST-072)
- Event sourcing, replaying the journal, projections (ADR 0002)
- Branded ID types beyond `TeamMemberId` for "… by" (`docs/reviews/ST-003-code-review.md` finding #11)
- Cross-module read models (decided with ST-008)

## Open Questions
- none – the question on the history helper (Q13) was answered in the story review of 2026-09-27 and moved with the helper to ST-074, and on 2026-09-27 with the dissolution of ST-074 to ST-012.
