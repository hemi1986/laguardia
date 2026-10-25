# Code review – architecture review 2026-10-25, candidate 5: Maintenance answers the maintenance of a machine and reads Collection's machines itself
Base: main · Branch: arch-maintenance-of-machine · Commits: 1 · Date: 2026-10-25

Refactoring, no story. Reviewed against ADR 0002 (module boundaries, read models are queries), the context map
(`docs/domain/context-map.md`, Collection → Maintenance), ST-039, ST-043, ST-045, ST-047, ST-056, the engineering
conventions (`.claude/skills/engineering-conventions/SKILL.md`), `CONTEXT.md` and the tdd / codebase-design skills.
`check-language.ts`: no warning in a changed file.

## Questions from the hand-off, answered

**Module boundaries.** Clean. `due-maintenance.ts`, `maintenance-for-several.ts` and `machine-maintenance.ts` import
only `machinesForMaintenance` from `@/modules/collection`, the public index (ADR 0002). That is downstream reading
upstream along the Customer/Supplier + Published Language relationship of the context map. Maintenance already did
this in `maintenance-records.ts` (`maintenanceFacts` reads `machineForMaintenance`), so no new direction appears and no
cycle is possible: Collection imports nothing from Maintenance. `dueOn` is exported from `due-maintenance.ts` but not
from `index.ts`, so it stays module-internal as intended. `latestMaintenanceRecords` left the index and has no
caller outside the module now. That is a correct narrowing.

**Behaviour equivalence.** Equivalent for every machine still in the museum. The helper dashboard, the technician
dashboard and the due maintenance list made the same `machinesForMaintenance(db)` → `dueMaintenance` chain before,
now inside the module. `maintenanceForSeveral` now reads the plan and the machines in parallel, where before the page
read the machines first: one round trip shorter, with the same result. On the machine record, `notOnDisplay` now comes
from the same `machine.machine_status` column through `machinesForMaintenance(db, { machineId })` instead of through
`machineRecord`. That is the same value for a machine that is not retired. The flattening and sorting of the due tasks
moved over unchanged.

