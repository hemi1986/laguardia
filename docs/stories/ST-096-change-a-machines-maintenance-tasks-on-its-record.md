---
id: ST-096
title: Change a machine's maintenance tasks from its machine record
type: story
context: BC-Maintenance
priority: must
size: M
risk: medium
events: [EVT-MachinesOfMaintenanceTaskChanged, EVT-MaintenanceTaskDue]
depends_on: [ST-095]
labels: [ui, maintenance, feature:per-machine-maintenance]
status: done
---

## Story
As a technician standing at a machine, I want to choose on its machine record which maintenance tasks apply to it, so that I can set up or correct one machine's maintenance without going through every task of the maintenance plan.

## Context
Feature `per-machine-maintenance` (user, 2026-10-25; `docs/domain/events.yaml` **FLOW-PerMachineMaintenance**; `CONTEXT.md` **Machines of a maintenance task**), completed in the story review of 2026-10-25 (`docs/reviews/2026-10-25-story-review.md`, decision 4). Builds on ST-094 (grouped choice, due rule) and ST-095 (adding, removing, adding again, the change as a difference). Adds to section 5 „Wartung“ of the machine record – owner **ST-009** (G18), content by the done story **ST-047**, which is not reopened.

**Command, read models** – `CMD-ChangeMachinesOfMaintenanceTask` (technicians only), from the machine record: one machine, several tasks – **one `EVT-MachinesOfMaintenanceTaskChanged` per task that changed**, none for a task whose tick did not change. **All of one change are stored together or not at all** (one step on the one maintenance plan): if one task cannot be changed, none is. The choice is `RM-MaintenanceTaskChoiceForMachine`; the section reads `RM-MachineRecord` (*Maintenance tasks that apply to it*).

**A change is what the technician changed** (as in ST-095): the form sends the tasks as they were ticked when the page opened and the tasks ticked now; only the difference is applied. A task the technician did not touch stays as it is now, whatever another technician did in the meantime – a form opened before someone else's change never undoes it, and two changes sent at the same time are both stored.

**Rules** – those of ST-095, seen from the machine: a task newly ticked is due on the machine at once (on its return, if it is Not on display, HS-20); a task unticked is no longer due on it and its maintenance records stay; removed maintenance tasks are never offered and cannot be ticked – a task removed meanwhile rejects the whole change; a change naming a maintenance task La Guardia does not know (only possible with a forged form) is rejected as a whole; a retired machine offers no „Wartungsaufgaben ändern“ – its maintenance can no longer change (only machines that are not retired can be added).

