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
status: in-progress
---

## Story
As a team member, I want my dashboard to mark everything that is new since my last visit, so that I notice changes without e-mail or push notifications even though I stay logged in on my phone for weeks.

## Context
`RM-TechnicianDashboard`, `RM-HelperDashboard`: "New since last visit". HS-21: "new" is measured since the viewer's **Last visit** (`CONTEXT.md`) – the moment they last opened their dashboard, recorded by the Team area – because sessions are long-lived (`docs/adr/0004-team-authentication.md`). The event journal is the source for what changed (`docs/adr/0002-modular-monolith-state-based-persistence.md`).
No e-mail or push notifications (`docs/product/vision.md`, Non-Goals).
- **One round on the floor is one visit** (user, story review 2026-10-17, decision 2; `docs/reviews/2026-10-17-story-review.md`): the Last visit moves forward only when the dashboard is opened more than one hour after the current visit began. Opening the dashboard again within that hour – after looking at an entry, going back, reloading – belongs to the current visit, and what was marked stays marked. The spike ST-087 reports whether this can be built.
- The Last visit is one value per team member, shared across all their phones, tablets and the workshop PC. A prefetch of the dashboard and a re-render after an action taken on it are not visits.
- A team member's own actions are never marked as new.
- On the very first dashboard visit nothing is marked as new.
- From this story on, the technician dashboard (ST-058) also shows status changes and resolved or reopened defects since the Last visit, if that is longer ago than 7 days.
- **How a visit is recorded is answered by the spike ST-087 first** (backlog grooming 2026-10-17, section 9 item 3): written naively on page render, the Last visit is overwritten by prefetch and Server Action re-renders.

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
  When Tom opens his dashboard again at 13:30
  Then no problem report is counted as new

Scenario: Coming back within the hour keeps the marks
  Given Tom opened his dashboard today at 12:00 and the problem report for "LG-042" was counted as new
  When Tom opens that problem report and comes back to his dashboard at 12:20
  Then the problem report for "LG-042" is still counted as new

Scenario: Staying logged in does not hide changes
  Given the helper Anna has been logged in on her phone for 30 days
  And she last opened her dashboard 3 days ago
  And her claimed defect "Rubber cracked" was taken over by Ben 2 days ago
  When Anna opens her dashboard
  Then the takeover of "Rubber cracked" is marked as new since her last visit

Scenario: The last visit is shared across phone and workshop PC
  Given Tom opened his dashboard on the workshop PC at 12:00
  And a problem report was recorded at 11:00
  When Tom opens his dashboard on his phone at 13:30
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

Scenario: Technician dashboard reaches back to the last visit
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

## Notes
- Revised after the story review of 2026-10-17 (decision 2): one visit lasts while the dashboard is opened again within an hour of its beginning, so "The mark disappears after the visit" and "The last visit is shared across phone and workshop PC" open the dashboard again at 13:30 instead of 12:30, and "Coming back within the hour keeps the marks" was added; "Last visit" (glossary) replaces "previous visit". If ST-087 finds that decision 2 cannot be built, this story goes back to `review`.
- ST-087 (2026-10-24) found that **decision 2 can be built**, so this story stays `ready` (Context and scenarios unchanged). How to record the Last visit is decided in `docs/adr/0011-recording-the-last-visit.md` (`proposed`), confirmed on a production build: record it with a **client `useEffect` → Server Action** in the Team area (never in the page render – prefetch and Server-Action re-renders run the render, measured), as a **per-member versioned row** holding `currentVisitStartedAt` + `lastVisit`, **not journaled** (not a domain fact). The recording is idempotent via the pure rule `decideVisit(stored, now)` (one hour = one round), so reload, a second tab and browser back keep the marks. The dashboards compute their mark line **purely** as `decideVisit(stored, now).lastVisit` (no write), which is prefetch- and re-render-safe; own actions are excluded by actor id, never visited = no stored value.
