# Code review – arch-defect-actions: Repair describes each action on a defect once, the app has one registry and one runner
Base: main · Commits: 1 · Date: 2026-10-18

Refactoring branch from architecture review 2026-10-18, candidate 1 (no story). Checked against the conventions
("What a team member can do to a defect", *Server Actions and forms*, G3/G11), ADR 0002 (module boundaries), the
glossary, and against the old code for behaviour. `check-language.ts` reports no warning in the changed files. The
defect page and Repair module tests (`src/app/(team)/team/defects/[defectId]`, `src/modules/repair`, 40 files,
260 tests) pass.

Correct as built. Behaviour is unchanged.
- **Server Actions:** every one of the 10 still calls `requireTeamMember()` before the runner, runs the same command
  through `formAction` (claim and assign both `claimDefectCommand`), revalidates `/team/defects` and redirects to
  `/team/defects/<result.defectId>?done=<action>`. The redirect target is now `defectDoneAddress`, the same string.
  `satisfies { [A in DefectAction]: Command<never, { defectId: string }, string> }` makes the compiler enforce that
  every command's result names the defect.
- **Confirmation:** `lastDefectActionBy` filters the same event types as the old `actionOfEvent` (the union of the
  descriptions' `event`s is the same 9 types). `EVT-DefectClaimed` is resolved in table order: claim's `confirms`
  gives undefined exactly when assign's gives a value (`assignedBy` set), so the result is the same as the old
  `assigned ? "assign" : "claim"`. `change-details` builds the same `changedDetails`. The integration tests cover
  claim, assign (3×) and change-details (2×) through `done`.
- **`done`:** the page used to pass any string and `loadDefectDetails` compared it with the journal's action. Now
  `doneActionOf` reduces it to a `DefectAction` or undefined first. An unknown or repeated `done` gave no confirmation
  before and gives none now.
- **Boundaries:** the app imports only `@/modules/repair` (`defectActionCommands`, `defectActions`, types) and
  `@/app/_actions/form-action`. `defect-action-commands.ts` imports `DefectAction` only as a type. The cycle it avoids
  is real: `defects.ts` imports `defectActionRefusals` as a value, and the commands load the store from `defects.ts`.
  Putting the commands into `descriptions` would evaluate them in a module cycle.
- **Conventions:** "a Server Action only calls the runner" still holds, because `defectFormAction` ends in
  `formAction` and adds only the access check and the redirect, which the conventions put in the action anyway.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Type safety | `src/app/(team)/team/defects/[defectId]/defect-action.ts:31` | `defectActionCommands[action] as unknown as Command<InputOf<A>, { defectId: string }, ErrorOf<A>>`. The double cast is needed because TypeScript cannot correlate a generic key with its value in an `as const` object. It holds as long as `A` is one literal. Nothing stops `defectFormAction<"claim" \| "prioritize">(…)`, though: with a union `A`, `InputOf<A>` becomes the union of both inputs, and the cast then claims each command accepts the other's input. Today no caller does this, every one passes a literal. The comment states the assumption, but nothing enforces it. | Type safety; codebase-design "the interface includes every fact a caller must know" | Use TypeScript's correlated-union pattern (TS#47109) instead. Type the table in Repair as a mapped type over per-action input/error maps, `{ [A in DefectAction]: Command<DefectActionInput[A], { defectId: string }, DefectActionError[A]> }`. `defectActionCommands[action]` is then `Command<DefectActionInput[A], …>` without a cast, and `InputOf`/`ErrorOf` go away. If that costs more than it's worth, accept the cast as it is. |
| 2 | minor | Type safety | `src/modules/repair/defect-actions.ts:180-185` | `(confirms as (data: Data) => …)(latest.data)` widens each `confirms` parameter to the data union of all repair events. It is sound only because the `if (event !== latest.type) continue` just above it holds, and the compiler does not link the two. Swap the lines or drop the guard, and it still type-checks. The claim/assign split also depends on the table order plus the two `confirms` being complementary (`assignedBy === undefined` vs `!== undefined`). If both ever answered, the first would win silently. | Type safety; Repeated Switch moved into a convention | Put the check and the narrowing in one place, e.g. a generic helper `confirmationOf(description, entry)` with a type guard `entry is CatalogueEntry<RepairEntries, Type>`, so the cast lives next to the check that makes it true. The order dependence is covered by the integration tests (claim and assign via `done`), which is enough. A one-line comment at `claim` and `assign` ("exactly one of the two confirms an EVT-DefectClaimed") would make it explicit. |
| 3 | minor | Type safety | `src/modules/repair/defect-actions.ts:137` | `defectActions` used to be a `readonly` tuple (`as const`). Now it is `Object.keys(descriptions) as DefectAction[]`, a mutable array shared by every caller (`defect-details.tsx`, `defect-details-data.ts`, `doneActionOf`). A `.sort()` or `.push()` anywhere would change the order the page offers (G22) for everyone. | Type safety | `as readonly DefectAction[]` (and `Object.freeze` if wanted). |
| 4 | minor | Naming | `src/app/(team)/team/defects/[defectId]/defect-action-pages.ts:61`, `defect-action.ts:31` | Three names that read alike mean different things. `formAction` is the Server Action runner. `defectFormAction` is the runner for *every* action on a defect, including the one-tap claim/release/resume, which have no form page. `FormAction` is the type of the actions that *do* have a form page. A reader of `defectFormAddress(id, action: FormAction)` will think of the runner. | Mysterious Name | Rename the type to what it means, e.g. `ActionWithFormPage`. Optionally call the runner `defectServerAction` or `defectActionRunner`, since it is not tied to a form page. |
| 5 | minor | Duplicated code / speculative export | `src/app/(team)/team/defects/[defectId]/defect-action-pages.ts:12`, `src/modules/repair/index.ts:82` | `ConfirmationAbout.changedDetails` spells out Repair's `DefectActionDetails["changedDetails"]` shape by hand (`{ title; suitableForHelpers; releasedClaimOf }`). The old `Confirmed` type derived it from `DefectDetailsData`. Meanwhile `LastDefectAction` is newly exported from Repair's `index.ts`, and nothing outside Repair imports it. | Duplicated Code; Speculative Generality | Derive the field (`NonNullable<DefectDetailsData["confirmed"]>["changedDetails"]` as before, or `LastDefectAction["changedDetails"]`, which also gives the new export a use). Otherwise drop the export. |
| 6 | minor | Type readability | `src/app/(team)/team/defects/[defectId]/defect-action.ts:14-17` | `DefectActionState` builds `CommandError<Command<never, unknown, ErrorOf<A>>>`: it takes the error out of the command and wraps it in a made-up command, only so `CommandError` can take it out again. The result equals `CommandError<CommandOf<A>>`. | Middle Man (type level) | `FormState<CommandError<CommandOf<A>>, Field>`. `ErrorOf` is then only needed for the cast in #1, or not at all. |
| 7 | minor | Design (noise) | `src/modules/repair/defect-actions.ts:68-121` | 7 of the 10 descriptions say `confirms: () => plain`, and most `refusal`s are lambdas that only forward to a function with the same parameters (`(defect, teamMember) => claimRefusal(defect, teamMember)`). What is special about each action (claim/assign's split, change-details' data, reopen's facts) gets lost in repetition. | Duplicated Code (small) | Optional: make `confirms` default to `plain` in `described`, and pass the refusal functions directly where their signature fits. Keep the lambdas only for `log-work` and `reopen`. |
| 8 | minor | Design | `src/modules/repair/defect-action-commands.ts:18`, `defect-actions.ts:66` | "Described once" is two tables in Repair, `descriptions` and `defectActionCommands`, plus `defectActionPages` in the app. The `satisfies { [A in DefectAction]: … }` on both other tables makes a forgotten entry a type error, so this is guided Shotgun Surgery, not silent. The cause is a placement choice: `defects.ts` holds both the store and the read model `defectDetails`, which asks the refusals. | Shotgun Surgery (compiler-guided); locality | Fine for now. If the defect read model ever moves out of `defects.ts` (its own file next to the store), the cycle is gone and the command can become a field of its description. Candidate for the next `/improve-codebase-architecture` round, not this branch. |
| 9 | minor | Design | `src/app/(team)/team/defects/[defectId]/defect-details.tsx:111-145` | The page still picks a one-tap action with a nested ternary over `"claim"` / `"release"` / `"resume"`, each with its own bound Server Action prop. The new registry already knows which actions have no `form`, but the page does not use that. This predates the branch, and the candidate keeps the form folders and actions as they are. | Repeated Switch | Leave as is (out of this candidate's scope). Note it for the next architecture round if a fourth one-tap action appears. |
| 10 | minor | Test quality | `src/app/(team)/team/defects/[defectId]/defect-action-pages.test.ts:8-25` | Sound tests. The folder check is a structural guard: a renamed folder fails here, not only in the browser. The round trip goes through real URL parsing, and the negative cases (unknown, array, undefined) use independent literals. Neither is tautological. The runner `defectFormAction` has no test at its own seam, and its redirect is covered only by the browser tests (claim, log-work, resolve). That is the same as before, when 10 copies had none either. This test file is not in the seam catalog. | tdd: tests at agreed seams; seam catalog | Add the registry test to the seam catalog row of the defect page (or a row of its own). No further test needed. |

**Verdict: ready to merge** (no blockers, no majors).
Most important: #1. The double cast in `defectFormAction` is safe only for a single-literal `A`. A correlated
mapped type for `defectActionCommands` would remove it. The cast in `lastDefectActionBy` (#2) is sound, but only because of the type check just above it.

## Resolution (main session, 2026-10-18)

1. **Fixed** – no cast: Repair's commands are assigned to a mapped type per action (`commands` in `defect-action.ts`), so indexing by `A` gives `A`'s own command.
2. **Accepted** – the cast sits right under the event-type check it relies on, with a comment; claim and assignment exclude each other by `assignedBy`, so the table order does not decide.
3. **Fixed** – `defectActions` is `readonly`.
4. **Fixed** – the type is `ActionWithFormPage`.
5. **Fixed** – `ConfirmationAbout.changedDetails` is derived from Repair's `LastDefectAction`, which is now used outside Repair.
6. **Accepted** – `CommandError<CommandOf<A>>` does not reduce for a generic `A`: the runner's result was not assignable to it (tried). The state is built from `ErrorOf<A>` the way the runner builds it.
7. **Accepted** – each entry says all three things explicitly; a default would hide which actions confirm with extra data.
8. **Accepted** – for a later round, as the review says.
9. **Accepted** – out of scope (older than this branch).
10. **Fixed** – the registry test is in the seam catalog; the runner stays covered by the browser tests, as before.
