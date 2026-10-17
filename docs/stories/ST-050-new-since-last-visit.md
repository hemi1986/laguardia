---
id: ST-050
title: Dashboards mark what is new since the last visit
type: story
context: BC-Repair
priority: should
size: L
risk: high
events: [EVT-ProblemReported, EVT-DefectRecorded, EVT-MachineStatusChanged, EVT-DefectClaimed, EVT-DefectClaimReleased, EVT-WorkLogged, EVT-DefectResolved, EVT-DefectReopened, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue, EVT-MaintenanceRecorded]
depends_on: [ST-058, ST-086, ST-087]
labels: [dashboard, ui]
status: ready
---

## Story
As a team member, I want my dashboard to mark everything that is new since my previous dashboard visit, so that I notice changes without e-mail or push notifications even though I stay logged in on my phone for weeks.

## Context
`RM-TechnicianDashboard`, `RM-HelperDashboard`: "New since last visit". HS-21: "new" is measured since the viewer's **Last visit** (`CONTEXT.md`) – the previous time they opened their dashboard, recorded by the Team area – because sessions are long-lived (`docs/adr/0004-team-authentication.md`). The event journal is the source for what changed (`docs/adr/0002-modular-monolith-state-based-persistence.md`).
No e-mail or push notifications (`docs/product/vision.md`, Non-Goals).
- The "previous visit" is the dashboard visit before the current page load; it is one value per team member, shared across all their phones, tablets and the workshop PC. A prefetch of the dashboard and a re-render after an action taken on it are not visits.
- A team member's own actions are never marked as new.
- On the very first dashboard visit nothing is marked as new.
- From this story on, the technician dashboard (ST-058) also shows status changes and resolved or reopened defects since the previous visit, if that is longer ago than 7 days.
- **How a visit is recorded is answered by the spike ST-087 first** (backlog grooming 2026-10-17, section 9 item 3): written naively on page render, the previous visit is overwritten by prefetch and Server Action re-renders.

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G6a, G18): this story adds no section (G18). An entry that is new carries the marker „neu seit deinem letzten Besuch“ next to it (G6a). Where a section gives a count instead of entries – the technician dashboard's section 1 (ST-048) – the count says how many of them are new („1 davon neu …“).

The dashboards read the event journal through the event catalogue per module (architecture review 2026-09-27, Q4 and Q15). The journal mappings are converted to the catalogue as a refactoring on its own branch before ST-086 (ST-079's text; backlog grooming 2026-10-17), and ST-086 is the first story that reads the journal typed.

## Acceptance Criteria

Scenario: The triage section says how many waiting problem reports are new
  Given the technician Tom last opened his dashboard yesterday at 18:00
  And 3 problem reports wait for triage, one of them reported by a visitor for "LG-042" today at 10:00
  When Tom opens his dashboard today
  Then the section of problem reports to triage says that 1 of the 3 is new since his last visit

Scenario: The mark disappears after the visit
  Given Tom opened his dashboard today at 12:00 and the problem report for "LG-042" was counted as new
  And nothing changed since
  When Tom opens his dashboard again at 12:30
  Then no problem report is counted as new

Scenario: Staying logged in does not hide changes
  Given the helper Anna has been logged in on her phone for 30 days
  And she last opened her dashboard 3 days ago
  And her claimed defect "Rubber cracked" was taken over by Ben 2 days ago
  When Anna opens her dashboard
  Then the takeover of "Rubber cracked" is marked as new since her last visit

Scenario: The previous visit is shared across phone and workshop PC
  Given Tom opened his dashboard on the workshop PC at 12:00
  And a problem report was recorded at 11:00
  When Tom opens his dashboard on his phone at 12:30
  Then the problem report of 11:00 is not counted as new

Scenario: Own actions are not marked
  Given Tom resolved "Left flipper weak" after his last dashboard visit
  When Tom opens his dashboard
  Then the resolution of "Left flipper weak" is shown but not marked as new

Scenario: Nothing is marked on the first visit
  Given the helper Ben has never opened his dashboard
  And several defects suitable for helpers were recorded this week
  When Ben opens his dashboard for the first time
  Then the defects are shown
  But nothing is marked as new

Scenario: An action on the dashboard does not end the visit
  Given Tom last opened his dashboard yesterday at 18:00 and a machine status change of today is marked as new
  When Tom returns a machine to play from his dashboard and the dashboard is shown again
  Then the machine status change of today is still marked as new

Scenario: Technician dashboard reaches back to the previous visit
  Given the technician Eva last opened her dashboard 12 days ago
  And a machine status change happened 10 days ago
  When Eva opens her dashboard
  Then that machine status change is shown and marked as new

Scenario: No notifications are sent
  When a problem report is recorded
  Then no e-mail or push notification is sent to any team member

## Out of Scope
- E-mail and push notifications (non-goal)
- The event catalogue per module, the typed `journalOf` and its `verify.ts` check (the refactoring before ST-086)
- How a visit is recorded technically (spike ST-087)

## Open Questions
- none