**The retired edge.** Acceptable, and arguably more consistent than before. ST-039 (user, 2026-10-17) decides that a
retired machine's record shows „Ausgemustert“ *in place of* its machine status. A section 5 that still said
„Nicht ausgestellt – es wird keine Wartung fällig.“ repeated the very status the header suppresses. „Gerade ist an
diesem Gerät keine Wartung fällig.“ is true for a retired machine (the context map: `EVT-MachineRetired` removes the
machine from due maintenance), and its records stay listed. No scenario of ST-039, ST-047 or ST-056 covers the case
either way, so nothing documented changes. It is still a visible change in a done area, though, and no test pins it
(#1).

**Conventions text.** Accurate in what it lists: Collection's published query, the three answers, "the way a
command's facts do" (`maintenanceFacts`), and "below" points at the right section. The heading claims more than the
code does, and the section it makes an exception to doesn't point back (#2).

**Leftover comments and dead exports.** No dead export. No comment still says "the page passes the machines in". Three
doc comments still attach "the page composes (ST-009)" to Maintenance's due tasks on Collection's machines (#3).

**Test coverage.** Covered at the agreed seams. `machine-record-maintenance.integration.test.ts` goes through
`loadMachineRecord` and the rendered HTML: records, the 5 latest, due and overdue, helpers, Not on display, nothing due
and nothing recorded, the order of the due tasks. The two dashboards, the due maintenance list and the record-for-several page
keep their page-level tests. `machineMaintenance` has no module-level test of its own, which is right: the page test is
the seam. In `record-maintenance-command.integration.test.ts` the `dueOn` helper and the G11 test now find the machine
by ID among all machines instead of pre-filtering, which keeps the meaning (`machines[0]` became
`find(machineId)`).

**Depth.** Passes the deletion test. Delete `machineMaintenance` and the parallel read, the due-task flattening and
sorting and the Not on display rule come back into the page. Delete the machines parameter's removal and the
five pairings come back. The interface also got smaller for every caller.

## Findings

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Test quality / behaviour | `src/modules/maintenance/machine-maintenance.ts:48` | The deliberate change for a retired machine that is Not on display (section 5 said „Nicht ausgestellt“, now says „nichts fällig“) is pinned by no test. A later edit could switch back, or start showing due tasks on a retired machine, with every test green. Because a retired machine is left out of `machinesForMaintenance`, the result hangs on Collection's filter, not on anything in this module. | tdd skill (a decided behaviour is checked); ST-039 status display (user, 2026-10-17); context map (`EVT-MachineRetired` removes the machine from due maintenance) | Accept the new behaviour. Add one test at the existing seam (`machine-record-maintenance.integration.test.ts`): a machine set Not on display, with one maintenance record and a task overdue on it, then retired. Assert that section 5 shows the nothing-due text, not „Nicht ausgestellt“, and still lists the record. Title it as a decision, not as an `ST-047:` scenario. Mention the edge in the PR description. |
| 2 | minor | Conventions text | `.claude/skills/engineering-conventions/SKILL.md:239-244`, `:515` | The heading "Maintenance reads Collection's machines itself" is broader than the code. The paragraph just above still documents `maintenanceForRecording(db, clock, taskId, machine, teamMember)`, and two pages (`record-maintenance-data.ts:27-32`, `due-maintenance-data.ts:156-158`) still read `machineForMaintenance` and pass the machine in. A reader can't tell whether those two are leftovers or intended. Also, the "page composes" section at line 515 doesn't mention that this exception exists, so someone reading only that section gets the old rule. | conventions are the reference for later stories (Divergent Change risk: the next Maintenance answer may follow either pattern) | Either say so in the paragraph ("…for the machines it computes over; the form page still passes the one machine it already read for its label and location"), or move `maintenanceForRecording` over too (a later candidate). Add one sentence at line 515 pointing to the exception. |
| 3 | minor | Comments | `src/app/(team)/team/helper-dashboard-data.ts:50-52`, `src/app/(team)/team/technician-dashboard-data.ts:64-67`, `src/app/(team)/team/maintenance/due-maintenance.integration.test.ts:51-52`, `src/app/(team)/team/helper-dashboard.integration.test.ts:19-21` | These comments still attach "the page composes (ST-009)" to "Maintenance's due maintenance tasks on Collection's machines". The page no longer composes that part. The due maintenance list test's doc is the clearest case, because composing the machines was the only cross-module part there. | comments must say what the code does; the new conventions paragraph | Say "Maintenance's due maintenance tasks (on Collection's machines, read by Maintenance)" and keep "the page composes" for the parts it still composes (Repair's defects with Collection's machines and Team's names). |
| 4 | minor | Naming | `src/app/(team)/team/machines/[museumNumber]/machine-record-data.ts:11`, `:58` | Two types are named `MachineMaintenance`: Maintenance's, imported under the alias `MaintenanceOfMachine`, and the page's, which swaps in the shown records. The alias reads like a synonym rather than a different shape. The page file's own convention for this is `Shown…` (`ShownMaintenanceRecord`, `ShownEndedRepairHistoryEntry`). | Mysterious Name; local convention in the same file | Rename the page type to `ShownMachineMaintenance` (and its use in `machine-maintenance.tsx`) and import Maintenance's type under its own name. |
| 5 | minor | Naming | `src/modules/maintenance/machine-maintenance.ts:39`, `src/modules/maintenance/record-maintenance-command.integration.test.ts:75` | `latestRecords` means a count in the options and a list of records in the result. A caller reads `{ latestRecords: 5 }` and gets back `latestRecords: [...]`. Separately, the test helper `dueOn(day, taskId, machineId)` now has the same name as the module function `dueOn(db, clock, machines, teamMember)`, with a different meaning. | Mysterious Name | Name the option `latestRecordCount` (or `newest`). Rename the test helper to `dueThatDay` or similar. |
| 6 | minor | Performance (judgement) | `src/app/(team)/team/machines/[museumNumber]/machine-record-data.ts:90-102` | The machine record has one more sequential round trip. Before, `named` ran in parallel with the due computation. Now it waits for `machineMaintenance`, which needs machines (two queries in sequence) and then `dueOn`. The latest records it needs for names arrive early but are only returned with the rest. The cost is a few milliseconds on one page and doesn't matter today. It is the price of the one call. | codebase-design (an interface's performance is part of it) | Accept. A small free gain inside the module: `dueOn` now waits for `latestMaintenanceRecords` too (both are in one `Promise.all` before it). `machinesForMaintenance(db, { machineId }).then(dueOn…)` in parallel with the latest records removes that wait. The remaining wait for `named` comes with "names after reads". |

No blocker, no major, no follow-up. Nothing passes the follow-up hurdle: none is a security or data-loss risk, and
each can be done in this PR in minutes. #2 could become the next candidate if `maintenanceForRecording` is meant to
move as well.

ready to merge
Most important: #1. The retired-and-Not-on-display change is deliberate and fits ST-039, but no test pins it.
