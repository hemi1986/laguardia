---
id: ST-039
title: Retire a machine, closing its open defects and problem reports
type: story
context: BC-Collection
priority: should
size: M
risk: high
events: [EVT-MachineRetired, EVT-DefectClosedOnRetirement, EVT-ProblemReportDismissed]
depends_on: [ST-012, ST-020, ST-024, ST-027, ST-029, ST-030, ST-033]
labels: [mvp, collection, ui]
status: ready
---

## Story
As a technician, I want to retire a machine that leaves the museum with a reason, so that nothing about it stays open by mistake while its history is kept.

## Context
Command `CMD-RetireMachine` (technicians only). Rules and invariants:
- The machine is not retired yet; a reason is required.
- A retired machine stays retired; it cannot change status, be moved or corrected; no problem reports, no reopening, no maintenance records.
- Its museum number stays reserved forever (HS-17, HS-19).
Automatic policies, in the same transaction, acting as the *system* actor (`docs/adr/0002-modular-monolith-state-based-persistence.md`, ST-003):
- `POL-RetirementClosesDefects` → `CMD-CloseDefectOnRetirement` for every defect of the machine that is not resolved. *Closed on retirement* is final and does not count as resolved.
- `POL-RetirementDismissesProblemReports` → `CMD-DismissProblemReport` for every untriaged problem report of the machine, reason "machine retired".
Concurrency: a problem report, defect or maintenance record created at the same moment as the retirement is either rejected (because the machine is already retired) or closed/dismissed by the retirement – nothing stays open on a retired machine.
How retired machines appear in the views follows in ST-055.
Repair history (ST-033): a defect closed on retirement is shown there as *closed on retirement*, not as resolved – moved here from ST-033 by the backlog grooming of 2026-10-11 (user, 2026-10-12), so that ST-033 does not wait for this story.
UI wording (de): Ausgemustert; Geschlossen (ausgemustert).
That a retired machine cannot be moved is tested in ST-034 (backlog grooming 2026-10-11/2026-10-17), not here.

Status display (user, 2026-10-17, backlog grooming section 9 item 3): the machine record of a retired machine shows „Ausgemustert“ in place of the machine status, under the retirement note of section 1 (ST-009). Retirement is not an entry of the status history; the status history stays as it was.

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G10, G18, G21):
- Section 9 of the machine record (owner ST-009, G18) offers „Gerät ausmustern“ to technicians only (G11).
- It leads to the page „LG-013 ausmustern“ with the field „Grund“; sending it does not retire the machine yet – it leads to the question page, which asks once (G10).
- The question page says what will happen and what nobody sees on this screen: „LG-013 ausmustern? 1 offener Defekt wird geschlossen, 2 Meldungen werden verworfen. Das lässt sich nicht rückgängig machen.“ A part with zero is left out. Buttons „Endgültig ausmustern“ / „Zurück“; „Zurück“ retires nothing.
- Afterwards the technician lands on the machine record with the confirmation „LG-013 ist ausgemustert.“

## Acceptance Criteria

Scenario: Technician retires a machine
  Given the machine "LG-013" is Out of order
  When a technician retires it with the reason "Sold to a collector"
  Then "LG-013" is retired with that reason, the technician and the time
  And its machine record with its full history can still be opened

Scenario: Open defects are closed on retirement
  Given "LG-013" has the open defect "Display dead" (on hold, claimed by Tom) and the resolved defect "Coin mech jammed"
  When a technician retires "LG-013"
  Then "Display dead" is closed on retirement and no longer listed in the open defects list
  And "Display dead" does not count as resolved
  And "Coin mech jammed" stays resolved

Scenario: Untriaged problem reports are dismissed
  Given "LG-013" has an untriaged problem report
  When a technician retires "LG-013"
  Then the problem report is dismissed with the reason "machine retired"
  And it no longer appears in the triage list

Scenario: Defects closed on retirement are final
  Given the defect "Display dead" was closed on retirement
  When a team member tries to reopen, claim, prioritize or log work on it
  Then the action is rejected

Scenario: Defects closed on retirement are shown as such in the repair history
  Given the retired machine "LG-013" had the defect "Display dead" closed on retirement
  When a team member opens the repair history of "LG-013"
  Then "Display dead" is shown as closed on retirement, not as resolved

Scenario: Actions on a retired machine are rejected
  Given "LG-013" is retired
  When a team member tries to report a problem, change the machine status or record maintenance for "LG-013"
  Then the action is rejected

Scenario: Retiring asks once and names what it closes
  Given "LG-013" has 1 open defect and 2 untriaged problem reports
  When a technician enters the reason "Sold to a collector" to retire "LG-013"
  Then the technician is asked once whether to retire "LG-013"
  And the question says that 1 open defect will be closed and 2 problem reports dismissed, and that this cannot be undone
  And "LG-013" is not retired until the technician confirms

Scenario: Going back from the question retires nothing
  Given a technician is asked whether to retire "LG-013"
  When the technician goes back
  Then "LG-013" is not retired
  And none of its defects or problem reports changes

Scenario: The machine record of a retired machine shows "retired" in place of the status
  Given "LG-013" was Out of order when it was retired
  When a team member opens the machine record of "LG-013"
  Then it shows retired in place of the machine status
  And its status history still ends with the change to Out of order

Scenario: Problem report at the moment of retirement
  Given a visitor submits a problem report for "LG-013" at the same moment as a technician retires "LG-013"
  When both are processed
  Then the problem report is either rejected or dismissed with the reason "machine retired"
  And "LG-013" has no untriaged problem report

Scenario: A reason is required
  When a technician retires "LG-013" without a reason
  Then "LG-013" is not retired
  And none of its defects or problem reports changes

Scenario: A retired machine cannot be retired again
  Given "LG-013" is retired
  When a technician tries to retire it again
  Then the action is rejected

Scenario: Helpers cannot retire machines
  Given a helper is logged in
  When the helper tries to retire a machine
  Then the action is rejected

## Out of Scope
- Retired machines in the views (ST-055)
- Undoing a retirement
- Loans, sale prices, provenance (non-goals)

## Open Questions
- none

## Notes
- **Before implementation an ADR is needed** (lead dev, backlog grooming 2026-10-17, sections 4 and 6): (1) how a Collection event (`EVT-MachineRetired`) triggers Repair commands (`CMD-CloseDefectOnRetirement`, `CMD-DismissProblemReport`) in the same transaction without a module cycle – Repair already reads Collection; (2) how the machine is locked against a concurrent problem report, defect or maintenance record while it is being retired (the concurrency rule above). The ADR input is collected in `docs/stories/OPEN_QUESTIONS.md`. The story stays `ready`: the behaviour is decided, only the technical way is not.
