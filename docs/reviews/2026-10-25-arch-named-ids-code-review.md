# Code review – architecture review 2026-10-25, candidate 1: one module names what read models return by ID
Base: main · Branch: arch-named-ids · Commits: 1 · Date: 2026-10-25

Refactoring, no story. Reviewed against ADR 0002 (module boundaries, the page composes), the engineering conventions
(`.claude/skills/engineering-conventions/SKILL.md`), `CONTEXT.md` and the tdd / codebase-design skills.
`check-language.ts`: no warning in a changed file.

## Questions from the hand-off, answered

**Every `label()` call site that can now throw.** All are safe:
- The IDs come from read models over `defect`, `problem_report` and `maintenance_record`. Each of those tables has a
  foreign key to `machine` (`drizzle/0010_defect.sql:17`, `0005_machine.sql:43`, `0020_maintenance_record.sql:16`), and
  no code deletes a machine. `machineLabels` doesn't filter on `retired_at`, and the inner join to `machine_model` is
  safe because `machine.machine_model_id` is `NOT NULL` with a foreign key. So a **retired machine** is labelled, and
  the repair history (`repair-history-data.ts`) and the maintenance records (`maintenance-records-data.ts`) of a
  retired machine still render. Both pages are reached through `machineIdOf(…, { retiredToo: true })`.
- **The report pages under `machines/[museumNumber]/melden/`**: the ID is `machine.id` from Collection's own
  `machineForTeamForm`, so it isn't the raw address. An unknown museum number gives `machine === undefined`, and
  `label` is never called. A retired machine is labelled (see above).
- **`triage-confirmation.ts`**: `report.machineId` comes from `problemReportForTriage` (foreign key). The `onMachine`
  value from the address is only compared with it, never labelled.
- The three sites left on `machineLabels` are right to stay there. `due-maintenance-data.ts:133` labels `leftOut`,
  which is machine IDs from the form (filtered by `isId`). `record-maintenance-data.ts:28` labels a machine ID from the
  address. `address-after-recording.ts:19` labels a machine ID from the submitted form. In all three a missing label
  must mean "not found", not a bug.

**Lookups per page.** No page makes more rounds than before. One page makes fewer, and the helper dashboard sends
fewer queries in the same round:
- Helper dashboard: before, one parallel round of 6 queries (two `shownOpenDefects` with 2 each, plus
  `machineLabels` and `teamMemberNames`). Now one round of 2 queries.
- Technician dashboard, open defects list, machine record, defect page, triage list, problem report page, assign form:
  still one round each.
- Repair history and all maintenance records: 2 rounds, as before. The machine label moved from round 1 into the
  names round.
- "Titel und Eignung ändern": 2 rounds became 1. The second `teamMemberNames` for `released` is gone (see finding 5).
- With no IDs, `named` makes no query at all, because both module queries return early.

**Fallbacks in views, and `name: string`.** No view still adds its own fallback for a name. The remaining `?? ""`
are for a missing value, not for an unknown name:
- `melden/page.tsx:50`: no label is loaded for a helper.
- `defect-details.tsx:67`: no assignment.
- The triage pages: no data.

`ShownClaimant.name` and `ShownReporter.name` becoming `string` loses no case. Every former `undefined` was turned
into „unbekannt“ by `claimantName` / `reporterName` / `nameOf` / `who()` / `?? unknownTeamMember` before it reached
the screen. The one exception is finding 2. One more point: `team_member` rows are referenced with `ON DELETE
RESTRICT`, and accounts are deactivated, not deleted (`CONTEXT.md:31`). So „unbekannt“ is a guard that can hardly be
reached, not a path users see.

**Conventions.**
- Relative imports inside `(team)` are kept.
- Only module `index.ts` exports are used (`@/modules/collection`, `@/modules/team`), with no `schema.ts` import.
  This follows ADR 0002, "the page composes".
- The domain language is clean.

