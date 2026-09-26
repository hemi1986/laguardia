---
id: ST-058
title: Technician dashboard – recent changes, stale claims and overdue maintenance
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-MachineStatusChanged, EVT-DefectResolved, EVT-DefectReopened, EVT-DefectClaimed, EVT-WorkLogged, EVT-MaintenanceTaskOverdue]
depends_on: [ST-024, ST-026, ST-030, ST-043, ST-048]
labels: [mvp, dashboard]
status: ready
---

## Story
As a technician, I want the technician dashboard to also show recent machine status changes, resolved and reopened defects, stale claims and overdue maintenance, so that I see everything that needs my attention in one place.

## Context
Read model `RM-TechnicianDashboard`, second part of the split of ST-048 (story review 2026-09-26).
- Machine status changes and defects resolved or reopened of the last 7 days – or since the technician's previous dashboard visit, if that is longer ago (the previous visit is recorded from ST-050 on; until then 7 days).
- *Stale claims* (`CONTEXT.md`): claims older than 14 days (more than 336 hours, ST-003) without a work log entry – by anyone – since the claim. Stale claims are only highlighted, never released automatically.
- Overdue maintenance tasks with their machines (rules of ST-043 and ST-056).
All values are computed when the dashboard is opened.
UI wording (de): Liegengeblieben (stale claim).

## Acceptance Criteria

Scenario: Stale claims are highlighted
  Given the defect "Display flickers" was claimed by Ben 15 days ago and has no work log entry since the claim
  When a technician opens the technician dashboard
  Then "Display flickers" is listed as a stale claim of Ben
  And it is still claimed by Ben

Scenario: A work log entry by someone else keeps a claim from being stale
  Given the defect "Display flickers" was claimed by Ben 15 days ago
  And the technician Tom logged work on it 3 days ago
  When a technician opens the technician dashboard
  Then "Display flickers" is not listed as a stale claim

Scenario: Overdue maintenance tasks
  Given "Wax playfield" is overdue on "LG-042" and "LG-043"
  When a technician opens the technician dashboard
  Then the overdue maintenance tasks are listed with their machines

Scenario: Machine status changes and resolved or reopened defects
  Given the helper Anna set "LG-007" to Out of order yesterday
  And the defect "Left flipper weak" was reopened today
  When a technician opens the technician dashboard
  Then the status change of "LG-007" by Anna and the reopened "Left flipper weak" are shown

Scenario: Older changes drop off after 7 days
  Given a machine status change happened 8 days ago
  And the technician visited the dashboard since then
  When the technician opens the technician dashboard
  Then that machine status change is not shown

## Out of Scope
- Highlighting what is new since the last visit (ST-050)

## Open Questions
- none
