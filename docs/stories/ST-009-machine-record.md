---
id: ST-009
title: Machine record with machine status history
type: story
context: BC-Collection
priority: must
size: S
risk: low
events: [EVT-MachineRegistered, EVT-MachineModelCreated, EVT-MachineStatusChanged]
depends_on: [ST-008]
labels: [mvp, collection, ui]
status: in-progress
---

## Story
As a team member, I want to open the machine record of a machine with its details and machine status history, so that I have everything about the machine in one place when I stand in front of it.

## Context
Read model `RM-MachineRecord`. This story delivers the base of the page: museum number, serial number, machine model (title, manufacturer, year, machine category, technology), location, machine status with history (previous status, new status, reason, who, when).
All times are shown in Europe/Berlin (time convention, ST-003). The retired-machine scenario is tested with test data until retirement exists (ST-039).
Further sections are added by later stories: report problem (ST-015), repair history (ST-033), files (ST-037), maintenance (ST-047). Team members scanning the QR code land here (ST-011).
**ST-009 owns this page (G18) – its sections, top to bottom** (user, 2026-10-02, during `/implement ST-009`): 1. the retirement note "Ausgemustert am … von … – reason" (retired machines only; ST-009, ST-039); 2. the action "Problem melden" (ST-015); 3. the details – serial number, machine model, location, machine status – with the actions on those facts: change the machine status (ST-012), move (ST-034), correct the details (ST-035), print the QR sticker (ST-011); 4. open defects (ST-021); 5. due maintenance (ST-047); 6. the machine status history (ST-009); 7. the repair history (ST-033); 8. files of the machine and its machine model (ST-037); 9. retiring the machine (ST-039) – last, because it cannot be undone. Later stories add into these sections, in this order; none adds a section of its own.
**This story is where a machine first has a record of its own** (user's decision, backlog grooming 2026-10-01). A technician who registers a machine lands back on the machine overview with a confirmation (ST-007, G2a) – the assertion that they then reach the newly registered machine's own record belongs here, and the scenario "Team member opens a machine record" covers it: the record is opened from the machine overview.

## Acceptance Criteria

Scenario: Team member opens a machine record
  Given the machine "LG-042" of the machine model "Medieval Madness" (Williams, 1997, Pinball, DMD) stands at "Hall 2, row 3" and is Playable
  When a team member opens the machine record of "LG-042" from the machine overview
  Then the museum number, serial number, machine model details, location and machine status are shown

Scenario: Machine status history is shown newest first
  Given "LG-042" was registered as Playable and later changed to Out of order with the reason "flipper coil burnt" by Tom
  When a team member opens the machine record of "LG-042"
  Then the status history shows the change to Out of order by Tom with its reason and time first
  And the registration as Playable second

Scenario: Unknown museum number
  When a team member opens the machine record of the museum number "LG-999", which does not exist
  Then La Guardia says that no machine with this museum number exists

Scenario: Retired machine keeps its record
  Given the machine "LG-013" is retired
  When a team member opens the machine record of "LG-013"
  Then its details and history are shown
  And it is marked as retired

## Out of Scope
- Repair history, files and maintenance sections (ST-033, ST-037, ST-047)
- Changing the machine status (ST-012)

## Open Questions
- none
