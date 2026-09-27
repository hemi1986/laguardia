---
id: ST-074
title: Event catalogue, typed acting person and command composition
type: tech-task
context: BC-Repair
priority: must
size: M
risk: medium
events: []
depends_on: [ST-071]
labels: [foundation, architecture]
status: ready
---

## Task
Implements the second half of the command-pattern decisions of the architecture review 2026-09-27 (decisions Q1–Q22, grilling session with `/improve-codebase-architecture`): **Q3, Q4, Q5, Q6, Q13, Q15, Q20**. Split from ST-071 in the story review of 2026-09-27 (`docs/reviews/2026-09-27-story-review-st-067-073.md`, decision 1). Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

**Ordering.** After ST-071 (the load → decide → save shape this task extends) and before ST-073 (the Server Action runner hands on the typed acting person). ST-012 (machine status history) is the first story with a real history and uses the helper built here (its file is not changed by this task).

- **Q4 – event catalogue per module** (e.g. `src/modules/repair/events.ts`): for each event type its aggregate, how its machine is found, and an explicit journal projection – only the listed fields reach the journal, and none of them is free text a person typed (rule of 2026-09-27, `OPEN_QUESTIONS.md`, ST-003). Commands return domain events; the command layer maps them to journal entries through the catalogue, replacing the per-command mapping of ST-071. `journalOf` returns entries typed per event type.
- **Q15 – traceability.** `verify.ts` (domain ID check, `.claude/skills/implement/scripts/check-commands.ts`) also checks that every catalogue event exists in `docs/domain/events.yaml` and belongs to the aggregate the catalogue declares for it.
- **Q5/Q20 – typed acting person.** The type of the acting person a decision receives follows from the command's `allowedActors`: a command for team members only gets a team member with ID and role, without narrowing. No new glossary term: `Actor` stays the technical type (visitor | team member | system); the problem report keeps its domain type `Reporter` (`docs/architecture/data-model.md`), derived from the acting person in one place; every "… by" is a `TeamMemberId`. The duplicate `Role` and `Reporter` definitions disappear.
- **Q6 – `context.run(command, input)`** runs another command – also another module's, imported through its `index.ts` – in the same transaction, as the same acting person, including that command's authorization check. A rejection of the inner command rejects everything; the inner command's error type becomes part of the outer command's result type. `context.runAsSystem` stays for automatic policies.
- **Q13 – histories are append-only lists.** Histories (work log entries, machine status changes, defect resolutions, …) are lists in the state. A shared insert-only helper saves them: it inserts the entries that were not present at load (recognised by their generated ID) and never changes existing entries. Answer to the open question (user, 2026-09-27): the helper is built now and proved with a test stand-in; ST-012 proves it again with the machine status history.
- **Q3 – test seams.** Commands are tested at the command seam (`executeCommand` against PostgreSQL). Pure decisions get table tests only where a rule has many cases. Read-model tests set up their data through commands.

## Acceptance Criteria
- [ ] `src/modules/repair/events.ts` lists `EVT-ProblemReported` with its aggregate `AGG-ProblemReport`, its machine and its journal projection; CMD-ReportProblem's journal entry is produced through the catalogue and contains no description (integration test via `journalOf`).
- [ ] A test over all catalogue entries of all modules fails when an event whose catalogue entry says it concerns a machine yields a journal entry without machine reference.
- [ ] `journalOf` returns entries typed per event type: reading a field of `EVT-ProblemReported` that its projection does not list is a type error (type test).
- [ ] `npm run verify` fails when a catalogue event is missing from `docs/domain/events.yaml`, or declares a different aggregate than `events.yaml`; both demonstrated with a deliberate change and then removed.
- [ ] A command allowed for `helper` and `technician` only gets a team member with `teamMemberId: TeamMemberId` and `role` in its decision without narrowing (type test); a command that also allows visitors gets the union.
- [ ] `Role` and `Reporter` are each defined exactly once under `src/`, and `Reporter` is derived from the acting person in exactly one function: an automated check in `npm run verify` fails when a second type definition named `Role` or `Reporter` is added under `src/`; demonstrated with a deliberate duplicate and then removed.
- [ ] `context.run` runs an inner command in the same transaction as the same acting person: its events are journaled with that person; an inner command the person is not allowed to run makes the whole command `not-authorized`; an inner rejection rejects the whole command and stores nothing (integration tests with test stand-ins).
- [ ] The inner command's error type is part of the outer command's result type – shown by a type test (`expectTypeOf` or `@ts-expect-error`) that fails `npm run verify` if the inner error is missing.
- [ ] `context.runAsSystem` still runs policies journaled as the system; the existing policy tests stay green.
- [ ] The insert-only history helper, used by a test stand-in aggregate with a history list (its table exists only in the test database): two commands each add an entry; both entries are stored, the first unchanged, and an entry present at load is never updated (integration test).
- [ ] `src/modules/repair/problem-reports.integration.test.ts` sets up its problem reports through `executeCommand(reportProblemCommand, …)`, not through persistence functions.
- [ ] Every behaviour asserted by an existing test is still asserted – moved to the command seam where Q3 says so; no assertion is dropped (evidence: list old test → new test in the pull request). No test weakened.
- [ ] `npm run verify` is green (lint, module boundaries, types, tests, traceability).
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "Writing a command" (histories and the insert-only helper, `context.run`), "The event journal" (event catalogue), the acting person's type, and the seam catalog rows for commands, decisions and read models.

## Out of Scope
- The load → decide → save shape, creating commands, one aggregate per command, rejection before conflict (ST-071)
- The first real history, the machine status history (ST-012)
- Login and the acting person from the session (ST-004, ST-069)
- The Server Action runner and `currentPerson()` (ST-073)
- Event sourcing, replaying the journal, projections (ADR 0002)
- Branded ID types beyond `TeamMemberId` for "… by" (`docs/reviews/ST-003-code-review.md` finding #11)

## Open Questions
- none
