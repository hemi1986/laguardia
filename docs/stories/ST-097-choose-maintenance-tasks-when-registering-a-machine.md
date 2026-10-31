---
id: ST-097
title: Choose a new machine's maintenance tasks when registering it
type: story
context: BC-Maintenance
priority: must
size: M
risk: high
events: [EVT-MachineRegistered, EVT-MachinesOfMaintenanceTaskChanged, EVT-MaintenanceTaskDue]
depends_on: [ST-096]
labels: [ui, maintenance, feature:per-machine-maintenance]
status: done
---

## Story
As a technician registering a machine, I want to choose its maintenance tasks in the same form, with the tasks its kind of machine usually gets already ticked, so that a new machine never starts without scheduled maintenance and I do not have to go through the maintenance plan afterwards.

## Context
Feature `per-machine-maintenance` (user, 2026-10-25; `docs/domain/events.yaml` **POL-RegistrationAppliesChosenMaintenanceTasks**, **HS-22**; `docs/domain/context-map.md`, *Registration with chosen maintenance tasks*; `docs/adr/0010-cross-module-policies-and-retirement-lock.md`), completed in the story review of 2026-10-25 (`docs/reviews/2026-10-25-story-review.md`, decision 4). Changes the registration form of the done story **ST-007** – its rules, texts and landing stay as they are; not reopened. Builds on ST-094 (due rule), ST-096 (the choice of a machine's maintenance tasks, grouped by interval).

**Commands, policy, read model**
- `CMD-RegisterMachine` (Collection, technicians only) produces `EVT-MachineRegistered`. Maintenance adds **`POL-RegistrationAppliesChosenMaintenanceTasks`** to it: in the same step, for every chosen task, `CMD-ChangeMachinesOfMaintenanceTask` adds the new machine (one `EVT-MachinesOfMaintenanceTaskChanged` per chosen task, *Changed by* = the registering technician).
- Maintenance exports the registration command with the policy bound to the chosen task IDs, and the registration page uses that export (ADR 0010, option 3; HS-22).
- **The machine and its maintenance tasks are stored together or not at all** (HS-22). A chosen task that was removed in the meantime, or a task ID La Guardia does not know (only possible with a forged form), rejects the policy and so **the whole registration**; the form shows it and the technician chooses again.
- The chosen tasks are the technician's input to the policy, never data of the registration or of `EVT-MachineRegistered` – Collection knows no maintenance tasks (HS-22).
- The choice is `RM-MaintenanceTaskChoiceForMachine` with *Proposed for a new machine*: a task is proposed when it applies to at least one machine that is not retired and whose machine model has the **same machine category and technology** as the new machine's machine model (`docs/architecture/data-model.md`).

**Rules** – a chosen task is due on the new machine at once; registered as Not on display, it becomes due on its return (HS-20). No task chosen is allowed. Removed maintenance tasks are never offered. All rules of ST-007 still hold.

**Proposals** (user, story review 2026-10-25 – option (a))
- **With JavaScript, once a machine model is chosen**, the proposed tasks are ticked, and a line above the tasks says why: „Vorgeschlagen: 3 Wartungsaufgaben, die schon für Geräte mit Flipper · EM gelten.“ („Vorgeschlagen: 1 Wartungsaufgabe, die schon für Geräte mit Flipper · EM gilt.“) – the group named as in G27 (G6a). With nothing to propose, nothing is ticked and the line is not shown.
- **A tick the technician has not touched follows a change of the machine model**: the previous model's proposals are unticked, the new model's ticked. A tick the technician set or removed themselves stays as they left it.
- **Without JavaScript nothing is proposed**: nothing is ticked and the line is not shown; the technician ticks the tasks.
- **After a rejected registration nothing is proposed again**: the form shows the ticks as they were sent.

**Interface** (`docs/product/ux-guidelines.md` **G27**, G6a, G8, G11)
- The registration form („Gerät erfassen“) gets the section **„Wartungsaufgaben“** after the machine's own fields and before the button: every maintenance task of the plan as a checkbox, grouped by interval as in ST-096 (shortest first, by name within a group), every group closed when the page opens, each header with its count („Jeden Monat – 3 von 5 ausgewählt“), „Alle auswählen“ only with JavaScript.
- **Empty plan** (G7): with no maintenance task in the maintenance plan the section says „Noch keine Wartungsaufgabe im Wartungsplan.“; the machine can be registered all the same.
- **Any rejection of the registration keeps every tick** of a task still offered and opens every group with a choice in it, together with ST-007's kept values (G8, G27). A task removed meanwhile is named: „„Wax playfield“ ist nicht mehr im Wartungsplan. Es wurde nichts gespeichert.“
- After registering, the technician lands on the machine overview with ST-007's confirmation (unchanged).

**Definition of done** (not a scenario): `docs/engineering/conventions.md` gets a paragraph on the actor of a command another module runs in the same step (here *Changed by* = the registering technician – through the policy's `runs` or an actor passed to the policy, decided in the test plan); the pull request names it (the conventions are approved by the user).

## Acceptance Criteria

Scenario: A machine is registered with its maintenance tasks
  Given "Clean glass (inside & out)" and "Wax playfield" are in the maintenance plan
  And today is 10 June 2026
  When a technician registers a machine of "Medieval Madness" at "Hall 2, row 3", Playable, with "Clean glass (inside & out)" ticked and "Wax playfield" not ticked
  Then the machine "LG-042" is registered
  And "Clean glass (inside & out)" applies to "LG-042" and is due there since 10 June 2026
  And "Wax playfield" does not apply to "LG-042"
  And the change of machines of "Clean glass (inside & out)" names the registering technician

Scenario: Tasks of the same kind of machine are proposed and the line says why
  Given "Clean & adjust score reels / stepper units", "Wax playfield" and "Clean glass (inside & out)" apply to the EM pinball machine "LG-005"
  And "Test joysticks, buttons, coin door" applies only to arcade machines
  And JavaScript is switched on
  When a technician chooses the machine model "Fireball" (Pinball, EM) on the registration form
  Then the three tasks of "LG-005" are ticked and "Test joysticks, buttons, coin door" is not
  And the line „Vorgeschlagen: 3 Wartungsaufgaben, die schon für Geräte mit Flipper · EM gelten.“ is shown

Scenario: Untouched proposals follow a change of the machine model
  Given "Clean & adjust score reels / stepper units" applies only to EM pinball machines, "Clean playfield" only to DMD pinball machines, and "Switch test (every switch)" to none
  And JavaScript is switched on
  When a technician chooses "Fireball" (Pinball, EM), ticks "Switch test (every switch)" themselves, and then changes the machine model to "Medieval Madness" (Pinball, DMD)
  Then "Clean & adjust score reels / stepper units" is no longer ticked and "Clean playfield" is ticked
  And "Switch test (every switch)" is still ticked

Scenario: Without JavaScript nothing is proposed
  Given "Clean & adjust score reels / stepper units" applies to the EM pinball machine "LG-005"
  And JavaScript is switched off
  When a technician chooses "Fireball" (Pinball, EM) on the registration form
  Then no maintenance task is ticked and no proposal line is shown
  And the technician can tick "Clean & adjust score reels / stepper units" and register the machine with it

Scenario: A task that applies only to retired machines is not proposed
  Given "Adjust stepper units" applies only to the retired EM pinball machine "LG-007"
  And JavaScript is switched on
  When a technician chooses an EM pinball machine model on the registration form
  Then "Adjust stepper units" is offered but not ticked

Scenario: A machine can be registered without maintenance tasks
  When a technician registers a machine and unticks every maintenance task
  Then the machine is registered
  And no maintenance task applies to it

Scenario: A machine registered as not on display becomes due on its return
  When a technician registers "LG-030" as Not on display with "Clean playfield" ticked
  Then "Clean playfield" applies to "LG-030" and is not due while it is Not on display
  And it becomes due on the day "LG-030" returns to display

Scenario: A task removed meanwhile rejects the whole registration
  Given a technician ticked "Wax playfield" and "Clean glass (inside & out)" on the registration form
  And another technician removed "Wax playfield" from the maintenance plan a moment ago
  When the technician registers the machine
  Then the registration is rejected with „„Wax playfield“ ist nicht mehr im Wartungsplan. Es wurde nichts gespeichert.“, and no machine is registered
  And "Wax playfield" is no longer offered, while "Clean glass (inside & out)" is still ticked
  And the machine model, the location and the machine status are still filled in

Scenario: An unknown maintenance task in a forged registration rejects it
  When a registration is sent that chooses a maintenance task La Guardia does not know
  Then the registration is rejected and no machine is registered
  And no maintenance task changes

Scenario: A rejected registration keeps the ticks and proposes nothing again
  Given JavaScript is switched on and the machine model "Fireball" (Pinball, EM) proposed "Clean & adjust score reels / stepper units"
  And the technician unticked it and ticked "Clean glass (inside & out)" in the group „Jeden Monat“
  When the technician registers the machine with the museum number "42"
  Then the registration is rejected because a museum number has the format "LG-" plus three digits
  And "Clean glass (inside & out)" is still ticked and „Jeden Monat“ is open
  And "Clean & adjust score reels / stepper units" is still not ticked
  And no maintenance task applies to a new machine

Scenario: An empty maintenance plan says so on the registration form
  Given the maintenance plan has no maintenance task
  When a technician opens „Gerät erfassen“
  Then the section „Wartungsaufgaben“ says „Noch keine Wartungsaufgabe im Wartungsplan.“
  And the machine can be registered all the same

Scenario: Helpers are still not offered registering
  Given a helper is logged in
  When the helper tries to register a machine with maintenance tasks
  Then the registration is rejected
  And registering a machine is not offered to the helper

## Out of Scope
- Changing the maintenance tasks after the registration (ST-096)
- Proposing by anything other than machine category and technology
- Proposals without JavaScript (decided: option (a))

## Open Questions
- none – pre-ticking answered as recommended, option (a) (user, 2026-10-25, story review).

## Notes
- Size M, risk high (lead dev, story review 2026-10-25: a composed command exported by Maintenance, ADR 0010 option 3; the actor of the in-step command decided in the test plan).
- The PO saw the proposals as optional; the user kept them and made the chain `must` (decision 3).
