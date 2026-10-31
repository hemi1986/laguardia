---
id: ST-095
title: Change the machines of a maintenance task
type: story
context: BC-Maintenance
priority: must
size: M
risk: medium
events: [EVT-MachinesOfMaintenanceTaskChanged, EVT-MaintenanceTaskDue]
depends_on: [ST-094]
labels: [ui, maintenance, feature:per-machine-maintenance]
status: done
---

## Story
As a technician, I want to add machines to a maintenance task and remove machines from it later, so that the plan follows the collection as machines arrive, change or turn out not to need a task.

## Context
Feature `per-machine-maintenance` (user, 2026-10-25; `docs/domain/events.yaml` **FLOW-PerMachineMaintenance**, **HS-24**; `CONTEXT.md` **Machines of a maintenance task**), completed in the story review of 2026-10-25 (`docs/reviews/2026-10-25-story-review.md`, decision 4). Builds on ST-094 (the grouped choice, the due rule). Changes the screen of the done story **ST-041** (the task's page offers a further action); not reopened.

**Command, read model** – `CMD-ChangeMachinesOfMaintenanceTask` (technicians only) produces `EVT-MachinesOfMaintenanceTaskChanged` with the machines added and removed; the choice is `RM-MachineChoiceForMaintenanceTask`.

**A change is what the technician changed, not the whole list** (lead dev, story review 2026-10-25): the form sends the machines as they were ticked when the page opened and the machines ticked now; the change is the difference – the machines newly ticked are added, the machines unticked are removed. Machines the technician did not touch stay as they are *now*, whatever another technician did in the meantime. So a form opened before someone else's change never undoes that change, and **two changes sent at the same time are both stored**. Adding a machine that is already among the machines, or removing one that no longer is, changes nothing and is no rejection.

**Rules and invariants** (`AGG-MaintenancePlan`)
- Only registered machines that are not retired can be added – checked when the change is sent; a machine Not on display can be added and becomes due on its return (HS-20).
- A machine is among the machines of a task at most once. A change that in the end adds and removes nothing records no event.
- A change that names a machine La Guardia does not know (only possible with a forged form) is rejected as a whole and nothing is stored.
- **A machine added – also one added again after it was removed – has the task due at once.** Only *done* maintenance records recorded since it was last added count for *last done* (HS-24), so a record from before a removal does not.
- **A machine removed is no longer due for the task; its maintenance records stay** and are still shown on its machine record.
- A **removed maintenance task is final**: its machines never change again – „Geräte ändern“ is not offered, and a change sent anyway is rejected.
- A retired machine is never listed in the choice and never counts. One that is among the machines stays among them when the other machines change – not being listed is not unticking it.

**Interface** (`docs/product/ux-guidelines.md` **G27**, **G33**, **G34**, G21, G3, G7, G8, G11, G17)
- The task's page (ST-041's change form, reached by „Ändern“ in the maintenance plan) shows under the heading, before the first field, how many machines the task applies to – „Gilt für 3 Geräte“ („Gilt für 1 Gerät“, „Gilt für kein Gerät“) – with **„Geräte ändern“** next to it.
- „Geräte ändern“ leads to a form page headed **„Geräte ändern · Wax playfield“** (G34) with the grouped choice of ST-094: the machines the task applies to are ticked, every group closed when the page opens, each header with its count („Flipper · EM – 4 von 6 ausgewählt“), „Alle auswählen“ only with JavaScript; the submit button reads „Geräte ändern“; the back link „Zurück zur Wartungsaufgabe“ leads to the task's page (G17).
- **Empty case** (G7): when no machine that is not retired is registered, the form page says „Noch kein Gerät erfasst.“ and offers „Gerät erfassen“.
- After sending, the technician lands on the maintenance plan with **„„Wax playfield“ gilt jetzt für 3 Geräte.“** („… für 1 Gerät.“, „… für kein Gerät.“) – also when nothing changed, which is not a rejection (G33).
- A rejection keeps every tick of a machine still offered, opens every group with a choice in it and names the reason above the button (G8, G27). A machine retired meanwhile: „LG-044 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“ – it is no longer listed afterwards.

**Definition of done** (not a scenario): `docs/engineering/conventions.md` gets a paragraph on versionless set-delta commands on the single maintenance plan aggregate (the form sends the set as seen and the new set, the command applies the difference, no-ops instead of conflicts); the pull request names it (the conventions are approved by the user).

## Acceptance Criteria

Scenario: A technician adds a machine to a maintenance task
  Given "Clean glass (inside & out)" applies to "LG-005" and "LG-042"
  And today is 10 June 2026
  When a technician opens „Geräte ändern“ on its page, ticks "LG-043" as well and sends the change with „Geräte ändern“
  Then the task applies to "LG-005", "LG-042" and "LG-043"
  And it is due on "LG-043" since 10 June 2026
  And the technician is on the maintenance plan with „„Clean glass (inside & out)“ gilt jetzt für 3 Geräte.“, and the plan shows „Gilt für 3 Geräte“ for it

Scenario: The task's page shows the count and leads to the form page
  Given "Wax playfield" applies to "LG-005", "LG-042" and "LG-043"
  When a technician opens the page of "Wax playfield"
  Then „Gilt für 3 Geräte“ and „Geräte ändern“ are shown under the heading, before the first field
  And „Geräte ändern“ leads to a page headed „Geräte ändern · Wax playfield“, whose „Zurück zur Wartungsaufgabe“ leads back

