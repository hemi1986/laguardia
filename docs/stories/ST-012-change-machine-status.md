---
id: ST-012
title: Change the machine status
type: story
context: BC-Collection
priority: must
size: M
risk: low
events: [EVT-MachineStatusChanged]
depends_on: [ST-009]
labels: [mvp, collection, ui]
status: done
---

## Story
As a technician, I want to change a machine's status with a reason, so that the team and visitors see whether the machine is playable, limited, out of order or not on display.

## Context
Command `CMD-ChangeMachineStatus`. Rules and invariants (`AGG-Machine`):
- The machine is not retired; a retired machine cannot change status.
- Technicians may set any machine status. Helpers may only set *Out of order*. That helpers do this only when the machine is unsafe is a matter of trust, not a rule La Guardia can check; the required reason documents it.
- A reason is required; every change is kept in the status history (previous status, new status, reason, who, when – `docs/architecture/data-model.md`).
UI wording (de): Spielbereit / Eingeschränkt / Außer Betrieb / Nicht ausgestellt.

**Decided in the test plan (user, 2026-10-03, during `/implement ST-012`):**
- The status change has its own page (G1): the action "Status ändern" in the details section of the machine record leads to `/team/machines/<museum number>/status`; on success the team member is back on the machine record with a confirmation. The action is not shown for a retired machine (G11).
- Choosing the machine status the machine already has is rejected – no history entry without a change. So a helper does not see the action on a machine that is already Out of order.
- Nothing is preselected for a technician (a status must be chosen); a helper's only option, Außer Betrieb, is preselected.

**Foundation (moved from ST-074 on 2026-09-27).** The machine status history is the first real history, so this story builds the shared insert-only history helper (architecture review 2026-09-27, decision **Q13** – histories are append-only lists): histories (work log entries, machine status changes, defect resolutions, …) are lists in the state; the helper saves them by inserting the entries that were not present at load (recognised by their generated ID) and never changes existing entries. The open question on Q13 was answered in the story review of 2026-09-27 (`docs/reviews/2026-09-27-story-review-st-067-073.md`, `OPEN_QUESTIONS.md`): build the helper and prove it with a test stand-in, and again with the machine status history – both proofs now live in this story.

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

Scenario: A helper is offered only Außer Betrieb
  Given a helper is logged in
  When the helper changes the machine status of "LG-042"
  Then Außer Betrieb is the only machine status offered
  And a reason is asked for

Scenario: A rejected status change keeps what was chosen
  Given a technician changes the machine status of "LG-042" to Limited without a reason
  When they submit it
  Then the change is rejected, and the reason field is marked with what to do next
  And the machine status they chose is still chosen

Scenario: After the change the team member sees the machine
  When a technician changes the machine status of "LG-042" to Limited with the reason "left flipper weak"
  Then the machine record of "LG-042" is shown with the machine status Eingeschränkt
  And a confirmation names "LG-042" and its new machine status

### Foundation (moved from ST-074 on 2026-09-27 – architecture review Q13)
- [x] The insert-only history helper, used by a test stand-in aggregate with a history list (its table exists only in the test database): two commands each add an entry; both entries are stored, the first unchanged, and an entry present at load is never updated (integration test).
- [x] The machine status history is saved through the same helper: two status changes of "LG-042" leave two status history entries, the first unchanged, and no existing entry is updated when the second change is saved (integration test at `executeCommand`).
- [x] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "Writing a command" – histories as append-only lists and the insert-only helper.

## Out of Scope
- Changing the machine status in the same step as recording or reopening a defect (ST-018, ST-030)
- Highlighting machines without open defects (ST-048)

## Open Questions
- none
