---
id: ST-039
title: Retire a machine, closing its open defects and problem reports
type: story
context: BC-Collection
priority: should
size: null
risk: null
events: [EVT-MachineRetired, EVT-DefectClosedOnRetirement, EVT-ProblemReportDismissed]
depends_on: [ST-012, ST-020, ST-024, ST-027, ST-030]
labels: [mvp, collection]
status: review
---

## Story
As a technician, I want to retire a machine that leaves the museum with a reason, so that it disappears from the active lists while its history is kept and nothing about it stays open by mistake.

## Context
Command `CMD-RetireMachine` (technicians only). Rules and invariants:
- The machine is not retired yet; a reason is required.
- A retired machine stays retired; it cannot change status, be moved or corrected; no problem reports, no reopening, no maintenance records.
- Its museum number stays reserved forever (HS-17, HS-19).
- Its visitor machine page only says that the machine is no longer in the museum – no machine status, no defects, no reporting.
- It leaves the machine overview, but team members find it with a "show retired machines" filter there; searching by museum number also finds retired machines.
Automatic policies, in the same transaction (`docs/adr/0002-modular-monolith-state-based-persistence.md`):
- `POL-RetirementClosesDefects` → `CMD-CloseDefectOnRetirement` for every defect of the machine that is not resolved. *Closed on retirement* is final and does not count as resolved.
- `POL-RetirementDismissesProblemReports` → `CMD-DismissProblemReport` for every untriaged problem report of the machine, reason "machine retired".
UI wording (de): Ausgemustert; Geschlossen (ausgemustert).

## Acceptance Criteria

Scenario: Technician retires a machine
  Given the machine "LG-013" is Out of order
  When a technician retires it with the reason "Sold to a collector"
  Then "LG-013" is retired with that reason, the technician and the time
  And it is no longer listed in the machine overview
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

Scenario: A reason is required
  When a technician retires "LG-013" without a reason
  Then "LG-013" is not retired
  And none of its defects or problem reports changes

Scenario: A retired machine cannot be retired again
  Given "LG-013" is retired
  When a technician tries to retire it again
  Then the action is rejected

Scenario: Visitor machine page of a retired machine
  Given "LG-013" is retired
  When a visitor opens the visitor machine page of "LG-013", e.g. via its old QR sticker
  Then the visitor machine page says in the visitor's language that the machine is no longer in the museum
  And it shows neither machine status nor defects
  And reporting a problem is not offered

Scenario: Team members find retired machines
  Given "LG-013" is retired
  When a team member turns on the filter "show retired machines" in the machine overview
  Then "LG-013" is listed and marked as retired

Scenario: Search by museum number finds retired machines
  Given "LG-013" is retired
  When a team member searches the machine overview for "013"
  Then "LG-013" is found and marked as retired

Scenario: Helpers cannot retire machines
  Given a helper is logged in
  When the helper tries to retire a machine
  Then the action is rejected

## Out of Scope
- Undoing a retirement
- Loans, sale prices, provenance (non-goals)

## Open Questions
- none