**Interface** (`docs/product/ux-guidelines.md` **G27**, **G33**, **G34**, G29, G3, G7, G8, G11, G17)
- Section 5 „Wartung“ says how many maintenance tasks apply to the machine – „Für dieses Gerät gelten 4 Wartungsaufgaben.“, „Für dieses Gerät gilt 1 Wartungsaufgabe.“, „Für dieses Gerät gilt keine Wartungsaufgabe.“ – and ends with **„Wartungsaufgaben ändern“** for technicians (G29: the section's button at its end). Helpers see the sentence, not the button (G11). The names are on the form page, so the section does not grow with the plan.
- „Wartungsaufgaben ändern“ leads to a form page headed **„Wartungsaufgaben ändern · LG-042“** (G34) with every maintenance task of the maintenance plan as a checkbox, **grouped by interval, the shortest first**, in the interval wording of the maintenance plan („Jeden Monat – 2 von 5 ausgewählt“, „Alle 3 Monate – 1 von 4 ausgewählt“), and within a group by name (G27). The tasks that apply to the machine are ticked; every group is closed when the page opens; „Alle auswählen“ per group only with JavaScript. An entry shows the task's name and, where it holds, „Für Helfer:innen geeignet“. The submit button reads „Wartungsaufgaben ändern“; the back link „Zurück zum Gerät“ (G17).
- **Empty plan** (G7): with no maintenance task in the maintenance plan the form page says „Noch keine Wartungsaufgabe im Wartungsplan.“ and leads to the maintenance plan, where a task can be added.
- After saving, the technician lands on the machine record with **„Für LG-042 gelten jetzt 4 Wartungsaufgaben.“** („Für LG-042 gilt jetzt 1 Wartungsaufgabe.“, „Für LG-042 gilt jetzt keine Wartungsaufgabe.“) – also when nothing changed, which is not a rejection (G33).
- A rejection keeps every tick of a task still offered and opens every group with a choice in it (G8, G27). A task removed meanwhile is named: „„Wax playfield“ ist nicht mehr im Wartungsplan. Es wurde nichts gespeichert.“ – and it is no longer offered afterwards.

## Acceptance Criteria

Scenario: A technician ticks a maintenance task for a machine
  Given "Clean glass (inside & out)" and "Wax playfield" apply to "LG-042", "Switch test (every switch)" does not
  And today is 10 June 2026
  When a technician opens „Wartungsaufgaben ändern“ on the machine record of "LG-042", ticks "Switch test (every switch)" and saves with „Wartungsaufgaben ändern“
  Then "Switch test (every switch)" applies to "LG-042" and is due there since 10 June 2026
  And the technician is on the machine record of "LG-042" with „Für LG-042 gelten jetzt 3 Wartungsaufgaben.“
  And "Clean glass (inside & out)" and "Wax playfield" still apply, with their due dates unchanged

Scenario: The section says how many tasks apply
  Given 4 maintenance tasks apply to "LG-042", 1 to "LG-043" and none to "LG-044"
  When a technician opens the three machine records
  Then section „Wartung“ reads „Für dieses Gerät gelten 4 Wartungsaufgaben.“, „Für dieses Gerät gilt 1 Wartungsaufgabe.“ and „Für dieses Gerät gilt keine Wartungsaufgabe.“
  And each section ends with „Wartungsaufgaben ändern“

Scenario: The tasks are grouped by interval, the applying ones ticked
  Given the maintenance plan has 5 monthly tasks, 2 of which apply to "LG-042", 4 tasks every 3 months, 1 of which applies, and 1 task every 12 months
  When a technician opens „Wartungsaufgaben ändern“ for "LG-042"
  Then the page is headed „Wartungsaufgaben ändern · LG-042“
  And the closed groups read „Jeden Monat – 2 von 5 ausgewählt“, „Alle 3 Monate – 1 von 4 ausgewählt“ and „Alle 12 Monate – 0 von 1 ausgewählt“, in this order
  And opening „Jeden Monat“ shows its 5 tasks ordered by name, the 2 applying ones ticked

Scenario: Several tasks changed at once, one change per task
  Given "Clean glass (inside & out)" applies to "LG-042" and "Wax playfield" does not
  When a technician unticks "Clean glass (inside & out)" and ticks "Wax playfield" for "LG-042" in one step
  Then "Clean glass (inside & out)" no longer applies to "LG-042" and its maintenance records there stay shown
  And "Wax playfield" applies to "LG-042" and is due there at once
  And exactly one change of machines is recorded for each of the two tasks, none for the others

Scenario: A task removed meanwhile rejects the whole change
  Given a technician unticked "Clean glass (inside & out)" and ticked "Wax playfield" in „Wartungsaufgaben ändern“ for "LG-042"
  And another technician removed "Wax playfield" from the maintenance plan a moment ago
  When the technician saves
  Then the change is rejected with „„Wax playfield“ ist nicht mehr im Wartungsplan. Es wurde nichts gespeichert.“
  And "Clean glass (inside & out)" still applies to "LG-042"
  And "Wax playfield" is no longer offered, while the other ticks are kept as sent and their groups are open

Scenario: A form opened before another change does not undo it
  Given "Wax playfield" applies to "LG-042", and Tom opened „Wartungsaufgaben ändern“ for "LG-042"
  And Eva then removed "LG-042" from "Wax playfield" on the task's own page
  When Tom ticks "Clean glass (inside & out)", leaves "Wax playfield" ticked as it was, and saves
  Then "Clean glass (inside & out)" applies to "LG-042"
  And "Wax playfield" no longer applies to "LG-042"

Scenario: An unknown maintenance task in a forged change rejects it
  When a change of the maintenance tasks of "LG-042" is sent that ticks a maintenance task La Guardia does not know
  Then the change is rejected and no maintenance task changes for "LG-042"

Scenario: Saving without a change is confirmed
  Given 2 maintenance tasks apply to "LG-042"
  When a technician saves „Wartungsaufgaben ändern“ for "LG-042" without changing a tick
  Then no change of machines is recorded
  And the technician is on the machine record of "LG-042" with „Für LG-042 gelten jetzt 2 Wartungsaufgaben.“

Scenario: Unticking the last task is confirmed in words
  Given only "Wax playfield" applies to "LG-042"
  When a technician unticks it for "LG-042" and saves
  Then the confirmation reads „Für LG-042 gilt jetzt keine Wartungsaufgabe.“
  And section „Wartung“ reads „Für dieses Gerät gilt keine Wartungsaufgabe.“

Scenario: A machine not on display can get a task
  Given "LG-030" is Not on display
  When a technician ticks "Clean playfield" for "LG-030" on its machine record
  Then "Clean playfield" applies to "LG-030"
  And it is not due while "LG-030" is Not on display

Scenario: A retired machine's tasks cannot be changed
  Given "LG-013" is retired
  When a technician opens the machine record of "LG-013"
  Then „Wartungsaufgaben ändern“ is not offered
  And a change of its maintenance tasks sent anyway is rejected

Scenario: An empty maintenance plan says so
  Given the maintenance plan has no maintenance task
  When a technician opens „Wartungsaufgaben ändern“ for "LG-042"
  Then the page says „Noch keine Wartungsaufgabe im Wartungsplan.“
  And it leads to the maintenance plan, where a task can be added

Scenario: Helpers do not change a machine's maintenance tasks
  Given a helper is logged in
  When the helper opens the machine record of "LG-042"
  Then „Wartungsaufgaben ändern“ is not offered
  And a change of its maintenance tasks sent anyway is rejected

## Out of Scope
- Choosing maintenance tasks when registering a machine (ST-097)
- Changing a task's interval or instruction from the machine record (ST-041's form)

## Open Questions
- none – the section line and the texts answered as recommended (user, 2026-10-25, story review).

## Notes
- Size M, risk medium (lead dev, story review 2026-10-25). The all-or-nothing step over several tasks is proven by the scenario "A task removed meanwhile rejects the whole change".
