---
id: ST-049
title: Helper dashboard – sections, landing after login and the empty case
type: story
context: BC-Repair
priority: should
size: S
risk: medium
events: [EVT-DefectRecorded, EVT-DefectClaimed, EVT-DefectResolved, EVT-DefectDetailsChanged, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue]
depends_on: [ST-025, ST-028, ST-043]
labels: [dashboard, ui]
status: ready
---

## Story
As a helper, I want a dashboard with my claimed defects, the open defects suitable for helpers and the due maintenance tasks suitable for helpers, so that I can see right away what I can do today.

## Context
Read model `RM-HelperDashboard`. No active notifications; "new since the last visit" is marked by ST-050.
**Slice A of the split of 2026-10-17** (backlog grooming, `docs/reviews/2026-10-17-backlog-grooming.md`, section 9 item 3): this story builds the page, its sections, the landing after login and the empty case, all read from the current state – **no event journal read**. What changed on the helper's claimed defects (the first typed journal read) is slice B, ST-086.
- **This story is the owner of the helper dashboard page (G18)** and fixes its sections in this order: 1 „Von dir übernommen“ – the open defects the helper claims right now, each with its title and machine, leading to the defect's page (ST-086 adds what changed on them); 2 „Für Helfer:innen geeignet“ – open defects suitable for helpers, each with its title and machine, leading to the defect's page; 3 „Fällige Wartung für Helfer:innen“ – each due maintenance task suitable for helpers with how many machines it is due and overdue on, in words, and a link to „Wartung“. The dashboard never repeats the due maintenance list (G18, G4a).
- **Logging in lands on the dashboard of the person's role** – that page, not a separate start page, is the page after login (user, 2026-10-01); a helper lands here, a technician on the technician dashboard (ST-048). The helper dashboard is the answer to "what can I do right now", the key need of the largest user group (`docs/product/vision.md`). Until this story, helpers keep today's team start page under „Übersicht“ (ST-048).
- "Nothing open" is the good state here, and it still says so in words (G7): with all three sections empty the dashboard says only „Gerade ist nichts für dich offen.“; an empty section next to a filled one says so in a short sentence of its own (ST-048's pattern). The team navigation is already decided (ST-008); this story takes its place in it (G19).

## Acceptance Criteria

Scenario: Helper sees open defects suitable for helpers
  Given "Rubber cracked" is open and suitable for helpers
  And "Display flickers" is open and not suitable for helpers
  When the helper Anna opens the helper dashboard
  Then "Rubber cracked" is listed among the defects suitable for helpers and "Display flickers" is not

Scenario: Helper sees her claimed defects first
  Given Anna claims the open defect "Slingshot switch loose" of "LG-042"
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" of "LG-042" is listed in the first section, as claimed by her

Scenario: Helper sees due maintenance tasks suitable for helpers as counts
  Given "Clean glass (inside & out)" (suitable for helpers) is due on 3 machines and overdue on 1 of them
  And "Check fuses, connectors, boards for burn marks" (not suitable) is due as well
  When Anna opens the helper dashboard
  Then it says that "Clean glass (inside & out)" is due on 3 machines, 1 of them overdue
  And "Check fuses, connectors, boards for burn marks" is not listed
  And the due maintenance list can be opened from there

Scenario: A helper lands on their dashboard after logging in
  Given the helper Anna has an active account
  When Anna logs in
  Then the helper dashboard is shown

Scenario: Nothing is open for a helper
  Given Anna claims no open defect
  And no defect suitable for helpers is open
  And no maintenance task suitable for helpers is due
  When the helper Anna opens the helper dashboard
  Then it says only that nothing is open for her right now

Scenario: An empty section says so next to a filled one
  Given Anna claims no open defect
  And "Rubber cracked" is open and suitable for helpers
  When Anna opens the helper dashboard
  Then the first section says that she has claimed no defect
  And "Rubber cracked" is listed among the defects suitable for helpers

Scenario: Resolved defects leave the dashboard
  Given "Rubber cracked" was resolved
  When Anna opens the helper dashboard
  Then "Rubber cracked" is not listed among open defects suitable for helpers

## Out of Scope
- What changed on the helper's claimed defects, and defects taken over or released (ST-086)
- Marking what is new since the last visit (ST-050)

## Open Questions
- none
