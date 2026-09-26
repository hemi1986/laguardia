---
id: ST-012
title: Change the machine status
type: story
context: BC-Collection
priority: should
size: null
risk: null
events: [EVT-MachineStatusChanged]
depends_on: [ST-009]
labels: [mvp, collection]
status: review
---

## Story
As a technician, I want to change a machine's status with a reason, so that the team and visitors see whether the machine is playable, limited, out of order or not on display.

## Context
Command `CMD-ChangeMachineStatus`. Rules and invariants (`AGG-Machine`):
- The machine is not retired; a retired machine cannot change status.
- Technicians may set any machine status. Helpers may only set *Out of order*, and only when the machine is unsafe.
- A reason is required; every change is kept in the status history (previous status, new status, reason, who, when – `docs/architecture/data-model.md`).
UI wording (de): Spielbereit / Eingeschränkt / Außer Betrieb / Nicht ausgestellt.

## Acceptance Criteria

Scenario: Technician changes the machine status
  Given the machine "LG-042" is Playable
  When a technician changes its machine status to Limited with the reason "left flipper weak"
  Then "LG-042" is Limited
  And the status history shows the change from Playable to Limited with the reason and the technician

Scenario: Helper takes an unsafe machine out of play
  Given the machine "LG-042" is Playable
  When a helper sets it to Out of order with the reason "glass cracked – unsafe"
  Then "LG-042" is Out of order
  And the visitor machine page shows it as out of order

Scenario Outline: Helpers can only set Out of order
  Given the machine "LG-042" is Out of order
  When a helper tries to set it to <status>
  Then the change is rejected
  And "LG-042" stays Out of order

  Examples:
    | status         |
    | Playable       |
    | Limited        |
    | Not on display |

Scenario: A reason is required
  When a technician changes the machine status of "LG-042" without a reason
  Then the change is rejected

Scenario: Retired machines cannot change status
  Given the machine "LG-013" is retired
  When a technician tries to change its machine status
  Then the change is rejected

## Out of Scope
- Changing the machine status in the same step as recording or reopening a defect (ST-018, ST-030)
- Highlighting machines without open defects (ST-048)

## Open Questions
- none
