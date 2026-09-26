---
id: ST-049
title: Helper dashboard
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-DefectRecorded, EVT-DefectClaimed, EVT-DefectClaimReleased, EVT-WorkLogged, EVT-DefectResolved, EVT-DefectReopened, EVT-DefectDetailsChanged, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue]
depends_on: [ST-026, ST-030, ST-031, ST-043]
labels: [dashboard]
status: review
---

## Story
As a helper, I want a dashboard with the open defects and due maintenance tasks suitable for helpers and what happened to my claimed defects, so that I can see right away what I can do today.

## Context
Read model `RM-HelperDashboard`. Fields: open defects suitable for helpers, due maintenance tasks suitable for helpers, my claimed defects and what changed on them (incl. taken over). No active notifications; "new since the last visit" is highlighted by ST-050.

## Acceptance Criteria

Scenario: Helper sees open defects suitable for helpers
  Given "Rubber cracked" is open and suitable for helpers and "Display flickers" is open and not suitable for helpers
  When the helper Anna opens the helper dashboard
  Then "Rubber cracked" is listed and "Display flickers" is not

Scenario: Helper sees due maintenance tasks suitable for helpers
  Given "Clean glass (inside & out)" (suitable for helpers) and "Check fuses, connectors, boards for burn marks" (not suitable) are both due
  When Anna opens the helper dashboard
  Then only "Clean glass (inside & out)" is listed, with its due and overdue machines

Scenario: Helper sees that a claimed defect was taken over
  Given Anna claimed "Rubber cracked"
  And the helper Ben has since taken it over
  When Anna opens the helper dashboard
  Then she sees that "Rubber cracked" was taken over by Ben

Scenario: Helper sees what changed on her claimed defects
  Given Anna claimed "Slingshot switch loose"
  And a technician logged work on it and changed its title since
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" is listed under her claimed defects with the new work log entry and the new title

Scenario: Resolved defects leave the dashboard
  Given "Rubber cracked" was resolved
  When Anna opens the helper dashboard
  Then "Rubber cracked" is not listed among open defects suitable for helpers

## Out of Scope
- Highlighting what is new since the last visit (ST-050)

## Open Questions
- none
