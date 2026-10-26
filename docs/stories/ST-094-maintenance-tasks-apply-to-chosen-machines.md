---
id: ST-094
title: Maintenance tasks apply to the machines a technician chooses, due at once on each
type: story
context: BC-Maintenance
priority: must
size: L
risk: high
events: [EVT-MaintenancePlanChanged, EVT-MachinesOfMaintenanceTaskChanged, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue, EVT-MaintenanceRecorded, EVT-MachineModelCorrected]
depends_on: []
labels: [ui, maintenance, feature:per-machine-maintenance]
status: done
---

## Story
As a technician, I want to choose the machines a maintenance task applies to when I add it, and have it due at once on each of them with its own interval per machine, so that the plan matches what each machine really needs and the work spreads out instead of falling due everywhere on the same day.

## Context
Feature `per-machine-maintenance`, decided by the user on 2026-10-25 (`docs/domain/events.yaml` **FLOW-PerMachineMaintenance**, HS-10/HS-12/HS-20 superseded parts, **HS-23**, **HS-24**; `docs/architecture/data-model.md`, *Maintenance plan* and *Derived: due status*; `CONTEXT.md` **Maintenance task**, **Machines of a maintenance task**, **Due**) and completed in the story review of 2026-10-25 (`docs/reviews/2026-10-25-story-review.md`, decisions 2–4). Changes the done stories **ST-040** (restriction and start date when adding), **ST-041** (restriction and start date when changing), **ST-043** (which machines a task applies to, *last done*), **ST-044** (the "applies to" rule of recording), **ST-045** (which machines „Weitere Geräte“ are) and **ST-036** (a machine model correction changed what is due) – none is reopened. Changing the machines later is ST-095, from the machine record ST-096, at registration ST-097. The story stays one story (decision 2: no split).

**Commands, read models** – `CMD-ChangeMaintenancePlan` (technicians only) adds a maintenance task and, in the same step, its machines: it produces `EVT-MaintenancePlanChanged` and `EVT-MachinesOfMaintenanceTaskChanged`, **stored together or not at all**. The machines follow the rules of `CMD-ChangeMachinesOfMaintenanceTask`. The choice is `RM-MachineChoiceForMaintenanceTask`; the plan is `RM-MaintenancePlan` (*Number of machines it applies to*); due maintenance `RM-DueMaintenance`; recording `CMD-RecordMaintenance`.

**Rules and invariants** (`AGG-MaintenancePlan`, `AGG-MaintenanceRecord`)
- Every maintenance task has a name, an instruction and a positive interval in whole months (ST-040, unchanged). **No restriction to machine category or technology and no start date any more** – the add form and the change form (ST-041) drop those fields; the interval stays on the task.
- A maintenance task applies to **any number of machines – none included** – and to each machine at most once.
- Only registered machines that are not retired can be chosen – checked when the step is sent. A machine **Not on display** can be chosen; the task becomes due on its return (HS-20).
- **A sent step that names a machine La Guardia does not know, or the same machine twice** (only possible with a forged form), is rejected as a whole and nothing is stored.
- A retired machine never counts: it drops out of the count, the due list and every choice, although it may stay among the machines of the task.
- **Due** (data model, HS-24): on a machine the task newly applies to, the task is **due at once** – due since the day the machine was added. From then on its interval runs on that machine alone: *last done* is the latest date carried out of a *done* maintenance record **recorded since the machine was last added** to the task – a record recorded at the very moment of adding or later counts ("since" includes the moment itself); due since = last done + interval. Overdue after 25 % of the interval, as before (ST-043). Never due while the machine is Not on display; after its return the HS-20 rule of ST-056 applies.
- **Recording maintenance** is accepted only for a machine the task applies to – one of its machines, not retired (`CMD-RecordMaintenance`, rule "The maintenance task applies to the machine"); every other rule of ST-044 and ST-045 is unchanged. „Für mehrere Geräte erfassen“ offers the machines of the task: „Fällig“ and, under „Weitere Geräte“, the other machines of the task.
- **A machine model correction no longer changes maintenance.** ST-036's special rule (a task newly applying after a correction counts as last done on the correction date; a task no longer applying leaves the due list) is gone. The machine model's category history (ST-036) is kept, although Maintenance no longer reads it.

