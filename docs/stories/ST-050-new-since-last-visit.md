---
id: ST-050
title: Dashboards highlight what is new since the last visit
type: story
context: BC-Repair
priority: should
size: M
risk: medium
events: [EVT-ProblemReported, EVT-DefectRecorded, EVT-MachineStatusChanged, EVT-DefectClaimed, EVT-DefectClaimReleased, EVT-WorkLogged, EVT-DefectResolved, EVT-DefectReopened, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue, EVT-MaintenanceRecorded]
depends_on: [ST-049, ST-058]
labels: [dashboard]
status: ready
---

## Story
As a team member, I want my dashboard to highlight everything that is new since my previous dashboard visit, so that I notice changes without e-mail or push notifications even though I stay logged in on my phone for weeks.

## Context
`RM-TechnicianDashboard`, `RM-HelperDashboard`: "New since last login". HS-21: "new" is measured since the viewer's previous dashboard visit (last seen), recorded by the Team area – because sessions are long-lived (`docs/adr/0004-team-authentication.md`). The event journal is the source for what changed (`docs/adr/0002-modular-monolith-state-based-persistence.md`).
No e-mail or push notifications (`docs/product/vision.md`, Non-Goals).
- The "previous visit" is the dashboard visit before the current page load; it is one value per team member, shared across all their phones, tablets and the workshop PC.
- A team member's own actions are never highlighted as new.
- On the very first dashboard visit nothing is highlighted as new.
- From this story on, the technician dashboard (ST-058) also shows status changes and resolved or reopened defects since the previous visit, if that is longer ago than 7 days.

## Acceptance Criteria

Scenario: Items since the previous visit are highlighted
  Given the technician Tom last opened his dashboard yesterday at 18:00
  And a visitor reported a problem for "LG-042" today at 10:00
  When Tom opens his dashboard today
  Then the problem report for "LG-042" is highlighted as new

Scenario: Highlight disappears after the visit
  Given Tom opened his dashboard today at 12:00 and saw the new problem report for "LG-042" highlighted
  And nothing changed since
  When Tom opens his dashboard again at 12:30
  Then the problem report for "LG-042" is no longer highlighted as new

Scenario: Staying logged in does not hide changes
  Given the helper Anna has been logged in on her phone for 30 days
  And she last opened her dashboard 3 days ago
  And her claimed defect "Rubber cracked" was taken over by Ben 2 days ago
  When Anna opens her dashboard
  Then the takeover of "Rubber cracked" is highlighted as new

Scenario: The previous visit is shared across phone and workshop PC
  Given Tom opened his dashboard on the workshop PC at 12:00
  And a problem report was recorded at 11:00
  When Tom opens his dashboard on his phone at 12:30
  Then the problem report of 11:00 is not highlighted as new

Scenario: Own actions are not highlighted
  Given Tom resolved "Left flipper weak" after his last dashboard visit
  When Tom opens his dashboard
  Then the resolution of "Left flipper weak" is shown but not highlighted as new

Scenario: Nothing is highlighted on the first visit
  Given the helper Ben has never opened his dashboard
  And several defects suitable for helpers were recorded this week
  When Ben opens his dashboard for the first time
  Then the defects are shown
  But nothing is highlighted as new

Scenario: Technician dashboard reaches back to the previous visit
  Given the technician Eva last opened her dashboard 12 days ago
  And a machine status change happened 10 days ago
  When Eva opens her dashboard
  Then that machine status change is shown and highlighted as new

Scenario: No notifications are sent
  When a problem report is recorded
  Then no e-mail or push notification is sent to any team member

## Out of Scope
- E-mail and push notifications (non-goal)

## Open Questions
- none
