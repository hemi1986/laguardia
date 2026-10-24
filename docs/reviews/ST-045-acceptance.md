# Acceptance – ST-045: Record a maintenance task for several machines at once
Date: 2026-10-24 · Tests run: `npm test -- -t "ST-045"` → 8 passed (2 files); `npx playwright test e2e/due-maintenance.spec.ts` → 3 passed; `check-scenarios.ts ST-045` → 6/6 covered · Preview: none (checked locally)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Helper records a maintenance task for several machines | due-maintenance.integration.test.ts | Given: three due machines, listed as due first. When: through the form runner as Anna with three `machineId` values. Then: one record per machine with task, outcome `done`, `recordedBy` Anna; not due anymore; list at the action's address shows "an 3 Geräten eingetragen." (and not to another team member). | pass |
| Due machines are preselected, all applicable machines can be selected | same | Pinball/arcade, due vs. not due set up with fixed date. Rendered selection: LG-042 `checked`, LG-045 offered unchecked under "Weitere Geräte", arcade machine absent (id and number). | pass |
| Machines that are not due can be included | same | Records via the form for a due and a not-due machine, back-dated 2026-06-08; both records have that date; interval counted from it (not due 07-07, due 07-08). | pass |
| A machine that fails a rule does not stop the others | same | Real `retireMachineCommand` before the action. Two records stored, none for LG-044; list shows "an 2 Geräten", then the line "LG-044 nicht eingetragen: Dieses Gerät ist ausgemustert", in that order. | pass |
| Nothing selected is rejected | same | Posted without machines: state `nothing-chosen`, values kept, no record, text "Bitte mindestens ein Gerät auswählen." Also covered in the browser without JavaScript. | pass |
| Helpers cannot record several machines for a task not suitable for helpers | same | Anna posts for two machines (even with a forged `role` field): error `maintenance-not-suitable-for-helpers`, no records. Page shows the reason, helper's list has no link, technician's list has it. | pass |

Runner step (once per item, own transaction) has its own tests in `form-runner.integration.test.ts`; e2e without JavaScript covers rejection and a two-machine record on the real page.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts `pageWidth <= 360` on the selection page; native checkboxes, `overflow-wrap:anywhere` | OK (selection with many machines not seen on a device) |
| List pages fast with realistic data | partly | selection loads machines once from Collection and filters in memory; recording runs one transaction per machine sequentially (a hall of ~50 machines = 50 transactions) | OK, see remark |
| Every command writes its journal entry | yes | each machine goes through `executeCommand` with `CMD-RecordMaintenance` (the existing ST-044 journaling); not separately asserted in the ST-045 tests | OK (relied on ST-044) |
| Texts from message catalogs | yes | `recordForSeveral` in `messages/team/maintenance.ts`, `nothing-chosen` in `shared.ts` | OK |
| No personal data in logs | yes | no logging added | OK |
| Advisories | n/a | no dependency change | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Task with no due machine, e.g. due-list view empty: the "Für mehrere Geräte erfassen" link is only shown on a due task (`chosen.machines.some(recordOffered)`); a task with nothing due cannot be started from the list (e2e opens the address directly) | Story: "A maintenance task's view of the due list offers it" – the due list shows only due tasks, so consistent; Scenario "Machines that are not due can be included" is reachable once at least one machine is due | question: accepted as is? |
| Machine retired/Not on display between opening the page and sending | Story Context + scenario 4 (retired covered). "Not on display" is allowed for maintenance (HS-13 area), not tested here | no action |
| Task removed or a machine unknown meanwhile | rejection through the command's errors; with a mix of reasons each line is shown, with a shared reason once | fine |
| Duplicate/forged machine ids in the post | runner deduplicates ids; command rejects unknown machine | fine |
| Very many machines: 50 sequential transactions in one request | none | question; no action now |
| Address carries `recorded`/`notRecorded` ids: the confirmation shows only the viewer's own records; a hand-edited address cannot show others' records | G3 | fine (tested) |
| English visitor pages | team area is German only | n/a |
| Records confirmed list count `an 1 Gerät` when only one of several succeeded: wording singular handled | story text | fine |

Remarks (none block): the journal entry per machine is not asserted in the ST-045 tests (relies on ST-044 and the shared command executor). No follow-up story needed under the hurdle.

## Verdict
accepted
