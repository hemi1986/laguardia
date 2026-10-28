# Code review – architecture review 2026-10-28, candidate D

Base: main · Branch: `refactor-rejections-carry-their-subject` · Commits: 1 · Date: 2026-10-28 · Reviewer: code-reviewer (not a story review)

Scope: a decision's rejection may name its `subjects` (the IDs that caused it). `Rejected` carries them and
`executeCommand` returns them. An aggregate command's `result` gets the input as a third argument.
`machinesRefusal` and the machine-record branch of CMD-ChangeMachinesOfMaintenanceTask name the machines or tasks that
cause a rejection. The change command's result names `{ maintenanceTaskId }` or `{ machineId }` from its input. The
runner's `many` step gets `seen?: true` (`SeenField`, `SEEN_FIELD`, `seenValue`, `seenOf` in `form-parts.tsx`), and a
rejection keeps `seen` and the subjects in `ManyFormState`. `retired-among.ts` (which ran a query after the
transaction) is replaced by `retired-named.ts` (`withRetiredNamed`). The two change forms get a definition module and
a module-level action, and their page tests post through the real definitions. The conventions are revised.

Checked and found in order:
- **Every other command and form behaves as before.**
  - `subjects` is optional on `Decision`, `CommandOutcome` and `CommandResult`. `executeCommand` adds the key only when
    `Rejected` carries subjects, so every existing `toEqual({ ok: false, error })` assertion still holds. The 291 tests
    in scope pass.
  - The command layer's own `Rejected("not-authorized")` (`index.ts:214`) carries no subjects. `not-found` and
    `version-conflict` never do.
  - A policy's rejection travels through `runInTransaction` → `Rejected(outcome.error, outcome.subjects)`, so a nested
    command's subjects would reach the caller. Today no policy decision names subjects, so nothing changes.
  - `result` gets a third argument. The two call sites in `aggregate.ts` (`:316`, `:337`) pass it, and every existing
    `result` ignores it (tsc is clean).
  - The `each`, photo, photos and plain steps of the runner are unchanged. `many` without `seen` passes `[]`, and the
    add-task form's two-argument `addMaintenanceTaskInput` still fits the three-argument `input` type. That form's
    state now also holds `seen: []`, which is harmless.
- **Client and server modules are apart.**
  - `form-parts.tsx` has no `"use client"`, so the server-side `form-runner.ts` may import `SEEN_FIELD`/`seenOf` from
    it. A `"use client"` file would have turned them into client references.
  - `change-tasks-form.tsx` imports only `TASK_FIELD` from `change-tasks-input.ts`, which has type-only imports.
  - `change-machines-form.tsx` imports `change-machines-input.ts`. That module also holds the pure
    `machinesChangedLanding` but imports nothing at runtime.
  - The database-backed landing and naming for the machine record live in `change-tasks-outcome.ts`
    (`import "server-only"`).
- **Landing after a change that changed nothing.** The result now comes from the input. On success the input's
  `maintenanceTaskId`/`machineId` is one the decision found: `ticksOfTask` rejects an unknown or removed task first,
  and `ticksOfMachine` rejects an unknown or retired machine first. So the URL gets a real ID even when nothing
  changed. That ID matches a stored one exactly, so it is a UUID and needs no encoding. `tasksChangedLanding` keeps the
  old fallback to `/team/machines`, and the revalidated path is the same as before. One gap is left, see #1.
- **Forged posts.**
  - The ticked boxes behave as before. They arrive as posted, and the decision rejects doubles, unknown IDs and
    non-IDs, now naming them.
  - A forged `seen` can only produce a delta the technician could have produced by ticking: an entry "seen" but not
    stored is skipped, and an entry "not seen" but stored is a no-op. A non-ID in `seen` goes through
    `readChosenMachines` → `machineForMaintenance` as before. Before the refactor `seen` was a declared field, so this
    is no new surface.
  - A form without `seen: true` never reads the field.
- **What a subject can hold.**
  - `machine-retired` and `maintenance-task-removed` name only IDs that were found in the transaction, so
    `machineLabels`/`removedMaintenanceTaskNames` get real IDs.
  - `unknown-machine` and `maintenance-task-unknown` echo the forged strings back. They go only to the person who
    posted them, in action state that React escapes, and `chosen` echoed them already.
  - No subject is a name or free text, and no subject reaches a visitor page or a log.
- **Tests post through the definitions.** `change-machines.integration.test.ts:105` and
  `change-tasks.integration.test.ts:108` spread `changeMachinesDefinition`/`changeTasksDefinition`. The add-task tests
  still copy their action's definition, see #3.
- **Subjects are asserted** at the decision (table tests), the command (integration), the command layer (a new test) and
  the runner (a new test), and on both pages. The tests that still assert `{ ok: false, error }` without subjects
  belong to rejections that name none (the fixed side), which is intended.
- `npx tsc --noEmit -p .` is clean. `npx vitest run` on the five paths passed 44 files and 291 tests. eslint reports two
  warnings and Prettier two unformatted files, see #5. `check-language.ts` reports no warning on a diff line.

