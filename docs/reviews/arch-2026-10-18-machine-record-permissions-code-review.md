# Code review – arch-machine-record-permissions: the machine record's page data decides what the viewer may do
Base: main · Commits: 1 · Date: 2026-10-23

Refactoring branch from architecture review 2026-10-18, candidate 6 (no story). Checked against G11
(`docs/product/ux-guidelines.md`), the conventions' G11 paragraphs (`.claude/skills/engineering-conventions/SKILL.md`
§ "What a team member can do to a defect" / "… in maintenance"), ADR 0002 (the page composes the modules' public
queries), the glossary, and the old code for behaviour (ST-009/012/015/034/037). `check-language.ts` reports no warning
in the changed files. `tsc --noEmit` and ESLint on the folder are clean. The machine record tests
(`src/app/(team)/team/machines/[museumNumber]`, 8 files, 50 tests) pass.

Correct as built. Behaviour is unchanged.
- **„Problem melden“ (ST-015):** before, it was shown when `!record.retirement`. Now it is shown when
  `actions.reportProblem`, which is `retirement === undefined`. Same.
- **Section 3 (ST-034, ST-012):** before, the whole row was hidden for a retired machine. Inside it, „Standort ändern“
  was always shown and „Status ändern“ was shown when `canChangeStatus`. Now the row is shown when
  `changeLocation || changeStatus`. For a retired machine both are false (`machineStatusesToChangeTo` returns `[]` when
  retired), so the row is still hidden. For an active machine „Standort ändern“ is always shown and „Status ändern“
  follows the same call with the same inputs (`member.role` → `viewer.role`, `retired` from `record.retirement`). No
  empty `<div>` can appear.
- **„Datei anhängen“ (ST-037):** it was shown unconditionally and is now `attachFile: true`, so it still shows on a
  retired machine. That matches the user decision of 2026-10-18, pinned by the test at `:341`.
