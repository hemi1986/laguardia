---
id: ST-030
title: Reopen a resolved defect, also by linking a problem report
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-DefectReopened, EVT-ProblemReportLinkedToDefect, EVT-MachineStatusChanged]
depends_on: [ST-022, ST-028]
labels: [mvp, defect-work, triage]
status: review
---

## Story
As a team member, I want to reopen a resolved defect when the fault comes back – or have it reopened when a technician links a new problem report to it – so that recurring faults stay visible with their full history instead of starting from scratch.

## Context
Command `CMD-ReopenDefect` (any team member, HS-7). Rules and invariants:
- The defect is resolved and its machine is not retired. A defect closed on retirement is final and cannot be reopened.
- A reason is required.
- A reopened defect is open, not on hold and unclaimed.
- No time limit; guideline: the same fault months later becomes a new defect (HS-7).
Automatic policy `POL-LinkReopensResolvedDefect`: linking a problem report to a resolved defect reopens it, with the linked problem report as reason. The triage list therefore offers the machine's open **and recently resolved** defects for linking (`RM-TriageList`); "recently resolved" means resolved within the last 30 days.
Manual policy `POL-DefectMayChangeMachineStatus`: when a technician reopens a defect (directly or by linking), the technician may set the machine to *Limited* or *Out of order* in the same step.

## Acceptance Criteria

Scenario: Team member reopens a resolved defect
  Given the defect "Left flipper weak" of "LG-042" was resolved yesterday
  When the helper Anna reopens it with the reason "Flipper weak again after an hour of play"
  Then "Left flipper weak" is open, not on hold and not claimed
  And it appears again in the open defects list and on the visitor machine page of "LG-042"
  And the earlier resolution with its closing note and the reopen reason are kept

Scenario: Recently resolved defects are offered for linking
  Given the defect "Left flipper weak" of "LG-042" was resolved 3 days ago
  And a problem report for "LG-042" is untriaged
  When a technician looks at that problem report in the triage list
  Then "Left flipper weak" is offered for linking as a resolved defect

Scenario: Defects resolved longer ago are not offered for linking
  Given the defect "Coin door jammed" of "LG-042" was resolved 31 days ago
  And a problem report for "LG-042" is untriaged
  When a technician looks at that problem report in the triage list
  Then "Coin door jammed" is not offered for linking

Scenario: Linking a problem report to a resolved defect reopens it
  Given the defect "Left flipper weak" of "LG-042" is resolved
  When a technician links an untriaged problem report of "LG-042" to it
  Then the problem report is triaged with the outcome linked
  And "Left flipper weak" is reopened with that problem report as reason

Scenario: Technician changes the machine status while reopening
  Given "LG-042" is Playable and "Left flipper weak" is resolved
  When a technician reopens "Left flipper weak" and sets "LG-042" to Limited in the same step
  Then "Left flipper weak" is open
  And "LG-042" is Limited with a status history entry by that technician

Scenario: A reason is required
  When a team member reopens a resolved defect without a reason
  Then the action is rejected

Scenario: Open defects cannot be reopened
  Given "Display flickers" is open
  When a team member tries to reopen it
  Then the action is rejected

Scenario: No reopening on retired machines
  Given the machine "LG-013" is retired and its defect "Coin mech jammed" was resolved before
  When a team member tries to reopen "Coin mech jammed"
  Then the action is rejected

## Out of Scope
- Defects closed on retirement (ST-039)

## Open Questions
- none
