---
id: ST-025
title: Claim or take over a defect
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-DefectClaimed]
depends_on: [ST-021]
labels: [mvp, defect-work]
status: review
---

## Story
As a team member, I want to claim a defect or take it over from someone else, so that everyone sees who is working on it and nobody does the same work twice.

## Context
Command `CMD-ClaimDefect` (any team member). Rules and invariants:
- The defect is not resolved (and not closed on retirement).
- A defect has at most one claimant. Claiming a defect claimed by someone else takes it over – allowed for everyone.
- Helpers can only claim defects suitable for helpers.
- A claim is only a signal: others may still log work (HS-8).
The open defects list shows "claimed by" and gets the filter "claimed by me".

## Acceptance Criteria

Scenario: Team member claims an unclaimed defect
  Given the open defect "Left flipper weak" is not claimed
  When the technician Tom claims it
  Then "Left flipper weak" is claimed by Tom
  And the open defects list shows Tom as claimant

Scenario: Taking over a claimed defect
  Given the defect "Rubber cracked" is suitable for helpers and claimed by Tom
  When the helper Anna claims it
  Then "Rubber cracked" is claimed by Anna
  And Tom is no longer its claimant

Scenario: Helpers can only claim defects suitable for helpers
  Given the open defect "Display flickers" is not suitable for helpers
  When the helper Anna tries to claim it
  Then the claim is rejected
  And "Display flickers" keeps its claimant, if any

Scenario: Resolved defects cannot be claimed
  Given the defect "Coin door jammed" is resolved
  When a team member tries to claim it
  Then the claim is rejected

Scenario: Filter "claimed by me"
  Given Anna claimed "Rubber cracked" and Tom claimed "Left flipper weak"
  When Anna filters the open defects list by "claimed by me"
  Then only "Rubber cracked" is listed

## Out of Scope
- Technicians assigning defects to others, releasing claims (ST-026)
- Highlighting stale claims (ST-048)

## Open Questions
- none
