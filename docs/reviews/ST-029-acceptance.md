# Acceptance – ST-029: Put a defect on hold and resume it
Date: 2026-10-17 · Tests run: `npm test -- -t "ST-029"` → 7 files, 13 passed, 0 failed (681 skipped); `check-scenarios.ts ST-029` → 12/12 covered; the caller reports verify --e2e green (694 tests, 145 browser tests); the e2e spec was read but not rerun · Preview: none (local verification)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Claimant puts a defect on hold | put-defect-on-hold-command.integration.test.ts | Given: defect claimed by helper Anna through the real claim command. When: the command with reason and padded note. Then: reason, trimmed note and time are asserted as literals. The open-defects read model shows the hold. The journal has the reason and no note. | pass |
| Technician puts an unclaimed defect on hold | same | Unclaimed defect, technician, reason waiting-for-technician. Asserts state open, no claim, hold reason. | pass |
| Others cannot put a defect on hold | same | Ben against Anna's claim → `not-claimant`. Hold unchanged and journal length unchanged. | pass |
| A reason is required | same | No reason → `hold-reason-required`. Nothing stored. | pass |
| A defect on hold cannot be put on hold again | same | Second hold → `defect-on-hold`. The first reason is kept. | pass |
| Claimant resumes a defect | resume-defect-command.integration.test.ts | Claim by Anna, hold, then resume by Anna. Asserts open, hold undefined, claim kept, and the `EVT-DefectResumed` journal entry. | pass |
| Only a defect on hold can be resumed | same | Open defect, technician → `defect-not-on-hold`. Journal unchanged. | pass |
| Logging work does not resume | log-work-command.integration.test.ts | Hold with waiting-for-part, then log work with the work-log text. Asserts the entry is added and the hold still has reason waiting-for-part. | pass |
| Resolving ends the hold | resolve-defect-command.integration.test.ts | Hold, then resolve. Asserts resolved and hold undefined. | pass |
| Filter "on hold" | open-defects.integration.test.ts | Two defects, one held. Checks the URL parameter `held=1` → `{onHold:true}`, the loader result `["Display flickers"]`, and the rendered HTML. The HTML has "Pausiert – Wartet auf Ersatzteil", no note and no "Left flipper weak". | pass |
| Filter "on hold" without matches says so | same | No held defect → empty list and the HTML contains "Kein offener Defekt ist pausiert." | pass |
| Machine record shows the on-hold reason | machine-record.integration.test.ts | The section "Offene Defekte" is rendered. The article of "Rubber cracked" contains "Pausiert – Wartet auf Ersatzteil". | pass |

Additional UI evidence: `e2e/defect-on-hold.spec.ts` (technician, 360 px) covers the full flow through the real pages:
- Page title "Defekt pausieren · LG-…".
- Missing reason: alert "Bitte einen Grund wählen.", note kept, `aria-invalid` set.
- Confirmation "„<title>“ ist pausiert – Wartet auf Ersatzteil.", hold in the header with the note, "Pausieren" gone.
- The list entry says the hold.
- "Fortsetzen" is one tap with confirmation "geht weiter.", and "Pausieren" is back.
- Page width ≤ 360 px.

The browser spec only runs locally (needs a technician account); it was not rerun here.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts `pageWidth ≤ 360` on the form and on the defect page after hold. The filter checkbox and the form use the existing mobile patterns. | ok |
| List pages fast with realistic data | yes | The filter is one `isNotNull(holdReason)` predicate in the existing query. The hold columns are on the defect row, with no extra join. | ok |
| Every command writes its journal entry | yes | `EVT-DefectPutOnHold` and `EVT-DefectResumed` are asserted in the journal (actor, type). | ok |
| Texts from the message catalog | yes | All new strings are in `team.de.ts`. Wording matches the story: „Pausieren“, „Defekt pausieren · LG-042“, „Grund“, „Notiz (optional)“, „Fortsetzen“, „Nur pausierte“, „Kein offener Defekt ist pausiert.“, both confirmations. The reasons are in glossary order, the choice has a „Bitte wählen“ placeholder, and there is no default. | ok |
| No personal data in logs | yes | The journal carries only the reason, never the typed note (asserted). | ok |
| Next.js / React advisories | n/a | No dependency change in this diff. | ok |
| Migration | yes | `drizzle/0021_defect_hold.sql` plus snapshot and journal are in the diff. | ok |

Interface lines of the story are met:
- „Pausieren“ is in the work group, after "log-work" and before "resolve".
- „Fortsetzen“ is a one-tap button form in its place, offered only to those the command will not reject (G11).
- The form page shows the refusal in place of the form when the viewer may not hold the defect.

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| A helper who is not the claimant opens `/pausieren` by URL, or the defect is already on hold or resolved. | The page shows the `whyNot` text (G11). The command rejects anyway. | Fine. Optionally add a page test for the refusal view. |
| Two people put the same defect on hold at once, or one resumes while another logs work. | HS-16 version check, as in the sibling commands. | Fine. |
| The claimant releases the claim, or a technician reassigns it, while the defect is on hold. | Not stated. The hold stays, and the previous claimant may no longer resume it. | Question: should a release end the hold? Probably not. Record it in the grooming notes. |
| A resolved defect that is reopened by a new linked problem report: is the hold gone? | Resolving ends the hold, so a reopened defect starts without a hold. | Fine. |
| A long note (the header line prints `· <note>`). | Not stated. Free-text length is deliberately not raised (project decision). | none |
| Machine status "Not on display" or retired with a held defect. | No rule ties the hold to the machine status. | none |
| Visitor view and English. | Hold is team-only and German. No visitor text is added. | none |
| Reminders for long holds. | Out of scope, named in the story. | none |

No finding meets the follow-up hurdle.

## Verdict
accepted with remarks

Remarks, none blocking:
- The release or reassign while on hold behaviour is unspecified (a question).
- The e2e spec is skipped against a deployed `BASE_URL`, so the preview run covers only the integration tests.

## Resolution (main session)
- Remark 1 (releasing or reassigning while on hold): passed to the user as a question – the story does not say it; nothing decided in the code.
- Remark 2: the form page's input is now tested (`put-defect-on-hold-input.test.ts`); the refusal view follows the other form pages.
- Remark 3: the defect page's hold is now also covered by a page test that CI runs (`defect-details.integration.test.ts` › "its hold").
