---
id: ST-026
title: Assign a defect and release claims
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-DefectClaimed, EVT-DefectClaimReleased]
depends_on: [ST-025]
labels: [mvp, defect-work, ui]
status: ready
---

## Story
As a technician, I want to assign a defect to a team member and release claims that nobody works on anymore, so that work is distributed and stale claims don't block others.

## Context
Commands `CMD-ClaimDefect` (technicians may assign a defect to any team member) and `CMD-ReleaseClaim`. Rules and invariants:
- The defect is not resolved (and not closed on retirement).
- Helpers can only be assigned defects suitable for helpers.
- Team members release their own claim; technicians release any claim.
- Stale claims are only highlighted (ST-048), never released automatically.

## Acceptance Criteria

Scenario: Technician assigns a defect to a helper
  Given the open defect "Rubber cracked" is suitable for helpers and not claimed
  When the technician Tom assigns it to the helper Anna
  Then "Rubber cracked" is claimed by Anna, assigned by Tom

Scenario: Helpers cannot be assigned defects not suitable for helpers
  Given the open defect "Display flickers" is not suitable for helpers
  When a technician tries to assign it to the helper Anna
  Then the action is rejected

Scenario: Helpers cannot assign defects to others
  Given the helper Anna is logged in
  When Anna tries to assign "Rubber cracked" to the helper Ben
  Then the action is rejected

Scenario: Team member releases their own claim
  Given "Rubber cracked" is claimed by Anna
  When Anna releases her claim
  Then "Rubber cracked" is not claimed

Scenario: Helpers cannot release someone else's claim
  Given "Left flipper weak" is claimed by Tom
  When the helper Anna tries to release that claim
  Then the release is rejected
  And "Left flipper weak" stays claimed by Tom

Scenario: Technician releases any claim
  Given "Rubber cracked" is claimed by Anna
  When the technician Eva releases that claim
  Then "Rubber cracked" is not claimed

## Out of Scope
- Highlighting claims older than 14 days without a work log entry (ST-048)

## Open Questions
- none