## Findings

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Test quality | `src/app/(team)/team/named.integration.test.ts:28` | The expected label is computed with `machineLabels`, the same function `named` calls. This assertion passes by construction. The test title also promises "in one round, each ID once", but nothing in the test checks this. | tdd: tautological assertion. Title not backed by an assertion. | Assert a known literal: register the machine with a known museum number and machine model title, then `toEqual({ museumNumber: "…", machineModelTitle: "…" })`. Either drop "in one round, each ID once" from the title or say what is observable ("names repeated and missing IDs"). |
| 2 | minor | Behaviour | `src/app/(team)/team/triage/[problemReportId]/problem-report-data.ts:43` | `triagedByName` used to be `undefined` for an account that is gone. `triageRejectionText` then fell back to the generic „Diese Meldung ist schon gesichtet.“. Now it is „unbekannt“, so the text reads „unbekannt hat diese Meldung schon gesichtet.“. This is the only visible change of behaviour, and the foreign keys make it practically unreachable. The variable is also still called `names` although it now holds a `Named`. | Hand-off: "behaviour must not change". Smell: Mysterious Name. | Either accept it as the one rule applied (and say so in the PR) or keep the old text. Rename `names` to `shown`, as on the other pages. |
| 3 | minor | Conventions | `.claude/skills/engineering-conventions/SKILL.md:515` | The exception says "a page that shows a choice of machines may still call `machineLabels` itself". Two of the three sites left on `machineLabels` show no choice: `record-maintenance-data.ts` (one machine ID from the address) and `address-after-recording.ts` (one machine ID from the form). The real reason is in the sentence before: the ID isn't a read-model result. | Conventions must describe the code. | Rephrase, e.g. "…a page that labels a machine ID from the address or a form calls `machineLabels` itself and treats a missing label as not found". |
| 4 | minor | Comments | `src/app/(team)/team/machines/[museumNumber]/reparaturhistorie/repair-history-data.ts:12` | The doc comment of `WithName` still says "undefined for an account that is gone", but the type is now `string` („unbekannt“). | Stale comment. | "– „unbekannt“ for an account that is gone (`named`)". |
| 5 | minor | Design | `src/app/(team)/team/defects/[defectId]/titel-und-eignung/change-defect-details-data.ts:28` | The page names `released` from a lookup that only asked for the claimant. This relies on Repair's rule in `claimReleasedByRemovingTheMark` that only the claimant's claim is released. If that rule ever changes, the page silently says „unbekannt“ and no test notices. The comment documents the assumption, which is acceptable. | Coupling to another module's rule (judgement call). | Keep it, or make the assumption explicit in code, e.g. by naming `released` only when it equals `claimant`. |
| 6 | minor | Design | `src/app/(team)/team/machines/[museumNumber]/melden/*/page.tsx` (4 pages) | These pages read the machine from Collection (`machineForTeamForm`) and then make a second Collection read through `named` only to get the machine model title. Neither read crosses a module, so the ID isn't another module's read-model result, which is what the convention describes. The behaviour and the number of rounds are unchanged. | codebase-design: pass-through use of a seam. Smell: Message Chains. | Deepening: `machineForTeamForm` could carry `machineModelTitle`, which removes the extra lookup on four pages. This is outside this refactoring. Otherwise leave as is. |
| 7 | minor | Naming / types | `src/app/(team)/team/helper-dashboard-data.ts:122`, `src/app/(team)/team/named.ts:7,12-14` | (a) The private `withNames` in the helper dashboard has the same name as the exported `withNames` in `triage-list-data.ts:41`, which does something different (labels, names and photos). (b) `MachineLabel` repeats Collection's return type of `machineLabels`, which Collection doesn't export, so there are two structural copies. (c) `Named` declares `name` / `label` in method syntax, yet every caller destructures them (`{ name }`, `.map(shown.label)`). That only works because today's implementation uses arrow functions. | Smell: Mysterious Name, Duplicated Code. codebase-design: the interface includes "may be destructured". | (a) Name it after what it does, e.g. `changeWithNames`. (b) Export `MachineLabel` from Collection's `index.ts` and reuse it. (c) Declare them as function properties (`name: (teamMemberId: string) => string`) so the interface promises that they can be detached. |

No blocker, no major. Nothing passes the follow-up hurdle: there is no security or data-loss risk and no blocked
story, so every finding stays in this PR or as a line here.

**Verdict: ready to merge**
Most important finding: #1, the only test of the new module checks the label against the function it wraps, so a
broken `label()` that returned the right shape would still pass.

## Resolutions (2026-10-25)

| # | Resolution |
|---|---|
| 1 | Fixed: the test registers its own machine model (known title) and takes the museum number from the registration's result; the title says what it checks (several parts, repeated and missing IDs). |
| 2 | Accepted as the one rule: an account that is gone reads „unbekannt“ in the rejection too (practically unreachable – accounts are deactivated, never deleted). Variable renamed to `shown`. |
| 3 | Fixed: the conventions say an ID from the address or a form is labelled with `machineLabels` by the page, where a missing machine is a case to show. |
| 4 | Fixed. |
| 5 | Kept – the code comment documents the assumption. |
| 6 | Skipped: unchanged behaviour and rounds; letting `machineForTeamForm` carry the title is outside this refactoring. |
| 7 | Fixed: (a) `changeWithNames`, (b) `MachineLabel` exported by Collection and reused, (c) function properties. |
