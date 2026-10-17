# Code review – ST-029: Put a defect on hold and resume it
Base: main · Commits: 10 · Date: 2026-10-17

Scope of the review: `git diff main...HEAD` (commands, decisions, Hold value object, migration 0021, event catalogue,
refusal matrix, open defects filter, machine record, defect page, form page „Defekt pausieren“, catalogue texts, e2e).
`check-language.ts` reports only the seven pre-existing warnings (login/home/rejected) – nothing from this diff; no
"pause/paused/unpause" in English code (the route segment `pausieren` follows the German path convention of
`beheben`, `arbeitsschritt`).

Checked and in order (no finding): both commands via `aggregateCommand` with IDs from `events.yaml`, pure decisions
(clock from the context, no `new Date()`), authorization in `allowedActors` plus the claimant rule in the refusal
function the page also asks (G11), journal projections in `repairEvents` with references and the fixed reason only –
the typed note stays in the aggregate (conventions, *The event journal*), `actionOfEvent` extended so the
confirmation is read from the journal (`lastDefectActionBy`), resolving clears the hold, CHECKs for the Hold value
object and "only an open defect can be on hold", form page via `loadDefectForForm`/`defectForAction`, form on the
runner with `rejectionText`, one-tap „Fortsetzen“ as `DefectButtonForm` with `commandErrorText`, module boundaries
(only `@/modules/repair` index imports), all 12 scenario titles present at the agreed seams.

**The three adjusted page tests** in `defect-details.integration.test.ts` (lines 334, 357, 363, 605): legitimate. They
assert the exact offered list with `toEqual`; a new action that the command allows these viewers must appear there.
The assertions are not loosened – Ben (helper, not the claimant) correctly keeps `["claim", "log-work", "resolve"]`
without `put-on-hold`, which is itself a check of the claimant rule on the page.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Test quality | `src/app/(team)/team/defects/[defectId]/defect-details.integration.test.ts` (no ST-029 block) | The defect page's ST-029 behaviour has no test at the page seam: the header line „Pausiert – Wartet auf Ersatzteil · <note>“, „Fortsetzen“ offered in place of „Pausieren“ (to the claimant and technicians, not to Ben), and the two confirmations („… ist pausiert – Wartet auf Ersatzteil.“ / „… geht weiter.“) gated by `lastDefectActionBy`. Every earlier defect-page story (ST-025…ST-028) has such a `describe` block. The only cover is `e2e/defect-on-hold.spec.ts`, which skips whenever `BASE_URL` is set – so CI never checks it. | Seam catalog ("a page composed from several modules' queries"); story Interface section (G6, G22) | **Fix in this story** (~30 min): add `describe("putting it on hold and resuming it (ST-029)")` next to the ST-027/ST-028 blocks – arrange via `executeCommand`, assert `offered`, the header text and both confirmations, plus "no confirmation for someone who did not do it". |
| 2 | major | Domain rule / migration | `drizzle/0021_defect_hold.sql:7` | `hold_reason` has no value CHECK. `text(…, { enum })` is only a TypeScript type; the precedent on this table and its sibling is a hand-written value CHECK (`defect_priority`, `defect_state` in 0010, `problem_report_triage_dismissal_reason_value` in 0013). `holdOf` trusts the column and the views index `texts.holdReasons[reason]` with it. Once merged, the migration cannot be edited any more. | Conventions *Migrations*; consistency with 0010/0013 | **Fix in this story** (5 min): add `ALTER TABLE "defect" ADD CONSTRAINT "defect_hold_reason" CHECK ("hold_reason" IS NULL OR "hold_reason" IN ('waiting-for-part', 'waiting-for-technician', 'other'));` to 0021 before the merge. |
| 3 | minor | Test quality | `src/app/(team)/team/defects/[defectId]/pausieren/` (no test) | The form page and its input function are not tested at their seam, unlike `prioritaet/prioritize-defect.integration.test.ts` and `beheben/resolve-defect-rejection.integration.test.ts`: `whyNot` in place of the form (Ben, a defect already on hold), and a forged/unknown `reason` going through `putDefectOnHoldInput` → `hold-reason-required` with the note kept. The e2e covers only the empty choice. | Seam catalog ("Server Action runner and its forms – forged fields") | **Fix in this story** if the hour allows (~20 min, `formRunner` + `loadDefectForForm`); otherwise skipped minor – the decision itself also checks `holdReasons.includes`. |
| 4 | minor | Language / catalogue | `src/platform/messages/team.de.ts:575`, `src/modules/repair/put-defect-on-hold.ts:32,52` | The error code `not-claimant` is generic, but its catalogue text is specific to holds („Pausieren und fortsetzen können nur …“). The `commandErrors` section is keyed globally by code, so the next command that refuses a non-claimant with the same code shows the hold sentence. | Smell: Mysterious Name; conventions *UI texts* (codes map 1:1 to texts) | **Fix in this story** (5 min): either make the text action-neutral („Das können nur Techniker:innen und wer den Defekt übernommen hat.“) or name the code after the rule (e.g. `hold-not-yours`). |
| 5 | minor | Language | `src/modules/repair/defect.ts:28`, `src/modules/repair/schema.ts:70` | The data model names the Hold attribute *On hold since*; the code calls it `heldAt` / `held_at` (and the filter parameter `held=1`). Not an `_Avoid_` word, but it drifts from the data model where Claim follows it exactly (*Claimed at* → `claimedAt`). | CONTEXT.md / data-model.md (Hold VO) | **Skipped minor** – renaming means another migration line; revisit only if ST-058/ST-050 (waiting times on read) start using the field and the name confuses. |
| 6 | minor | Design | `src/app/(team)/team/defects/[defectId]/defect-details.tsx:146` | The work group is now a three-level ternary over one-tap actions (`claim` / `release` / `resume` / form-page link), and each one-tap action adds one prop (`claimAction`, `releaseAction`, `resumeAction`) to `DefectDetailsView` and one branch. The form-page side already is a map (`formPages`); the one-tap side is not. | Smell: Repeated Switches; conventions "the two small maps of `defect-details.tsx`" | **Skipped minor** – revisit when the next one-tap action on a defect arrives: a `oneTap` map (action → server action + label + extra `offered` condition) next to `formPages` would make it a one-line change. |
| 7 | minor | Design | `src/app/(team)/team/defects/[defectId]/defect-details.tsx:30-32` | `confirmations` takes one widening parameter object (`assignedTo`, `priority`, now `holdReason`) that every entry receives and most ignore; each parameterised confirmation widens the shared signature. | Smell: Data Clumps / Divergent Change | **Skipped minor** – fold into the deepening of #6 if it happens (pass `details` and let each entry pick what it needs). |
| 8 | minor | Domain rule (next story) | `drizzle/0021_defect_hold.sql:7` (`defect_hold_only_open`) | Correctly enforces "only an open defect can be on hold". Consequence for ST-039 (closing on retirement, its scenario has a defect "on hold, claimed by Tom"): its decision must clear `hold` like `resolveDefect` does, or the save violates the CHECK. ST-030 is safe – a reopened defect was resolved and so has no hold. | AGG-Defect invariants; data model | **Revisit when ST-039** is implemented – no action here; the CHECK will catch an omission in its test. |
| 9 | minor | Scope / design | `src/modules/repair/index.ts:15-19` | `Hold`, `PutDefectOnHoldError`, `ResumeDefectError`, `ResumeDefectInput` are exported but used nowhere outside the module. Consistent with how sibling commands export their types. | Smell: Speculative Generality (mild) | **Skipped minor** – matches the module's existing export pattern. |

