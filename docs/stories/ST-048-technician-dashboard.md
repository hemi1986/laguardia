---
id: ST-048
title: Technician dashboard – untriaged problem reports and machines ready to return to play
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-ProblemReported, EVT-DefectResolved, EVT-MachineStatusChanged]
depends_on: [ST-012, ST-017, ST-028]
labels: [mvp, dashboard]
status: ready
---

## Story
As a technician, I want one dashboard that shows the untriaged problem reports and the machines that could return to play, so that nothing gets lost and no machine stays out of order longer than necessary – without any e-mail or push notifications.

## Context
Read model `RM-TechnicianDashboard` (technicians only). No active notifications (`docs/product/vision.md`). First part of the split of ST-048 (story review 2026-09-26); status changes, resolved or reopened defects, stale claims and overdue maintenance follow in ST-058, "new since the last visit" in ST-050.
- Untriaged problem reports; those waiting longer than 3 days (more than 72 hours, ST-003) highlighted (HS-2).
- Machines that are *Limited* or *Out of order* without open defects – manual policy `POL-ResolvedDefectsReturnMachineToPlay` (HS-6): the technician decides on *Playable*, no mandatory test play.
All values are computed when the dashboard is opened (`docs/adr/0002-modular-monolith-state-based-persistence.md`).

## Acceptance Criteria

Scenario: Untriaged problem reports with long waits highlighted
  Given 3 problem reports are untriaged and one of them was reported 73 hours ago
  When a technician opens the technician dashboard
  Then it shows 3 untriaged problem reports
  And the one reported 73 hours ago is highlighted as waiting longer than 3 days

Scenario: Machines without open defects that are not playable
  Given "LG-042" is Out of order and its last open defect was resolved today
  When a technician opens the technician dashboard
  Then "LG-042" is listed as Out of order without open defects

Scenario: Machines with open defects are not listed
  Given "LG-043" is Limited and still has the open defect "Left flipper weak"
  When a technician opens the technician dashboard
  Then "LG-043" is not listed as without open defects

Scenario: Technician returns a machine to play from the dashboard
  Given "LG-042" is listed as Out of order without open defects
  When the technician sets "LG-042" to Playable with the reason "Repaired and tested"
  Then "LG-042" is Playable
  And it is no longer listed there

Scenario: Helpers cannot open the technician dashboard
  Given a helper is logged in
  When the helper opens the technician dashboard
  Then the technician dashboard is not shown

## Out of Scope
- Machine status changes, resolved or reopened defects, stale claims, overdue maintenance (ST-058)
- Highlighting what is new since the last visit (ST-050)

## Open Questions
- none
