---
id: ST-027
title: Prioritize a defect
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-DefectPrioritized]
depends_on: [ST-021]
labels: [mvp, defect-work]
status: review
---

## Story
As a technician, I want to change the priority of an open defect, so that the team works on the most urgent defects first.

## Context
Command `CMD-PrioritizeDefect` (technicians only). Rules:
- The defect is not resolved (and not closed on retirement).
- Priority is *high*, *normal* (default at recording) or *low*.
UI wording (de): Priorität (hoch / normal / niedrig).

## Acceptance Criteria

Scenario: Technician raises the priority
  Given the open defect "Display flickers" has the priority normal
  When a technician sets its priority to high
  Then "Display flickers" has the priority high
  And the open defects list shows it among the high-priority defects

Scenario: Filter by priority
  Given "Display flickers" has the priority high and "Rubber cracked" the priority low
  When a team member filters the open defects list by priority high
  Then only "Display flickers" is listed

Scenario: Resolved defects cannot be prioritized
  Given the defect "Coin door jammed" is resolved
  When a technician tries to change its priority
  Then the change is rejected

Scenario: Helpers cannot prioritize
  Given a helper is logged in
  When the helper tries to change the priority of a defect
  Then the change is rejected

## Out of Scope
- Changing title or suitable-for-helpers mark (ST-031)

## Open Questions
- none