**Interface** (`docs/product/ux-guidelines.md` **G27**, G31, G2a, G3, G7, G8, G11, G16)
- The add form („Wartungsaufgabe hinzufügen“) has name, instruction, interval, suitable for helpers and, in the same form, the section „Geräte der Wartungsaufgabe“: one checkbox per machine, grouped by machine category and technology. Each group is a fold of G31 (the look of „Mehr“ and „Verwalten“) that opens without JavaScript, is **closed when the page opens**, and its header names the group and how many of it are chosen: „Flipper · EM – 4 von 6 ausgewählt“. A group without a technology is named by the machine category alone („Sonstiges – 0 von 3 ausgewählt“). With JavaScript the header also offers „Alle auswählen“ for that group, and the header's count follows every tick; without JavaScript „Alle auswählen“ is not shown, the technician ticks the machines one by one, and the count says what was chosen when the page opened.
- **Order** (user, story review 2026-10-25): groups in the order of `CONTEXT.md` – Flipper · EM, Flipper · Solid-State, Flipper · DMD, Flipper · LCD, Flipper (without technology); Arcade · CRT, Arcade · LCD, Arcade (without technology); Sonstiges. Within a group the machines are listed by museum number. **A group without a machine is not shown.**
- An entry reads „LG-042 · Medieval Madness“; a machine **Not on display** says so after it: „LG-030 · Fireball · Nicht ausgestellt“ (G27). Retired machines are never listed.
- **Empty case** (G7): when no machine that is not retired is registered, the section says „Noch kein Gerät erfasst. Die Wartungsaufgabe lässt sich trotzdem hinzufügen und gilt dann für kein Gerät.“
- After a rejection every choice is kept, every group with a choice in it is open (G27), and the reason is shown above the button (G8). A machine retired meanwhile: „LG-044 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“; an unknown machine: „Dieses Gerät gibt es nicht. Es wurde nichts gespeichert.“
- The maintenance plan lists for each task how many machines it applies to: „Gilt für 12 Geräte“, „Gilt für 1 Gerät“, „Gilt für kein Gerät“ – in place of „Nur Flipper · EM“ / „Alle Geräte“ and „Start … · erstmals fällig …“, which go.
- Only technicians reach the maintenance plan (ST-040, G11).

**Migration** (HS-23, HS-24 – only development and preview data exist, no go-live yet; user, story review 2026-10-25: migrate, no reseed)
- Every existing maintenance task applies afterwards to **every machine it applies to today** under its restriction (non-retired machines whose machine model matches the category and technology).
- For each such machine, *added* is set so that every done record that counted under the old rule still counts: **the earlier of (a) the date it started counting under the old rule – the later of the task's start date, the machine's registration date and the machine model correction that made the task apply – taken at midnight in Europe/Berlin, and (b) the time the earliest done record that counted under the old rule was recorded** (lead dev).
- So a machine with a *done* record since then keeps its due date exactly. A machine without one becomes due at once – due since that *added* date.
- The existing maintenance records all stay.
- **The migration writes no entry into the event journal** – it is a data change, not a step a technician took (decision 4).

**Definition of done** (not scenarios)
- The pull request lists the scenarios of done stories this story supersedes, and the tests it changes for them – no test is weakened, each change is named with its reason:
  - superseded – ST-036 "Correcting the technology changes the applicable maintenance tasks", "A task that no longer applies leaves the due list"; ST-040 "Technician adds a maintenance task", "Restriction to machine category and technology", "Restriction must fit", "Technology restriction needs a machine category", "Month-end start date", "Start date is required"; ST-041 "Narrowed restriction removes machines from the due list", "Changing the start date", "Invalid change is rejected"; ST-043 "Maintenance task becomes due", "Machine registered after the start date", "Restriction decides which machines are listed";
  - kept, with their setup changed from a restriction or start date to chosen machines – among them ST-044 "Maintenance task must apply to the machine", ST-045 "Due machines are preselected, all applicable machines can be selected", ST-041 "Technician changes the interval", ST-043 "Maintenance task becomes overdue after 25% of the interval".
- `.claude/skills/engineering-conventions/SKILL.md` gets the paragraphs this story decides, each named in the pull request (the conventions are approved by the user): how `verify.ts` treats superseded scenarios of done stories; a journal event that concerns several machines (`EVT-MachinesOfMaintenanceTaskChanged` names no single machine).

## Acceptance Criteria

Scenario: A technician adds a maintenance task with its machines
  Given the pinball machines "LG-005" (EM) and "LG-042" (DMD) and the arcade machine "LG-020" are registered
  When a technician adds "Clean glass (inside & out)" with an instruction, the interval 1 month, suitable for helpers, and chooses "LG-005" and "LG-042" in the same form
  Then the maintenance plan lists "Clean glass (inside & out)" with „Gilt für 2 Geräte“
  And it applies to "LG-005" and "LG-042" but not to "LG-020"

