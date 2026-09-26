---
id: ST-009
title: Machine record with machine status history
type: story
context: BC-Collection
priority: should
size: null
risk: null
events: [EVT-MachineRegistered, EVT-MachineModelCreated, EVT-MachineStatusChanged]
depends_on: [ST-008]
labels: [mvp, collection]
status: review
---

## Story
As a team member, I want to open the machine record of a machine with its details and machine status history, so that I have everything about the machine in one place when I stand in front of it.

## Context
Read model `RM-MachineRecord`. This story delivers the base of the page: museum number, serial number, machine model (title, manufacturer, year, machine category, technology), location, machine status with history (previous status, new status, reason, who, when).
Further sections are added by later stories: report problem (ST-015), repair history (ST-033), files (ST-037), maintenance (ST-047). Team members scanning the QR code land here (ST-011).

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