| # | Severity | File | Finding | Suggested direction |
|---|---|---|---|---|
| 1 | major | `src/app/(team)/team/maintenance-plan/[maintenanceTaskId]/geraete-aendern/change-machines.integration.test.ts:218-224`, `src/app/(team)/team/machines/[museumNumber]/wartungsaufgaben-aendern/change-tasks.integration.test.ts:330-335`, `src/modules/maintenance/change-machines-of-maintenance-task-command.ts:42-43` | No test pins down the behaviour this refactor exists for: the command's **result names the task (or machine) also when nothing changed**. The two "lands on …" tests call `machinesChangedLanding`/`tasksChangedLanding` with the test's own ID, and their `send` drops the result (`onSuccess: async () => {}`). The command integration tests check only `toMatchObject({ ok: true })`. If `result` went back to `() => ({})` or swapped the two branches, the type cast `as Command<…, { maintenanceTaskId: string }, …>` would hide it, and every test would stay green while the landing became `?machinesChanged=undefined`. | In the two command integration tests, assert `{ ok: true, result: { maintenanceTaskId: task } }` and `{ ok: true, result: { machineId: lg042 } }` for a change that changes nothing (`seen` = `ticked`). Or let the page test's `onSuccess` capture the result and feed it into the landing function. |
| 2 | minor | `.claude/skills/engineering-conventions/SKILL.md:488-492` | The runner section *A form whose checkboxes are values of one command* still describes `many: { field }`, `input: (fields, chosen) => …` and a state that holds only `chosen`. It does not mention `seen: true`, the third `input` argument, `state.seen` or `state.subjects`. These facts appear only in the ST-095 paragraph (`:288-292`), which a reader of the runner section will not find. | Extend that bullet: "With `seen: true` (a set delta) the runner reads a `SeenField` and passes it as the third argument. A rejection keeps it as `seen` and carries the decision's `subjects`." |
| 3 | minor | `src/app/(team)/team/maintenance-plan/new/add-rejections.integration.test.ts:37-50`, `src/app/(team)/team/maintenance-plan/new/actions.ts:36-43` | The add-task form keeps the pattern this refactor removes from the two change forms. Its tests rebuild `{ fields: addMaintenanceTaskFields, many: { field: MACHINE_FIELD }, input: addMaintenanceTaskInput }` by hand instead of posting through what the action runs. The conventions now say "what the action runs is what its tests post through". | Add `addMaintenanceTaskDefinition` beside `addMaintenanceTaskInput` and spread it in the action and in `send`. Or note it as accepted for this candidate. |
| 4 | minor | `src/app/(team)/team/machines/[museumNumber]/wartungsaufgaben-aendern/actions.ts:93-95` | `revalidatePath(landing.split("?")[0])` takes the landing URL apart again to get the path the function just built. The behaviour is the same as before, but the coupling is implicit: a landing with a fragment, or one with no query, would still work only by accident. | Let `tasksChangedLanding` return `{ path, href }` (or the museum-number record path plus the query separately), so the action revalidates `path` and redirects to `href`. |
| 5 | minor | `src/modules/maintenance/change-machines-of-maintenance-task.test.ts:141,211`, `src/platform/command/index.ts:113-115` | eslint reports `'_title' is defined but never used` twice: the destructuring only drops `title` before `...cause`. Prettier would reformat both files, while the other changed files are formatted. Formatting is not enforced by `verify.ts`. | Destructure `subjects` explicitly (as `change-maintenance-plan.test.ts:130` does) and drop `_title`/`...cause`. Run `npx prettier --write` on the two files. |
| 6 | minor | `src/app/(team)/team/maintenance-plan/retired-named.ts:1` | `change-tasks-outcome.ts` is marked `import "server-only"`, but its sibling `retired-named.ts` is not. Both are database-backed helpers of a Server Action. Today no client file imports it, so this is consistency only. | Add `import "server-only"` to `retired-named.ts`. |

Verdict: **ready to merge** – there is no blocker. Behaviour of every other command and form is unchanged, client
forms import no server code, forged `seen` or ticked values open no new surface, and subjects are IDs only.
Most important finding: #1 – the result that drives the landing after a change that changed nothing is untested and
hidden by a type cast, so a regression would stay green.

## Outcome

| # | Outcome |
|---|---|
| 1 | Fixed: both command tests of a change that changes nothing assert the result – `{ maintenanceTaskId }` from a task, `{ machineId }` from the machine record. |
| 2 | Fixed: the runner's `many` bullet names `seen: true`, the third argument, `state.seen` and `state.subjects`. |
| 3 | Fixed: `addMaintenanceTaskDefinition` – the add page's action and its tests post through it. |
| 4 | Fixed: `tasksChangedLanding` returns the record to revalidate and the address to land on. |
| 5 | Fixed: no unused names in the rule table; the files formatted. |
| 6 | Fixed: `retired-named.ts` is `server-only`. |
