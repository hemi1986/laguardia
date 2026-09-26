---
id: ST-040
title: Maintenance plan – view and add maintenance tasks
type: story
context: BC-Maintenance
priority: must
size: S
risk: low
events: [EVT-MaintenancePlanChanged]
depends_on: [ST-003, ST-006]
labels: [mvp, maintenance]
status: ready
---

## Story
As a technician, I want to add maintenance tasks with instruction, interval, suitable-for-helpers mark, optional restriction and a start date to the museum-wide maintenance plan, so that La Guardia knows which scheduled maintenance each machine needs.

## Context
Command `CMD-ChangeMaintenancePlan` (technicians only), read model `RM-MaintenancePlan`. Rules and invariants (`AGG-MaintenancePlan`):
- Every maintenance task has a name, an instruction, a positive interval and a start date; the start date counts as last done, so the task is first due one interval later (HS-12).
- The interval is entered in whole months; month arithmetic follows the time convention (ST-003), e.g. a start date of 31 January plus 1 month is 28 February (29 in leap years).
- Optional restriction to a machine category, or to a machine category plus a technology; a technology restriction always needs a machine category and must fit it (e.g. Pinball/EM only).
- The maintenance plan is one single, museum-wide set (`CONTEXT.md`).
UI wording (de): Wartungsplan, Wartungsaufgabe, Für Helfer:innen geeignet.

## Acceptance Criteria

Scenario: Technician adds a maintenance task
  Given a technician is logged in
  When the technician adds the maintenance task "Clean glass (inside & out)" with an instruction, the interval 1 month, suitable for helpers, the restriction Pinball and the start date 1 October 2026
  Then the maintenance plan lists "Clean glass (inside & out)" with instruction, interval, suitable for helpers and machine category Pinball
  And it is first due on applicable machines on 1 November 2026

Scenario: Restriction to machine category and technology
  When a technician adds the maintenance task "Clean & adjust score reels / stepper units" restricted to Pinball with the technology EM
  Then the maintenance task applies only to machines whose machine model is Pinball with the technology EM

Scenario Outline: Restriction must fit
  When a technician adds a maintenance task restricted to <category> with the technology <technology>
  Then the maintenance task is rejected

  Examples:
    | category | technology |
    | Arcade   | EM         |
    | Other    | LCD        |

Scenario: Technology restriction needs a machine category
  When a technician adds a maintenance task restricted to the technology LCD without a machine category
  Then the maintenance task is rejected

Scenario: Interval must be positive
  When a technician adds a maintenance task with the interval 0 months
  Then the maintenance task is rejected

Scenario: Instruction is required
  When a technician adds a maintenance task without an instruction
  Then the maintenance task is rejected

Scenario: Month-end start date
  When a technician adds a 1-month maintenance task with the start date 31 January 2026
  Then it is first due on 28 February 2026

Scenario: Start date is required
  When a technician adds a maintenance task without a start date
  Then the maintenance task is rejected

Scenario: Helpers cannot change the maintenance plan
  Given a helper is logged in
  When the helper tries to add a maintenance task
  Then the action is rejected

## Out of Scope
- Changing and removing maintenance tasks (ST-041)
- Entering the 19 initial maintenance tasks before go-live (go-live checklist, ST-042)

## Open Questions
- none
