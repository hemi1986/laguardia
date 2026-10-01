---
id: ST-039
title: Retire a machine, closing its open defects and problem reports
type: story
context: BC-Collection
priority: must
size: M
risk: medium
events: [EVT-MachineRetired, EVT-DefectClosedOnRetirement, EVT-ProblemReportDismissed]
depends_on: [ST-012, ST-020, ST-024, ST-027, ST-030]
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
UI wording (de): Ausgemustert; Geschlossen (ausgemustert).

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

Scenario: Actions on a retired machine are rejected
  Given "LG-013" is retired
  When a team member tries to report a problem, change the machine status, move it or record maintenance for "LG-013"
  Then the action is rejected

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
