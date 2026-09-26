---
id: ST-028
title: Resolve a defect with a closing note
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-DefectResolved]
depends_on: [ST-025]
labels: [mvp, defect-work]
status: ready
---

## Story
As a team member, I want to resolve a defect with a closing note when it is fixed, so that everyone – visitors included – sees it is done and the repair history says how it ended.

## Context
Command `CMD-ResolveDefect` (any team member, with restrictions). Rules and invariants:
- The defect is not resolved (and not closed on retirement).
- A closing note is required.
- Helpers can only resolve defects suitable for helpers; technicians resolve any defect (HS-8).
- Resolving ends the claim and any hold.
- Resolving does not change the machine status; machines that are *Limited* or *Out of order* without open defects are highlighted for technicians (`POL-ResolvedDefectsReturnMachineToPlay`, ST-048).

## Acceptance Criteria

Scenario: Technician resolves a defect
  Given the open defect "Left flipper weak" of "LG-042" is claimed by Tom
  When Tom resolves it with the closing note "Coil stop replaced, flipper tested for 20 minutes"
  Then "Left flipper weak" is resolved by Tom with that closing note
  And it is no longer claimed
  And it no longer appears in the open defects list or on the visitor machine page of "LG-042"

Scenario: Helper resolves a defect suitable for helpers
  Given the open defect "Rubber cracked" is suitable for helpers
  When the helper Anna resolves it with the closing note "Rubber replaced"
  Then "Rubber cracked" is resolved by Anna

Scenario: Helpers cannot resolve defects not suitable for helpers
  Given the open defect "Display flickers" is not suitable for helpers
  When the helper Anna tries to resolve it
  Then the action is rejected
  And "Display flickers" stays open

Scenario: A closing note is required
  When a technician resolves an open defect without a closing note
  Then the action is rejected

Scenario: A resolved defect cannot be resolved again
  Given the defect "Coin door jammed" is resolved
  When a team member tries to resolve it
  Then the action is rejected

Scenario: Machine status stays unchanged
  Given "LG-042" is Out of order and "Left flipper weak" is its only open defect
  When a technician resolves "Left flipper weak"
  Then "LG-042" is still Out of order

## Out of Scope
- Ending a hold on resolve (ST-029), reopening (ST-030)
- Highlighting machines without open defects (ST-048)

## Open Questions
- none