- **Callers:** `loadMachineRecord` has two callers, `page.tsx` and `machine-record-load.integration.test.ts`. Both
  pass a viewer. Making `viewer` required removed the old silent default, under which `shownOpenDefects` ran without a
  viewer. The view no longer has a `can…` prop, as the conventions want for defects (G11: "no page carries a rule or a
  `can…` flag of its own").
- **"Record maintenance" has no flag, and that is right.** ST-047 (`ready`, not built) offers „Wartung erfassen“ *per
  due maintenance task* ("offered only for 'Clean glass (inside & out)'"). Maintenance's own answer
  (`dueMaintenance(…).recordOffered`, see the conventions' maintenance paragraph) decides it. One boolean on the
  record could not carry it, and the record would have to restate Maintenance's rule. Section 5 does not exist in the
  view yet, so there is nothing to move.
- The reformatted `toMatch` at the test's `:372` is Prettier's fix: main's version of the file fails
  `prettier --check`. It is not an unrelated change by hand.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Test quality | `src/app/(team)/team/machines/[museumNumber]/machine-record.integration.test.ts:206-220` | The new test never shows the role making a difference. Its three assertions are: technician on a playable machine gets the link, helper on a playable machine gets the link, retired machine has no link. If `actionsOf` ignored `viewer.role` (e.g. always asked for `"technician"`), all three would still pass. Only a helper on a machine that is already *Out of order* has nothing to set, and so no „Status ändern“. That case is the reason the viewer is now required and the rule moved here, and it is untested at this seam (the old code had no test for `canChangeStatus` at all). The title promises "only where the viewer has a machine status to set". | tdd: the test must check its "Then" / be able to fail; G11 | Add one case: take LG-042 *Out of order* through `changeMachineStatusCommand` (actor `tom`). Then expect a helper's page `not.toContain("/status")` and a technician's page to still contain `href="/team/machines/LG-042/status"`. Use known-good literals, not `machineStatusesToChangeTo`. |
| 2 | minor | Conventions | `.claude/skills/engineering-conventions/SKILL.md:211-232` | The G11 paragraphs name Repair's answer (`defectDetails(…).actions`, `defectForAction`) and Maintenance's (`recordOffered`, `maintenanceForRecording`). This third precedent is not named: a page data function composed across modules returns `actions`, and the view shows only those. The next story that adds a control to the machine record (ST-047 first) would not find where it goes, or that a per-task offer from another module stays that module's answer. | Conventions as the home of patterns | Add one sentence, e.g.: "On the machine record, `loadMachineRecord(db, museumNumber, { viewer })` returns `actions` (`MachineRecordActions`). The view shows only those and takes no `can…` prop. An offer that another module decides per item (ST-047's „Wartung erfassen“ per due task) comes with that section's data from the module, not as a flag in `actions`." |
| 3 | minor | Design (locality) | `src/app/(team)/team/machines/[museumNumber]/machine-record-data.ts:96-104`; `…/standort/page.tsx:24`, `…/melden/page.tsx:44`, `…/status/page.tsx:19-26` | Only `changeStatus` asks Collection (`machineStatusesToChangeTo`). `reportProblem` and `changeLocation` restate "not for a retired machine" in the app. That rule is the decisions' (`move-machine.ts:33`, the report's `machine-retired`), and each form page restates it a third time (`machine.retired ? texts.retired`). So the rules are "decided once" for the record, not once overall. The defect pattern puts a refusal function next to each decision and has the record and the form page ask it (`defectForAction`). The rule here is a single condition taken from an AGG-Machine invariant (retirement is final), so this is a judgement call, not a defect. | codebase-design: locality; conventions G11 paragraph ("built from the refusal function next to each decision"); Duplicated Code | Accept it as it is: the candidate scope was "only the permissions move from `page.tsx`". Or let Collection export a refusal next to the move decision, which `actionsOf` and `standort/page.tsx` both ask, as `machineStatusesToChangeTo` already does for the status. Not a follow-up: no security or data-loss risk, the commands refuse anyway. |
| 4 | minor | Naming / doc comment | `src/app/(team)/team/machines/[museumNumber]/machine-record-data.ts:28,32-35` | `actions` says "What the viewer may do here – the page offers only these (G11)". Once ST-047 adds „Wartung erfassen“ per due task from Maintenance, the page offers something that is not in `actions`, and the comment becomes wrong in a way that invites a fifth boolean. | Mysterious Name (claim wider than the type) | Narrow the comment: "the machine record's own actions – an offer per item that another module decides comes with that section's data". Or leave it and do this together with #2. |
| 5 | minor | Test quality (Duplicated Code) | `src/app/(team)/team/machines/[museumNumber]/machine-record.integration.test.ts:192-234, 341-352` | The same seven-line "register LG-013, retire it through `retireMachineForTest`, throw if not ok" block now appears four times, three of them in a row in the G11 tests (one copy added by this branch). | Duplicated Code | A local helper `retiredMachine("LG-013")` next to `registered(…)`. It also makes #1's extra setup read as one line. |

**Verdict: ready to merge** (no blockers; fix #1 first, it is a five-minute test).
Most important: #1. The role-dependent case of „Status ändern“ (a helper on an *Out of order* machine sees no link) is
the one thing this refactor moves into the page data, and no test would notice if the role were ignored.

## Resolution (2026-10-23)

- **#1 – fixed.** New test: a helper gets no „Status ändern“ on a machine already out of order, a technician still does. It fails if `actionsOf` ignores the viewer's role.
- **#2 – fixed.** The conventions name the pattern next to the Repair and Maintenance paragraphs.
- **#3 – skipped.** "Not for a retired machine" is also stated by the `standort`/`melden` form pages; moving it behind a Collection refusal function is beyond this candidate. Revisit when ST-039 (retiring a machine) touches these pages.
- **#4 – fixed.** The comment on `actions` says the record's own actions; a section another module decides brings its own offer.
- **#5 – fixed.** `retiredMachine(…)` replaces the five copies of the setup block.
