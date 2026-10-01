---
id: ST-049
title: Helper dashboard
type: story
context: BC-Repair
priority: must
size: M
risk: low
events: [EVT-DefectRecorded, EVT-DefectClaimed, EVT-DefectClaimReleased, EVT-WorkLogged, EVT-DefectPrioritized, EVT-DefectPutOnHold, EVT-DefectResumed, EVT-DefectResolved, EVT-DefectReopened, EVT-DefectDetailsChanged, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue]
depends_on: [ST-026, ST-027, ST-029, ST-030, ST-031, ST-043]
labels: [dashboard, ui]
status: ready
---

## Story
As a helper, I want a dashboard with the open defects and due maintenance tasks suitable for helpers and what happened to my claimed defects, so that I can see right away what I can do today.

## Context
Read model `RM-HelperDashboard`. Fields: open defects suitable for helpers, due maintenance tasks suitable for helpers, my claimed defects and what changed on them (incl. taken over). No active notifications; "new since the last visit" is highlighted by ST-050.
- Changes that count on "my claimed defects": work logged by someone else, title or suitable-for-helpers mark changed, priority changed, put on hold or resumed, resolved, and the claim taken over by someone else or released by a technician (also by removing the suitable-for-helpers mark, ST-031).
- A defect that is no longer claimed by the helper (taken over or released) stays listed with that change for 7 days, the same window as on the technician dashboard (ST-058).
- **Logging in lands on the dashboard of the person's role** – that page, not a separate start page, is the page after login (user, 2026-10-01); a helper lands here, a technician on the technician dashboard (ST-048). The helper dashboard is the answer to "what can I do right now", the key need of the largest user group (`docs/product/vision.md`).
- "Nothing open" is the good state here, and it still says so in words (G7). The team navigation is already decided (ST-008); this story takes its place in it (G19).

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

Scenario: Taken-over defects drop off after 7 days
  Given Ben took over Anna's claimed defect "Rubber cracked" 8 days ago
  When Anna opens the helper dashboard
  Then "Rubber cracked" is no longer listed under her claimed defects

Scenario: Helper sees what changed on her claimed defects
  Given Anna claimed "Slingshot switch loose"
  And a technician logged work on it and changed its title since
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" is listed under her claimed defects with the new work log entry and the new title

Scenario: A helper lands on their dashboard after logging in
  Given the helper Anna has an active account
  When Anna logs in
  Then the helper dashboard is shown

Scenario: Nothing is open for a helper
  Given no defect suitable for helpers is open
  And no maintenance task suitable for helpers is due
  And nothing changed on the defects the helper claimed
  When the helper Anna opens the helper dashboard
  Then it says that nothing is open for her right now

Scenario: Resolved defects leave the dashboard
  Given "Rubber cracked" was resolved
  When Anna opens the helper dashboard
  Then "Rubber cracked" is not listed among open defects suitable for helpers

## Out of Scope
- Highlighting what is new since the last visit (ST-050)

## Open Questions
- none