Scenario: The task is due at once on every chosen machine
  Given today is 10 June 2026
  When a technician adds "Wax playfield" (12 months) for "LG-005" and "LG-042"
  Then the due maintenance list shows "Wax playfield" as due on "LG-005" and "LG-042" since 10 June 2026, without a last done date

Scenario: Each machine's interval runs on its own
  Given "Clean glass (inside & out)" (1 month) applies to "LG-005" and "LG-042" and is due on both since 1 June 2026
  When a team member records it as done on "LG-005" on 3 June 2026 and on "LG-042" on 20 June 2026
  Then it is next due on "LG-005" on 3 July 2026 and on "LG-042" on 20 July 2026

Scenario: A task for no machine
  When a technician adds "Oil the gum machine" without choosing a machine
  Then the maintenance plan lists it with „Gilt für kein Gerät“
  And it is due on no machine

Scenario: The choice is grouped, ordered and closed when the form opens
  Given 6 EM pinball machines, 10 DMD pinball machines, 4 CRT arcade machines and 3 machines of the machine category Other are registered, and no Solid-State or LCD machine
  When a technician opens „Wartungsaufgabe hinzufügen“
  Then the machines are offered in the closed groups „Flipper · EM – 0 von 6 ausgewählt“, „Flipper · DMD – 0 von 10 ausgewählt“, „Arcade · CRT – 0 von 4 ausgewählt“ and „Sonstiges – 0 von 3 ausgewählt“, in this order
  And no group is shown for Solid-State or LCD
  And opening „Flipper · EM“ shows its machines as „LG-005 · Fireball“, ordered by museum number

Scenario: Choosing a whole group works only with JavaScript
  Given JavaScript is switched off
  When a technician opens „Flipper · EM“ in „Wartungsaufgabe hinzufügen“ and ticks "LG-005"
  Then „Alle auswählen“ is not shown, the machines can be ticked one by one, and the header still reads „Flipper · EM – 0 von 6 ausgewählt“
  But with JavaScript „Alle auswählen“ in the header of „Flipper · EM“ ticks its 6 machines and the header reads „Flipper · EM – 6 von 6 ausgewählt“

Scenario: Retired machines are not offered, machines not on display say so
  Given "LG-013" is retired and "LG-030" (Fireball) is Not on display
  When a technician opens „Wartungsaufgabe hinzufügen“
  Then "LG-013" is not offered
  And "LG-030" can be chosen and reads „LG-030 · Fireball · Nicht ausgestellt“

Scenario: No machine registered yet
  Given no machine is registered, or every registered machine is retired
  When a technician opens „Wartungsaufgabe hinzufügen“
  Then „Geräte der Wartungsaufgabe“ says „Noch kein Gerät erfasst. Die Wartungsaufgabe lässt sich trotzdem hinzufügen und gilt dann für kein Gerät.“
  And the maintenance task can be added and is listed with „Gilt für kein Gerät“

Scenario: A machine not on display becomes due on its return
  Given "LG-030" is Not on display
  When a technician adds "Clean playfield" for "LG-030" and "LG-030" returns to display later
  Then "Clean playfield" is not due on "LG-030" while it is Not on display
  And it is due on "LG-030" from the day of its return

Scenario: A rejected task keeps the chosen machines and opens their groups
  Given the groups „Flipper · EM“ and „Arcade · CRT“ exist
  When a technician chooses "LG-005" of „Flipper · EM“ and adds a maintenance task without an instruction
  Then the maintenance task is rejected because the instruction is required, and nothing is stored
  And "LG-005" is still ticked, the name and the interval are still filled in
  And „Flipper · EM“ is open while „Arcade · CRT“ is closed

Scenario: The interval must be positive
  When a technician adds a maintenance task for "LG-005" with the interval 0 months
  Then the maintenance task is rejected and nothing is stored
  And "LG-005" is still ticked

Scenario: A machine retired meanwhile rejects the whole step
  Given a technician ticked "LG-005" and "LG-044" in „Wartungsaufgabe hinzufügen“
  And another technician retired "LG-044" a moment ago
  When the technician adds the maintenance task
  Then it is rejected with „LG-044 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“
  And neither the maintenance task nor any of its machines is stored
  And "LG-005" is still ticked and its group is open

Scenario: An unknown or doubled machine in a forged step rejects the whole step
  When a technician's add step names "LG-005" and a machine La Guardia does not know, or names "LG-005" twice
  Then it is rejected and neither the maintenance task nor any of its machines is stored
  And for the unknown machine the reason reads „Dieses Gerät gibt es nicht. Es wurde nichts gespeichert.“

