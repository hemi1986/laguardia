---
id: ST-046
title: Report a finding during maintenance
type: story
context: BC-Maintenance
priority: could
size: XS
risk: low
events: [EVT-MaintenanceRecorded, EVT-ProblemReported]
depends_on: [ST-015, ST-044]
labels: [maintenance, triage]
status: ready
---

## Story
As a helper, I want to report a fault I found while doing maintenance right after recording the maintenance, so that the finding enters triage and does not get lost.

## Context
Manual policy `POL-MaintenanceFindingIsReported`: a fault found during maintenance becomes a problem report through Repair's normal *Report problem* (`docs/domain/context-map.md` – Maintenance has no knowledge of defects). All rules of `CMD-ReportProblem` for team members apply (ST-015). A technician's finding is triaged in the same step (ST-023).
The maintenance record and the problem report are separate: the maintenance record is kept even if no problem report is made.

## Acceptance Criteria

Scenario: Helper reports a finding after recording maintenance
  Given the helper Anna recorded "Check rubbers, replace cracked ones" on "LG-042" as partially done
  When she reports the finding "Slingshot rubber right cracked, no spare in stock" for "LG-042" directly afterwards
  Then a problem report by Anna for "LG-042" with that description exists
  And it appears in the triage list
  And the maintenance record is unchanged

Scenario: The machine is taken over from the maintenance record
  Given Anna recorded maintenance on "LG-042"
  When she chooses to report a finding
  Then the problem report is for "LG-042" without choosing the machine again

Scenario: Description is required
  Given Anna recorded maintenance on "LG-042"
  When she reports a finding without a description
  Then no problem report is stored
  And the maintenance record is kept

## Out of Scope
- Linking the problem report to the maintenance record (not in the model)

## Open Questions
- none
