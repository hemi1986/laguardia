# Code review – architecture review 2026-10-28, candidate B

Base: main · Branch: `refactor-maintenance-task-test-support` · Commits: 1 · Date: 2026-10-28 · Reviewer: code-reviewer (not a story review)

Scope: tests and test support only. A new Given for a maintenance task (`src/test-support/maintenance.ts`:
`aMaintenanceTaskIn`, `removeMaintenanceTaskIn`, `maintenancePlanJournal`) replaces the copied CMD-ChangeMaintenancePlan
calls in eleven integration test files. The dead maintenance builders are gone, `TEST_TECHNICIAN` moved to
`team-members.ts`, the command's own test runs in a database of its own, and the conventions name the new Givens.

Checked and found in order:
- No test or scenario assertion was lost. The only removed `it` blocks are the two `builders.test.ts` tests of the deleted
  dead builders, and no reference to those builders is left in `src/` or `e2e/`. The removed
  `expect(removed).toMatchObject({ ok: true })` (change-machines-of-maintenance-task, ST-095) was an arrangement step. The
  helper now throws on `!ok` instead, which is just as strict.
- Defaults are kept per file for interval, suitableForHelpers, timestamp, acting person (always `by:` the file's own
  tom/eva/actor) and the unique name suffix (still built by the caller where it was). `record-maintenance` keeps
  "As usual." explicitly because it asserts on it (line 244). The only change is the instruction text, see #1.
- Module boundaries: `src/test-support/maintenance.ts` imports `@/modules/maintenance` through its index only. eslint is
  clean on all changed files.
- The isolated database of `change-maintenance-plan-command.integration.test.ts` follows the pattern of the other files:
  `isolatedTestDatabase("change_maintenance_plan")` with a unique name, `reset()` in `beforeAll`, `close()` in `afterAll`.
  After the change, `form-runner.integration.test.ts` is the only test file in the shared database that changes the
  maintenance plan, so the version-conflict race is gone.
- Copies of the add command left in tests: the command's own test, the form runner's test, the form tests
  (`maintenance-plan.integration.test.ts`, `add-rejections`) going through `formRunner` and `due-maintenance`'s `changed`
  (a *change*, not an add) are all legitimate. `machine-choice.integration.test.ts:161-178` adds through
  `executeCommand` as the very step the test checks ("can still be added, and applies to no machine"). Keeping it
  explicit is the right call.
- `npx tsc --noEmit -p .`: clean. `npx vitest run --project integration`: 116 files, 763 tests passed.
  `builders.test.ts`: 6 tests passed.

| # | Severity | File | Finding | Suggested direction |
|---|---|---|---|---|
| 1 | minor | `src/modules/maintenance/in-command.integration.test.ts:28`, `change-machines-of-maintenance-task-command.integration.test.ts:47`, `change-maintenance-tasks-of-machine-command.integration.test.ts:43`, `wartungsaufgaben-aendern/change-tasks.integration.test.ts:82`, `geraete-aendern/change-machines.integration.test.ts:85` | Not every default is kept: the instruction changed from "As usual." / "Clean it." to the helper's `` `${name} – how to` ``. None of these files asserts on the instruction (checked by grep), so no test changes meaning. It still departs from "defaults unchanged". | Accept it and mention it in the pull request. No code change is needed. |
| 2 | minor | `src/test-support/maintenance.ts:64-68` | `maintenancePlanJournal` finds the plan by raw SQL on the table `maintenance_plan`. That is a second copy of something the module already knows (`MAINTENANCE_PLAN_ID` in `maintenance-plan.ts`), and it couples cross-module test support to a module's table name. It works, guards "exactly one plan" and stays inside the boundary rules, so it is acceptable for test support. The module's own `maintenance.test-support.ts`, which app tests already import, could give the same answer from the constant with no SQL. | Optional: move `maintenancePlanJournal` into `src/modules/maintenance/maintenance.test-support.ts` and use `MAINTENANCE_PLAN_ID`. Otherwise keep it as it is. |
| 3 | minor | `src/test-support/builders.test.ts:2-10` | Prettier fails on this file now: after two names left the import list, it fits on one line. The file was formatted on main, so this diff introduced the failure. (`change-maintenance-plan-command.integration.test.ts` also fails Prettier, but it already did on main.) | Run `prettier --write` on `builders.test.ts`. |
| 4 | minor | `src/test-support/builders.ts:6` | The header still says the builders cover "every aggregate of docs/architecture/data-model.md". The maintenance plan and the maintenance record no longer have builders. | Reword it, e.g. "builders for aggregates tested without a database; maintenance tasks are Givens in `maintenance.ts`". |
| 5 | minor | the eleven test files, line 3–6 each (e.g. `helper-dashboard.integration.test.ts:6`) | `import … from "@/test-support/maintenance"` sits at the top of the `@/…` imports, away from the file's other `@/test-support/…` imports. It looks like it was inserted mechanically. | Move it next to the other `@/test-support` imports. Cosmetic. |
| 6 | minor | `src/test-support/machines.ts:34,71` | `const technician = TEST_TECHNICIAN;` is a leftover alias that adds nothing. | Use `TEST_TECHNICIAN` directly. |
| 7 | minor | `src/modules/maintenance/record-maintenance-command.integration.test.ts:254` | `at: tenthOfJune.now().toISOString()` turns a Clock back into a string because the helpers accept only an ISO string. This is the only caller holding a Clock, so it is not worth widening the interface. | Leave it, or declare an ISO string next to `tenthOfJune` in that file. |

Verdict: **ready to merge**. There are no blockers or majors: no test was weakened, the boundaries hold, and type check and integration tests are green.
Most important finding: #1, the instruction default changed in five files. It is harmless because nothing asserts on it, but it should be named in the pull request.

## Outcome

| # | Outcome |
|---|---|
| 1 | Accepted, named in the pull request. |
| 2 | Fixed: `maintenancePlanJournal` moved to `src/modules/maintenance/maintenance.test-support.ts`, on `MAINTENANCE_PLAN_ID`, no SQL. |
| 3 | Fixed: formatted. |
| 4 | Fixed: the header says maintenance tasks are set up through the command. |
| 5 | Left as is (cosmetic). |
| 6 | Fixed: `TEST_TECHNICIAN` used directly. |
| 7 | Left as is. |
