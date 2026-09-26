---
id: ST-008
title: Machine overview with search
type: story
context: BC-Collection
priority: should
size: null
risk: null
events: [EVT-MachineRegistered, EVT-MachineModelCreated, EVT-MachineStatusChanged]
depends_on: [ST-007]
labels: [mvp, collection]
status: review
---

## Story
As a team member, I want to see all active machines at a glance with their machine status and find a machine by museum number or title, so that I know at any time which machines are playable, limited or out of order.

## Context
Read model `RM-MachineOverview` – all active (registered, not retired) machines; entry point for searching by museum number or machine model title. Fields in this story: museum number, machine model title, machine category, technology, location, machine status.
Supports goal 3 of `docs/product/vision.md` (it is clear at any time which machines are playable).

## Acceptance Criteria

Scenario: Team member sees all active machines
  Given the machines "LG-001" (Playable) and "LG-002" (Out of order) are registered
  When a team member opens the machine overview
  Then both machines are listed with museum number, machine model title, machine category, technology, location and machine status

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
- Number of open defects per machine (ST-021) and number of overdue maintenance tasks (ST-047)
- Finding retired machines (see ST-039)

## Open Questions
- none
