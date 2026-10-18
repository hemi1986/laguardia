# Code review – arch-maintenance: Maintenance answers due maintenance and the form page for the team member
Base: main · Commits: 1 · Date: 2026-10-18

Refactoring branch from architecture review 2026-10-18, candidate 3 (no story). Checked against the conventions
(G11 paragraph, "the page composes", time helpers), ADR 0002 (module boundaries, read models computed on read), the
glossary, and against the old code for behaviour. `check-language.ts` reports no warning in the changed files. The
maintenance module tests and the page tests (`src/modules/maintenance`, `src/app/(team)/team/maintenance`, 8 files,
65 tests) pass.

Correct as built. Behaviour is unchanged.
- **Due list:** the old page called `recordRefusal(chosen, facts, …)` with the `DueMaintenanceTask` and the same
  `MachineForMaintenance` object from `machinesForMaintenance`. The new code calls `recordRefusal(task, machine, …)`
  inside `dueMaintenance` with the plan's task and the same machine. Same rule, same inputs (`retired` is always
  `false` on `MachineForMaintenance`), `false` without a viewer.
- **Form page:** it used to read the task from `maintenancePlan(db).maintenanceTasks`. Now it reads it from
  `activeMaintenanceTasks(db)`. Both filter removed tasks, so the result is the same set and one version query fewer.
  The dates still come from `today(clock)` and `LONGEST_BACK_DATING_DAYS`, which are now internal.
- **Boundaries and other callers:** the page imports only Collection's and Maintenance's `index.ts`. `dueMaintenance`
  has no other production caller that could silently lose `recordOffered`. The old doc comment's "no such machine that
  is not retired" was inaccurate: `machineForMaintenance` returns retired machines, and those got
  `whyNot: "machine-retired"`. The new comment corrects it.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Design (interface) | `src/modules/maintenance/maintenance-records.ts:119-127`, `src/app/(team)/team/maintenance/erfassen/record-maintenance-data.ts:23-28` | `maintenanceForRecording` takes `machine: … \| undefined` and returns undefined for "no machine". Its one caller already returns early when Collection has no machine (`if (!facts …) return undefined`), so that branch is dead in production and only adds a caller's check to the interface. The page also still does Maintenance's half of the lookup: it reads `machineForMaintenance` itself, only to pass it on. Yet `maintenanceFacts`, a few lines above in the same file, reads that published query directly, and `defectForAction`, the model named for this candidate, reads its machine itself (`reopeningFacts` → `machineForReporting`). | Shallow interface / Middle Man; codebase-design "Can I simplify the parameters?"; consistency with `maintenanceFacts` and `defectForAction` | Either drop `\| undefined` from the parameter (smallest change), or let `maintenanceForRecording(db, clock, taskId, machineId, teamMember)` read `machineForMaintenance` itself, as the command's facts do. The page would then add only the labels. The candidate text says "the page still passes Collection's machines", which fits the *list* (many machines, one read). For one machine it is a choice for the main session. |
| 2 | minor | Naming | `src/app/(team)/team/maintenance/erfassen/record-maintenance-data.ts:2,8` | There are two types called `MaintenanceForRecording`: the module's (task, `whyNot`, dates) and the page's (the module's plus `machine`). The page imports the module's type under the alias `Recording`. Readers and searches cannot tell which one is meant. | Mysterious Name | Give the page's type a page name, e.g. `RecordMaintenancePageData`, and import the module's type unaliased. |
| 3 | minor | Test quality | `src/modules/maintenance/record-maintenance-command.integration.test.ts:209-241` vs `src/app/(team)/team/maintenance/due-maintenance.integration.test.ts:494-533` | The two new module-seam tests repeat the page tests case by case: helper vs. technician on a task not suitable for helpers, `today` 2026-06-10 / `earliest` 2026-06-03, unknown task → undefined. The rule now lives in the module, but every case is checked twice, at two seams. Expected values are independent literals, not tautological. | tdd / DEEPENING "replace, don't layer" | Keep the module tests as the rule's home. Slim the page test to what the page adds: Collection's machine fields, the rendered date limits and refusal text, unknown museum number. Or accept the overlap deliberately. |
| 4 | minor | Test quality | `src/modules/maintenance/maintenance-records.ts:126` | The form page now reads the task from `activeMaintenanceTasks` instead of `maintenancePlan`. This is equivalent today, but no test at either seam pins "a removed maintenance task gives no form page" (`undefined`). The due list's removed-task case (`ST-043: Retired machines and removed maintenance tasks are not listed`) does not cover the form. | tdd: each promise of the interface has a test at its seam | Add one case to the module test: remove the task via `changeMaintenancePlanCommand`, then expect `maintenanceForRecording(…)` to be undefined. |
| 5 | minor | Conventions | `.claude/skills/engineering-conventions/SKILL.md:210-220` | The G11 paragraph describes only Repair's form: `defectActionRefusals`, `defectDetails(…).actions`, `defectForAction`. Maintenance now follows the same pattern, with `recordOffered` on each `DueMachine` and `maintenanceForRecording` for the form page, and with `recordRefusal` kept internal. The conventions do not say so. The next command offered on a maintenance list would not find the precedent. | Conventions as the source of truth for patterns | Add one sentence naming Maintenance's two answers next to `defectForAction`, and say that refusal functions stay internal to their module. |
| 6 | minor | Performance (negligible) | `src/app/(team)/team/maintenance/erfassen/record-maintenance-data.ts:23-28` | The page now makes three sequential round trips (`machineIdOf` → `machineForMaintenance` + `machineLabels` → `activeMaintenanceTasks`). Before, the plan was read in parallel with `machineIdOf`. Not noticeable on one form page. | – | Goes away if #1 moves the machine read into the module and runs it alongside the task read. Otherwise ignore. |

**Verdict: ready to merge** (no blockers, no majors).
Most important: #1. `maintenanceForRecording` takes Collection's machine, possibly undefined, from the page. Its own
command facts and `defectForAction` read that machine themselves. Decide whether the one-machine question takes a
machine ID, or at least drop the dead `undefined`.

## Resolution (main session, 2026-10-18)

1. **Fixed** – the dead `undefined` is gone; the page keeps passing Collection's machine, as the candidate says (architecture review 2026-10-18).
2. **Fixed** – the page's type is `RecordMaintenancePageData`.
3. **Accepted** – the page tests check the rendered page (link, date field, refusal text), the module tests the answer; the overlap stays.
4. **Fixed** – a module test: a removed maintenance task gives no form page.
5. **Fixed** – the conventions name Maintenance's answer next to Repair's (G11).
6. **Accepted** – three small reads in a row on one form page; not noticeable.
