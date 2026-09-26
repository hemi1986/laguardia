---
id: ST-048
title: Technician dashboard
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-ProblemReported, EVT-MachineStatusChanged, EVT-DefectResolved, EVT-DefectReopened, EVT-DefectClaimed, EVT-WorkLogged, EVT-MaintenanceTaskOverdue]
depends_on: [ST-017, ST-026, ST-030, ST-043]
labels: [mvp, dashboard]
status: review
---

## Story
As a technician, I want one dashboard that shows what needs my attention – untriaged problem reports, machine status changes, resolved and reopened defects, overdue maintenance, machines that could return to play and stale claims – so that nothing gets lost without any e-mail or push notifications.

## Context
Read model `RM-TechnicianDashboard` (technicians only). No active notifications (`docs/product/vision.md`); "new since the last visit" is highlighted by ST-050.
- Untriaged problem reports; those waiting longer than 3 days highlighted (HS-2).
- Machine status changes and defects resolved or reopened of the last 7 days – or since the technician's previous dashboard visit, if that is longer ago (last seen, recorded from ST-050 on; until then 7 days).
- Overdue maintenance tasks (rules of ST-043).
- Machines that are *Limited* or *Out of order* without open defects – manual policy `POL-ResolvedDefectsReturnMachineToPlay` (HS-6): the technician decides on *Playable*, no mandatory test play.
- Claims older than 14 days without any work log entry (by anyone) since the claim – only highlighted, never released automatically.
All values are computed when the dashboard is opened (`docs/adr/0002-modular-monolith-state-based-persistence.md`).

## Acceptance Criteria

Scenario: Untriaged problem reports with long waits highlighted
  Given 3 problem reports are untriaged and one of them was reported 4 days ago
  When a technician opens the technician dashboard
  Then it shows 3 untriaged problem reports
  And the one reported 4 days ago is highlighted as waiting longer than 3 days

Scenario: Machines without open defects that are not playable
  Given "LG-042" is Out of order and its last open defect was resolved today
  When a technician opens the technician dashboard
  Then "LG-042" is listed as Out of order without open defects

Scenario: Technician returns a machine to play from the dashboard
  Given "LG-042" is listed as Out of order without open defects
  When the technician sets "LG-042" to Playable with the reason "Repaired and tested"
  Then "LG-042" is Playable
  And it is no longer listed there

Scenario: Stale claims are highlighted
  Given the defect "Display flickers" was claimed by Ben 15 days ago and has no work log entry since the claim
  When a technician opens the technician dashboard
  Then "Display flickers" is listed as a claim older than 14 days without a work log entry
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

Scenario: Helpers cannot open the technician dashboard
  Given a helper is logged in
  When the helper opens the technician dashboard
  Then the technician dashboard is not shown

## Out of Scope
- Highlighting what is new since the last visit (ST-050)

## Open Questions
- none
