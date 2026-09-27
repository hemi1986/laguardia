---
id: ST-050
title: Dashboards highlight what is new since the last visit
type: story
context: BC-Repair
priority: should
size: L
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

**Foundation (moved from ST-074 on 2026-09-27).** This is the first page that reads the event journal, so it builds the event catalogue (architecture review 2026-09-27, decisions **Q4** and **Q15**). Until this story, each command maps its own domain events to journal entries (ST-071).
- **Q4 – event catalogue per module** (e.g. `src/modules/repair/events.ts`): for each event type its aggregate, how its machine is found, and an explicit journal projection – only the listed fields reach the journal, and none of them is free text a person typed (rule of 2026-09-27, `OPEN_QUESTIONS.md`, ST-003). Commands return domain events; the command layer maps them to journal entries through the catalogue, replacing the per-command mapping of ST-071 in every command built so far. `journalOf` returns entries typed per event type.
- **Q15 – traceability.** `verify.ts` (domain ID check, `.claude/skills/implement/scripts/check-commands.ts`) also checks that every catalogue event exists in `docs/domain/events.yaml` and belongs to the aggregate the catalogue declares for it.

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

### Foundation (moved from ST-074 on 2026-09-27 – architecture review Q4, Q15)
- [ ] `src/modules/repair/events.ts` lists `EVT-ProblemReported` with its aggregate `AGG-ProblemReport`, its machine and its journal projection; CMD-ReportProblem's journal entry is produced through the catalogue and contains no description (integration test via `journalOf`).
- [ ] Every command built so far maps its events to journal entries through its module's catalogue; no per-command mapping is left under `src/`.
- [ ] A test over all catalogue entries of all modules fails when an event whose catalogue entry says it concerns a machine yields a journal entry without machine reference.
- [ ] `journalOf` returns entries typed per event type: reading a field of `EVT-ProblemReported` that its projection does not list is a type error (type test).
- [ ] `npm run verify` fails when a catalogue event is missing from `docs/domain/events.yaml`, or declares a different aggregate than `events.yaml`; both demonstrated with a deliberate change and then removed.
- [ ] Every behaviour asserted by an existing journal test is still asserted after the conversion; no assertion is dropped (evidence: list old test → new test in the pull request). No test weakened.
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "The event journal" – the event catalogue.

## Out of Scope
- E-mail and push notifications (non-goal)

## Open Questions
- none
