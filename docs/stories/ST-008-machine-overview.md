---
id: ST-008
title: Machine overview with search and machine status filter
type: story
context: BC-Collection
priority: must
size: S
risk: low
events: [EVT-MachineRegistered, EVT-MachineModelCreated, EVT-MachineStatusChanged]
depends_on: [ST-007]
labels: [mvp, collection]
status: ready
---

## Story
As a team member, I want to see all active machines at a glance with their machine status, see how many machines have which machine status, and find a machine by museum number or title, so that I know at any time which machines are playable, limited or out of order.

## Context
Read model `RM-MachineOverview` – all active (registered, not retired) machines; entry point for searching by museum number or machine model title. Fields in this story: museum number, machine model title, machine category, technology, location, machine status.
Supports goal 3 of `docs/product/vision.md` (it is clear at any time which machines are playable): the overview shows the number of machines per machine status and can be filtered by machine status. Machines are sorted by museum number.

## Acceptance Criteria

Scenario: Team member sees all active machines
  Given the machines "LG-002" (Out of order) and "LG-001" (Playable) are registered
  When a team member opens the machine overview
  Then both machines are listed with museum number, machine model title, machine category, technology, location and machine status
  And "LG-001" is listed before "LG-002"

Scenario: Number of machines per machine status
  Given 45 machines are Playable, 6 Limited, 3 Out of order and 5 Not on display
  When a team member opens the machine overview
  Then it shows 45 Playable, 6 Limited, 3 Out of order and 5 Not on display

Scenario: Filter by machine status
  Given "LG-002" and "LG-007" are Out of order and all other machines are Playable
  When a team member filters the machine overview by Out of order
  Then only "LG-002" and "LG-007" are listed

Scenario: Search by museum number
  Given the machine "LG-042" is registered
  When a team member searches for "042"
  Then the machine "LG-042" is found

Scenario: Search by title
  Given the machine "LG-042" is of the machine model "Medieval Madness"
  When a team member searches for "medieval"
  Then the machine "LG-042" is found

Scenario: Retired machines are not listed
  Given the machine "LG-013" is retired
  When a team member opens the machine overview
  Then "LG-013" is not listed

Scenario: Visitors cannot open the machine overview
  Given nobody is logged in
  When the machine overview is opened
  Then the login is requested first

## Out of Scope
- Number of open defects per machine (ST-021) and number of overdue maintenance tasks (ST-057)
- Finding retired machines (ST-055)

## Open Questions
- none
