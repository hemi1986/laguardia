---
id: ST-018
title: Triage – record a defect, optionally changing the machine status
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-DefectRecorded, EVT-MachineStatusChanged]
depends_on: [ST-012, ST-017]
labels: [mvp, triage]
status: review
---

## Story
As a technician, I want to turn a problem report into a defect with a title, priority and suitable-for-helpers mark – and set the machine to Limited or Out of order in the same step – so that confirmed faults are tracked until they are resolved and the machine status is right immediately.

## Context
Command `CMD-RecordDefect` (technicians only), handled by the problem report (HS-16): in one step it checks the problem report is still untriaged, marks it triaged with the outcome *defect recorded* and creates the defect.
Rules and invariants:
- The problem report has not been triaged yet; if another technician triaged it meanwhile, the command is rejected ("already triaged by X") and nothing is created.
- Title is required and understandable for visitors – it is shown untranslated on the visitor machine page.
- Priority defaults to *normal* (*high*, *normal*, *low*).
- One problem report leads to one defect (HS-4).
- Manual policy `POL-DefectMayChangeMachineStatus` / HS-3: in the same step the technician may set the machine to *Limited* or *Out of order* – two events, one action, one transaction. The status history entry's reason is a reference to the new defect (its title); no extra input is needed.

## Acceptance Criteria

Scenario: Technician records a defect
  Given the visitor problem report "Left flipper barely moves" for "LG-042" is untriaged
  When a technician records a defect from it with the title "Left flipper weak", suitable for helpers not set, and no priority chosen
  Then the defect "Left flipper weak" exists for "LG-042" with the priority normal
  And the problem report is triaged with the outcome defect recorded, referring to that defect
  And the problem report no longer appears in the triage list

Scenario: Visitors see the title of the new defect
  Given the defect "Left flipper weak" was recorded for "LG-042"
  When a visitor opens the visitor machine page of "LG-042"
  Then "Left flipper weak" is shown as an open defect, untranslated
  And the number of untriaged problem reports no longer counts that problem report

Scenario: Machine status is changed in the same step
  Given the machine "LG-042" is Playable
  And a problem report for "LG-042" is untriaged
  When a technician records the defect "Coil burnt, ball not ejected" with the priority high and sets the machine to Out of order in the same step
  Then the defect exists with the priority high
  And "LG-042" is Out of order with a status history entry by that technician
  And the reason of that entry refers to the defect "Coil burnt, ball not ejected"
  And the technician did not have to enter a separate reason

Scenario: Title is required
  When a technician records a defect from an untriaged problem report without a title
  Then nothing is recorded
  And the problem report stays untriaged

Scenario: Two technicians triage the same problem report
  Given Tom recorded a defect from a problem report a moment ago
  When Eva records a defect from the same problem report on her still-open page
  Then Eva's action is rejected with the message that the problem report was already triaged by Tom
  And only Tom's defect exists

Scenario: Helpers cannot record defects
  Given a helper is logged in
  When the helper tries to record a defect from a problem report
  Then the action is rejected

## Out of Scope
- Changing priority or details later (ST-027, ST-031)
- Linking to an existing defect (ST-022)

## Open Questions
- none