No blockers: no ADR violation, every command rule and aggregate invariant of the story is enforced in the decision
(and the open/hold invariant additionally by CHECK), no security issue (team-only pages, CSRF via the runner and
proxy, note rendered escaped by React, no free text in the journal). No finding passes the follow-up hurdle – all
are fixable in this story in well under an hour, and #8 is already covered by ST-039.

ready to merge (after the two majors, which are fixes within this story, not blockers)
Most important: #1 – the defect page's hold header, „Fortsetzen“ in place of „Pausieren“ and both confirmations are guarded only by a local-only browser test; add the page-seam test block like ST-025…ST-028 have.

## Resolution (main session)
- #1 fixed: `defect-details.integration.test.ts` › "its hold (ST-029, G22)" – „Pausieren“ offered, the header says the hold with its note, „Fortsetzen“ in its place, the confirmation only for who did it.
- #2 fixed: `defect_hold_reason_value` CHECK in `drizzle/0021_defect_hold.sql` (not merged yet, so the migration could still change).
- #3 fixed in part: `pausieren/put-defect-on-hold-input.test.ts` (no reason, a forged reason, a bad version); the refusal view of the form page is the same `whyNot` pattern the other form pages test – skipped.
- #4 fixed: `not-claimant` reads „Das dürfen nur Techniker:innen und wer den Defekt übernommen hat.“
- #5, #6, #7, #9 skipped as the review says. #8: revisit when ST-039 is implemented – closing on retirement must clear the hold (`defect_hold_only_open`).