Scenario: A machine retired later no longer counts
  Given "Wax playfield" applies to "LG-005" and "LG-044" and is due on both
  When a technician retires "LG-044"
  Then the maintenance plan lists "Wax playfield" with „Gilt für 1 Gerät“
  And "Wax playfield" is no longer due on "LG-044" and "LG-044" is not offered in „Für mehrere Geräte erfassen“ for it

Scenario: The forms have no restriction and no start date
  When a technician opens „Wartungsaufgabe hinzufügen“ and the change form of an existing maintenance task
  Then neither offers a machine category, a technology or a start date

Scenario: Maintenance is recorded only on a machine the task applies to
  Given "Test joysticks, buttons, coin door" applies to "LG-020" but not to "LG-042"
  When a team member tries to record it on "LG-042"
  Then the maintenance record is rejected because the maintenance task does not apply to this machine
  And recording it on "LG-020" is accepted

Scenario: Recording for several machines offers the machines of the task
  Given "Clean glass (inside & out)" applies to "LG-042" and "LG-045" and is due only on "LG-042"
  And "LG-050" is a pinball machine it does not apply to
  When a team member chooses „Für mehrere Geräte erfassen“ for it
  Then "LG-042" is offered under „Fällig“ and "LG-045" under „Weitere Geräte“
  And "LG-050" is not offered

Scenario: A machine model correction changes nothing in maintenance
  Given "Clean & adjust score reels / stepper units" applies to "LG-005" of the machine model "Fireball" (Pinball, Solid-state) and was done there on 1 May 2026
  When a technician corrects the technology of "Fireball" to EM on 1 June 2026
  Then the task still applies to "LG-005" and is next due as before, counted from 1 May 2026
  And no maintenance task starts or stops applying to "LG-005"

Scenario: Migration – existing tasks apply to the machines they apply to today
  Given before the migration "Clean & adjust score reels / stepper units" is restricted to Pinball / EM, "LG-005" is an EM pinball machine, "LG-042" a DMD pinball machine and "LG-007" a retired EM pinball machine
  When the migration is applied
  Then the task applies to "LG-005"
  And neither to "LG-042" nor to "LG-007"
  And the maintenance plan shows how many machines it applies to
  And the event journal has no new entry

Scenario: Migration – a machine with a done record keeps its due date
  Given before the migration "Wax playfield" (12 months, start date 1 January 2026) applies to "LG-005", which was done on 1 March 2026 and is next due on 1 March 2027
  When the migration is applied
  Then "Wax playfield" is next due on "LG-005" on 1 March 2027

Scenario: Migration – a machine without a done record is due at once
  Given before the migration "Wax playfield" (12 months, start date 1 January 2026) applies to "LG-042", which was registered in 2025 and has no done record for it
  When the migration is applied
  Then "Wax playfield" is due on "LG-042" since 1 January 2026

Scenario: Helpers cannot add maintenance tasks
  Given a helper is logged in
  When the helper tries to add a maintenance task with machines
  Then the action is rejected
  And the maintenance plan is not offered to the helper

## Out of Scope
- Changing the machines of an existing task (ST-095), from the machine record (ST-096), when registering a machine (ST-097)
- The sticker selection and the folds of „Für mehrere Geräte erfassen“ (ST-098)
- Restoring a removed maintenance task
- A dashboard hint for machines without maintenance tasks (candidate, no story – PO, story review 2026-10-25)

## Open Questions
- none – group order and empty case answered as recommended (user, 2026-10-25, story review).

## Notes
- Size L, risk high (lead dev, story review 2026-10-25). The lead dev proposed a split – the domain switch (machines with *added*, due and record rule, restriction and start date gone, model correction rule gone, migration, a flat checklist) and the grouped folding choice (G27, „Alle auswählen“, empty case, group order); the user decided no split (decision 2). The pull request can follow that order internally.
- Lead dev, for the test plan: the step takes the shared retirement lock (ADR 0010) of every chosen machine, in the order of their machine IDs, so two steps cannot deadlock; whether a `<button>` for „Alle auswählen“ inside a fold's header works across browsers is checked in the test plan; the group order is a query of Collection's interface.
- Rejection texts follow the catalog's existing patterns (`recordDefect.retiredMeanwhile`, the shared `unknown-machine`).
- The grouped choice built here is used again by ST-095 (machines of a task), ST-096 (tasks of a machine, grouped by interval), ST-097 (registration) and ST-098 (stickers, recording for several).
- Order (decision 3): the maintenance chain comes first – ST-094 → ST-095 → ST-096 → ST-097 → ST-098, all `must`.
