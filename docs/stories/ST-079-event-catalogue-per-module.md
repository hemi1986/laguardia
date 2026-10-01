---
id: ST-079
title: The event catalogue per module
type: tech-task
context: BC-Repair
priority: must
size: null
risk: null
events: []
depends_on: [ST-018]
labels: [follow-up]
status: draft
---

## Task
Build the **event catalogue per module** (architecture review 2026-09-27, decisions **Q4** and **Q15**) and convert every command built so far to it. Until now each command maps its own domain events to journal entries (ST-071).

- **Q4 – event catalogue per module** (e.g. `src/modules/repair/events.ts`): for each event type its aggregate, how its machine is found, and an explicit journal projection – only the listed fields reach the journal, and none of them is free text a person typed (rule of 2026-09-27, `OPEN_QUESTIONS.md`, ST-003). Commands return domain events; the command layer maps them to journal entries through the catalogue, replacing the per-command mapping of ST-071. `journalOf` returns entries typed per event type.
- **Q15 – traceability.** `verify.ts` (domain ID check, `.claude/skills/implement/scripts/check-commands.ts`) also checks that every catalogue event exists in `docs/domain/events.yaml` and belongs to the aggregate the catalogue declares for it.

**Why it is its own task, and why here** (backlog grooming 2026-10-01, finding 2): this was the foundation checklist of ST-050, nine stories deep in the dependency chain. It is a **retrofit**, and a retrofit is the one case where "pull foundation in just in time" inverts – its cost grows with every command built before it. Today **two** commands have a journal mapping; at ST-050's position it would be roughly **twenty**. So it is placed right after ST-018, before the Repair module keeps growing. ST-050 keeps only "what is new since the last visit" and reads the journal through the catalogue this task builds.

Because the backlog order is derived from priority and story ID (a higher ID never overtakes a lower one within the same priority), this task has to be started by name: `/implement ST-079`, right after ST-018 and before any further command of the Repair module.

## Acceptance Criteria
- [ ] `src/modules/repair/events.ts` lists `EVT-ProblemReported` with its aggregate `AGG-ProblemReport`, its machine and its journal projection; CMD-ReportProblem's journal entry is produced through the catalogue and contains no description (integration test via `journalOf`).
- [ ] Every command built so far maps its events to journal entries through its module's catalogue; no per-command mapping is left under `src/`.
- [ ] A test over all catalogue entries of all modules fails when an event whose catalogue entry says it concerns a machine yields a journal entry without machine reference.
- [ ] `journalOf` returns entries typed per event type: reading a field of `EVT-ProblemReported` that its projection does not list is a type error (type test).
- [ ] `npm run verify` fails when a catalogue event is missing from `docs/domain/events.yaml`, or declares a different aggregate than `events.yaml`; both demonstrated with a deliberate change and then removed.
- [ ] Every behaviour asserted by an existing journal test is still asserted after the conversion; no assertion is dropped (evidence: list old test → new test in the pull request). No test weakened.
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "The event journal" – the event catalogue.

## Out of Scope
- Highlighting what is new since the last visit on the dashboards (ST-050)

## Open Questions
- none
