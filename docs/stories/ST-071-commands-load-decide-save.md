---
id: ST-071
title: Commands as load, decide, save – with an event catalogue and a typed acting person
type: tech-task
context: BC-Repair
priority: must
size: L
risk: medium
events: []
depends_on: [ST-003]
labels: [foundation, architecture]
status: draft
---

## Task
Implements the command-pattern decisions of the architecture review 2026-09-27 (decisions Q1–Q22, grilling session with `/improve-codebase-architecture`): **Q2, Q3, Q4, Q5, Q6, Q11, Q12, Q13, Q14, Q15, Q20, Q22**. Cross-cutting; filed under `BC-Repair` like the other foundation tasks (ST-001, ST-059, ST-003).

**Ordering.** This task comes right after ST-003 and before ST-004. ST-004, ST-007 and ST-018 – the first stories with real commands on team members, machines and triage – follow it and are built on the shape described here (their files are not changed by this task).

Today every command (`src/platform/command/index.ts`, `src/modules/repair/report-problem-command.ts`) is a free-form `run` function that validates, writes rows, calls `updateAtVersion` and assembles journal rows by hand (`JournalEvent` with an untyped `data`). The review decided one shape for all commands instead:

- **Q2 – load → decide → save.** Each aggregate module runs its commands as: load the current state of the aggregate (with its version) → a pure decision `decide(state, input, { clock, newId })` that returns the new state plus domain events, or a domain rejection → save (with the version check) → the command layer journals the events. State-based persistence, no event sourcing (`docs/adr/0002-modular-monolith-state-based-persistence.md`).
- **Q14 – creating commands** use the same shape with "no state yet": no load, no version check; the new aggregate is saved at version 0.
- **Q11 – rejections before conflicts.** The decision runs on the freshly loaded state, so a domain rejection (e.g. "already triaged by Eva", ST-018) is returned first; saving then checks the version the user saw. `version-conflict` is returned only when nothing domain-specific explains the difference.
- **Q12 – one aggregate per command.** A command belongs to one aggregate. Its decision may also create new aggregates of the same module (e.g. recording a defect during triage), saved in the same transaction. Anything else goes through `context.run` or a policy.
- **Q13 – histories are append-only lists.** Histories (work log entries, machine status changes, defect resolutions, …) are lists in the state. Saving inserts the entries that were not present at load (recognised by their generated ID) and never changes existing entries.
- **Q6 – `context.run(command, input)`** runs another command – also another module's, imported through its `index.ts` – in the same transaction, as the same acting person, including that command's authorization check. A rejection of the inner command rejects everything; the inner command's error type becomes part of the outer command's result type. `context.runAsSystem` stays for automatic policies.
- **Q4 – event catalogue per module** (e.g. `src/modules/repair/events.ts`): for each event type its aggregate, how its machine is found, and an explicit journal projection – only the listed fields reach the journal, and none of them is free text a person typed (rule of 2026-09-27, `OPEN_QUESTIONS.md`, ST-003). Commands return domain events; the command layer maps them to journal entries through the catalogue. `journalOf` returns entries typed per event type.
- **Q15 – traceability.** `verify.ts` (domain ID check, `.claude/skills/implement/scripts/check-commands.ts`) also checks that every catalogue event exists in `docs/domain/events.yaml` and belongs to the aggregate the catalogue declares for it.
- **Q5/Q20 – typed acting person.** The type of the acting person a decision receives follows from the command's `allowedActors`: a command for team members only gets a team member with ID and role, without narrowing. No new glossary term: `Actor` stays the technical type (visitor | team member | system); the problem report keeps its domain type `Reporter` (`docs/architecture/data-model.md`), derived from the acting person in one place; every "… by" is a `TeamMemberId`. The duplicate `Role` and `Reporter` definitions disappear.
- **Q3 – test seams.** Commands are tested at the command seam (`executeCommand` against PostgreSQL). Pure decisions get table tests only where a rule has many cases. Read-model tests set up their data through commands.
- **Q22 – conversion.** Converts CMD-ReportProblem, the test stand-in commands (`src/platform/command/execute-command.integration.test.ts`, `src/modules/repair/problem-report-version.integration.test.ts`) and the read-model test (`src/modules/repair/problem-reports.integration.test.ts`). `updateAtVersion` is replaced by the save step with the version check.