Scenario: The machines the task applies to are ticked, the groups closed
  Given "Clean glass (inside & out)" applies to 4 of the 6 EM pinball machines
  When a technician opens „Geräte ändern“ for it
  Then the group „Flipper · EM – 4 von 6 ausgewählt“ is closed
  And opening it shows those 4 machines ticked

Scenario: A removed machine is no longer due and keeps its records
  Given "Wax playfield" is due on "LG-042", which has two maintenance records for it
  When a technician removes "LG-042" from "Wax playfield"
  Then "Wax playfield" is no longer due on "LG-042" and no longer listed for it in the due maintenance list
  And both maintenance records are still shown on the machine record of "LG-042"

Scenario: A machine added again is due at once
  Given "Wax playfield" (12 months) was done on "LG-042" on 1 March 2026 and "LG-042" was removed from it on 1 April 2026
  When a technician adds "LG-042" to "Wax playfield" again on 10 June 2026
  Then "Wax playfield" is due on "LG-042" since 10 June 2026
  And the record of 1 March 2026 does not count as last done

Scenario: A done record backdated to before adding still counts
  Given "LG-043" was added to "Clean glass (inside & out)" on 10 June 2026
  When a team member records it there on 10 June 2026 as done on 5 June 2026
  Then it is next due on "LG-043" on 5 July 2026

Scenario: A form opened before another change does not undo it
  Given "Wax playfield" applies to "LG-005" and "LG-042", and Tom opened „Geräte ändern“ for it
  And Eva then added "LG-043" and removed "LG-042"
  When Tom unticks "LG-005", leaves "LG-042" ticked as it was, and sends the change
  Then "Wax playfield" applies to "LG-043" only
  And nothing is rejected

Scenario: Two changes sent at the same time are both stored
  Given "Wax playfield" applies to "LG-005"
  When Tom adds "LG-042" and Eva adds "LG-043" to it at the same time
  Then "Wax playfield" applies to "LG-005", "LG-042" and "LG-043"

Scenario: Adding a machine someone else already added is no rejection
  Given Tom and Eva both opened „Geräte ändern“ for "Wax playfield", which does not apply to "LG-043"
  And Eva added "LG-043"
  When Tom ticks "LG-043" and sends the change
  Then nothing is rejected and "LG-043" is among the machines of "Wax playfield" once
  And its due date stays the one of Eva's change

Scenario: A machine retired meanwhile rejects the change
  Given a technician ticked "LG-043" and "LG-044" in „Geräte ändern“ of "Clean glass (inside & out)"
  And another technician retired "LG-044" a moment ago
  When the technician sends the change
  Then the change is rejected with „LG-044 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“, and nothing is stored
  And "LG-044" is no longer offered, while "LG-043" is still ticked and its group is open

Scenario: A retired machine stays among the machines when others change
  Given "Wax playfield" applies to "LG-005" and "LG-013", and "LG-013" was retired since
  When a technician opens „Geräte ändern“ for it, where "LG-013" is not listed, ticks "LG-042" and sends the change
  Then "LG-013" is still among the machines of "Wax playfield"
  And the maintenance plan shows „Gilt für 2 Geräte“ for it

Scenario: An unknown machine in a forged change rejects it
  When a change of the machines of "Wax playfield" is sent that adds a machine La Guardia does not know
  Then the change is rejected and nothing is stored

Scenario: A change that changes nothing records nothing and is confirmed
  Given "Clean glass (inside & out)" applies to "LG-005" and "LG-042"
  When a technician sends „Geräte ändern“ without changing a tick
  Then no change of the machines is recorded
  And the due dates of "LG-005" and "LG-042" stay as they were
  And the technician is on the maintenance plan with „„Clean glass (inside & out)“ gilt jetzt für 2 Geräte.“

Scenario: Removing every machine leaves the task for no machine
  Given "Oil the gum machine" applies to "LG-090" only
  When a technician removes "LG-090" from it
  Then the maintenance plan lists "Oil the gum machine" with „Gilt für kein Gerät“
  And the confirmation reads „„Oil the gum machine“ gilt jetzt für kein Gerät.“

Scenario: No machine registered yet
  Given every registered machine is retired
  When a technician opens „Geräte ändern“ for "Wax playfield"
  Then the page says „Noch kein Gerät erfasst.“ and offers „Gerät erfassen“

Scenario: The machines of a removed task never change
  Given "Wax playfield" was removed from the maintenance plan
  When a technician sends a change of its machines anyway
  Then the change is rejected
  And no machine is added to or removed from "Wax playfield"

Scenario: Helpers cannot change the machines of a task
  Given a helper is logged in
  When the helper tries to change the machines of "Clean glass (inside & out)"
  Then the change is rejected
  And „Geräte ändern“ is not offered to the helper

## Out of Scope
- Choosing a machine's maintenance tasks on its machine record (ST-096) and at registration (ST-097)

## Open Questions
- none – texts and landing answered as recommended (user, 2026-10-25, story review).

## Notes
- Size M, risk medium (lead dev, story review 2026-10-25).
- The rejection text for a machine retired meanwhile follows the catalog's existing pattern (`recordDefect.retiredMeanwhile`).
