---
id: ST-024
title: Log work on a defect
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-WorkLogged]
depends_on: [ST-021]
labels: [mvp, defect-work]
status: review
---

## Story
As a team member, I want to log what I did on a defect and which parts I used, so that the machine gets a traceable repair history and repair knowledge doesn't live only in people's heads.

## Context
Command `CMD-LogWork` (any team member). Rules and invariants:
- The defect is not resolved (and not closed on retirement).
- What was done is required; parts used (free text) is optional; photos are optional (ST-032).
- Any team member may log work, with or without a claim, also on defects not suitable for helpers (HS-8).
- Work log entries are only added, never changed or removed.
The first work log entry counts as the start of repair (HS-9, ST-051). The open defects list shows the last work log entry.

## Acceptance Criteria

Scenario: Team member logs work
  Given the open defect "Left flipper weak" of "LG-042"
  When the technician Tom logs work with "Replaced coil stop and EOS switch" and the parts used "1x coil stop, 1x EOS switch"
  Then the defect has a work log entry by Tom with what was done, parts used and the time
  And the open defects list shows it as the last work log entry of "Left flipper weak"

Scenario: Helper logs work without claim on a defect not suitable for helpers
  Given the open defect "Display flickers" is not suitable for helpers and not claimed
  When the helper Anna logs work with "Reseated the display connector, flicker still there"
  Then the work log entry by Anna is added

Scenario: What was done is required
  When a team member logs work on an open defect without describing what was done
  Then the work log entry is rejected

Scenario: No work on resolved defects
  Given the defect "Coin door jammed" is resolved
  When a team member tries to log work on it
  Then the work log entry is rejected

Scenario: Work log entries cannot be changed
  Given the defect "Left flipper weak" has a work log entry by Tom
  When anyone tries to change or remove that work log entry
  Then the entry stays unchanged

## Out of Scope
- Photos on work log entries (ST-032)
- Repair history on the machine record (ST-033)

## Open Questions
- none