What `executeCommand` already guarantees (authorization first, one transaction, one point in time, at least one journaled event per successful command) stays unchanged.

## Acceptance Criteria
- [ ] CMD-ReportProblem runs as a creating command without load: a decision returns the new problem report and `EVT-ProblemReported` or `description-required`; the stored problem report has version 0 (integration test at `executeCommand`).
- [ ] A command on an existing aggregate loads it, decides and saves it with the version the user saw; the saved aggregate's version is one higher (integration test with a converted test stand-in on the problem report).
- [ ] When another person changed the aggregate first and the decision on the fresh state rejects the command, the result is the domain rejection, not `version-conflict`; when the decision accepts but the version differs from the one the user saw, the result is `version-conflict`; in both cases nothing is stored and nothing is journaled (integration tests with test stand-ins).
- [ ] The existing concurrency test ("exactly one of two concurrent commands on the same aggregate version succeeds") and the `not-found` test stay green after the conversion.
- [ ] A decision that also creates a new aggregate of the same module saves both in one transaction; if the command is rejected afterwards, neither exists (integration test with a test stand-in).
- [ ] Saving a state with a history list inserts only entries whose ID was not present at load and leaves existing entries unchanged (integration test: two commands each add an entry; both entries are stored, the first unchanged). [OPEN] Which aggregate the test uses before the first real history exists – see Open Questions.
- [ ] `context.run` runs an inner command in the same transaction as the same acting person: its events are journaled with that person; an inner command the person is not allowed to run makes the whole command `not-authorized`; an inner rejection rejects the whole command and stores nothing (integration tests with test stand-ins).
- [ ] The inner command's error type is part of the outer command's result type – shown by a type test (`expectTypeOf` or `@ts-expect-error`) that fails `npm run verify` if the inner error is missing.
- [ ] `context.runAsSystem` still runs policies journaled as the system; the existing policy tests stay green.
- [ ] `src/modules/repair/events.ts` lists `EVT-ProblemReported` with its aggregate `AGG-ProblemReport`, its machine and its journal projection; the journal entry of a reported problem contains no description (integration test via `journalOf`).
- [ ] A test over all catalogue entries of all modules fails when an event whose catalogue entry says it concerns a machine yields a journal entry without machine reference.
- [ ] `journalOf` returns entries typed per event type: reading a field of `EVT-ProblemReported` that its projection does not list is a type error (type test).
- [ ] `npm run verify` fails when a catalogue event is missing from `docs/domain/events.yaml`, or declares a different aggregate than `events.yaml`; both demonstrated with a deliberate change and then removed.
- [ ] A command allowed for `helper` and `technician` only gets a team member with `teamMemberId: TeamMemberId` and `role` in its decision without narrowing (type test); a command that also allows visitors gets the union.
- [ ] `Role` and `Reporter` are each defined exactly once under `src/` (evidence: search result in the pull request); `Reporter` is derived from the acting person in exactly one function.
- [ ] Every behaviour asserted by an existing test is still asserted after the conversion – moved to the command seam where Q3 says so; no assertion is dropped (evidence: list old test → new test in the pull request). Converts the existing code (no test weakened).
- [ ] `src/modules/repair/problem-reports.integration.test.ts` sets up its problem reports through `executeCommand(reportProblemCommand, …)`, not through persistence functions.
- [ ] `npm run verify` is green (lint, module boundaries, types, tests, traceability).
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "Writing a command" (load → decide → save, creating commands, one aggregate per command, histories, `context.run`), "The event journal" (event catalogue), "Version check" (rejection before conflict), the acting person's type, and the seam catalog rows for commands, decisions and read models.

## Out of Scope
- Login and the acting person from the session (ST-004, ST-069)
- The Server Action runner and `currentPerson()` (ST-073)
- The photo module and the storage seam (ST-072)
- Event sourcing, replaying the journal, projections (ADR 0002)
- Branded ID types beyond `TeamMemberId` for "… by" (`docs/reviews/ST-003-code-review.md` finding #11)
- Cross-module read models (decided with ST-008)

## Open Questions
- [OPEN] Q13 (append-only histories): no aggregate in the code has a history yet – the first is the machine status history (ST-012). Test the insert-only save now with a test stand-in (which needs a history table only the test database has), or keep the rule in the conventions now and prove it with the first real history? Recommendation: build the insert-only save as a shared helper now, document the rule and the helper's contract here, and prove it with the machine status history in ST-012.
