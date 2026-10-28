# Code review – architecture review 2026-10-28, candidate A

Base: main · Branch: `refactor-machines-of-maintenance-task` · Date: 2026-10-28 · Reviewer: code-reviewer (not a story review)

Scope: one decision and one command object (two typed names) for CMD-ChangeMachinesOfMaintenanceTask from a task (ST-095)
and from the machine record (ST-096); one module for the machines of a maintenance task; the agreed rule changes (a task
ticked twice is rejected, an unticked entry no longer offered is skipped).

Checked and found in order: the ST-095 path is unchanged (checks, precedence, event, ID order, facts); the ST-096 path keeps
its events and their order; the add path of CMD-ChangeMaintenancePlan keeps its entries and event; the decision returns the
loaded plan itself when nothing changes; ADR 0010's lock order is unchanged; no reference to a deleted name is left; the new
error code has its text.

| # | Severity | File | Finding | Outcome |
|---|---|---|---|---|
| 1 | minor | `…/wartungsaufgaben-aendern/actions.ts` | The rejection named every removed task among chosen + seen – also one only unticked, which is now skipped and never the cause. | Fixed: only newly ticked tasks are named. |
| 2 | minor | `docs/stories/ST-096-…md:25` | The done story's rules say a task removed meanwhile rejects the whole change; now only when it is newly ticked. Scenarios still hold. | No change (done stories stay closed); named in the pull request. |
| 3 | minor | `change-machines-of-maintenance-task.test.ts` | "Nothing to do" rows checked deep equality, not that the loaded plan itself is returned. | Fixed: `toBe(plan)`. |
| 4 | minor | same | Nothing proved that an entry which already applies needs no check (task side). | Fixed: a retired machine that still applies, ticked – nothing to do. |
| 5 | minor | same | The machine side asserted events only; no row combined the bug fix with a real change. | Fixed: state asserted; a row unticks a removed task and ticks another. |
| 6 | minor | `machines-of-maintenance-task.ts` | `withMachinesChanged` left skipping an entry that already applies to its callers – passing one would reset its `addedAt` (last done, HS-24). | Fixed: it skips it itself. |
| 7 | minor | `change-machines-of-maintenance-task.ts` | The facts reader (a database read) sat in the decision file. | Fixed: back in the command file. |
| 8 | minor | same | `type Error` shadowed the global; `wanted: boolean` was unclear. | Fixed: `ChangeError`, `kind: "add" \| "remove"`. |
| 9 | minor | `change-tasks-of-machine-command.integration.test.ts` | Named after the deleted module. | Fixed: renamed `change-maintenance-tasks-of-machine-command.integration.test.ts`. |
| 10 | minor | `engineering-conventions/SKILL.md` | "Never filters `removedAt` itself" overlooked the SQL of `lastDoneByRecord`. | Fixed: the exception is named. |

ready to merge
Most important: #1 – the rejection named removed tasks that were only unticked (and so skipped), a wrong cause.
