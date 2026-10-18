# Acceptance – ST-030: Reopen a resolved defect, optionally changing the machine status
Date: 2026-10-18 · Tests run: `npm test -- -t "ST-030"` → 11 passed, 0 failed (4 files); `check-scenarios.ts` 9/9 covered; verify.ts --e2e green per caller · Preview: none (checked locally)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Team member reopens a resolved defect | reopen-defect-command.integration.test.ts | Resolved by Tom (claimed first), reopened by helper Anna through the command. Asserts open, hold/claim undefined, open defects list, visitor titles, earlier resolution kept with literal closing note, reopening with trimmed reason. Weakness: "resolved yesterday" is not modelled (fixed clocks, no assertion on it); irrelevant to the rule. | pass |
| The page of a reopened defect says why it is open again | defect-details.integration.test.ts | Real loader plus view render. "Anna reopened it today" with literal reason, closing note still shown and ordered before the reason. | pass |
| Technician changes the machine status while reopening | reopen-defect-command.integration.test.ts | Real command with machineStatus; machine Limited, status history previous playable, reason "Left flipper weak", changedBy Tom. Also covered by the page confirmation test and the e2e. | pass |
| Helpers cannot change the machine status while reopening | reopen-defect.integration.test.ts | Page data and form rendered for Anna (no `name="machineStatus"`) and Tom (offered, "Status nicht ändern"). The command also refuses a helper-chosen status (extra test). | pass |
| A reason is required | reopen-defect-command.integration.test.ts | Blank reason rejected, defect stays resolved. e2e checks the German message and that the chosen status is kept. | pass |
| Open defects cannot be reopened | same | Open defect, rejected "defect-not-resolved". | pass |
| No reopening on retired machines | same | Machine retired after resolve, rejected "machine-retired", defect stays resolved. The form page also shows whyNot. | pass |
| Repair history shows every resolution ... and the reopen reason | repair-history.integration.test.ts | Rendered history page; closing note, "Wieder geöffnet von Anna am ...", reason, order checked. | pass |
| Repair history keeps the order of several resolutions and reopenings | same | Four steps with literal texts; positions asserted ascending. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e checks pageWidth <= 360 on the form and on the defect page | OK |
| List pages fast | no new list | repair history gains one reopenings query | OK |
| Journal entry per command | yes | EVT-DefectReopened asserted in the journal; status change journals via ChangeMachineStatus | OK |
| Texts from message catalogs | yes | team.de.ts (reopen*, error text) | OK |
| No personal data in logs/journal | yes | journal `data` asserted `{}`; reason stays in the aggregate | OK |
| Advisories | n/a | no new dependency | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Two team members reopen the same defect at once | version check (HS-16) rejects the second as conflict | covered by the command layer; no action |
| Reopening a defect whose resolution was "closed on retirement" | Story context: final, cannot be reopened; the machine-retired check covers it | ok |
| Machine status "Out of order" already, technician picks a status | only stricter statuses offered (machine-status-not-stricter tested in unit tests) | ok |
| Machine "Not on display" | no rule in the story | question: is reopening wanted there (probably yes) |
| Very long reason text on a 360 px page | no max length (project decision) | no action |
| Visitor (English) page after reopen | defect returns to the visitor page; asserted via openDefectTitles | ok |
| Helper opens the form URL directly for an open defect | page shows whyNot instead of the form | ok |
| Technician submits a status after the machine changed meanwhile | machineVersion conflict | ok |

No gaps found against the story or the context pack.

**Verdict: accepted**
