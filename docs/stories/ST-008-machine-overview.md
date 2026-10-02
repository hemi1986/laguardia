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
labels: [mvp, collection, ui]
status: in-progress
---

## Story
As a team member, I want to see all active machines at a glance with their machine status, see how many machines have which machine status, and find a machine by museum number or title, so that I know at any time which machines are playable, limited or out of order.

## Context
**This story extends a list that already exists.** ST-007 ships the machine overview as a plain list (museum number, machine model title, location, machine status) with the action that leads to the registration form; ST-008 adds the counts per machine status, the machine status filter and the search to it, and completes the entry with machine category and technology (user's decision, backlog grooming 2026-10-01).

Read model `RM-MachineOverview` – all active (registered, not retired) machines; entry point for searching by museum number or machine model title. Fields in this story: museum number, machine model title, machine category, technology, location, machine status.
Supports goal 3 of `docs/product/vision.md` (it is clear at any time which machines are playable): the overview shows the number of machines per machine status and can be filtered by machine status. Machines are sorted by museum number.
- The machine overview is the first team page with more than one destination, so **the team navigation is decided here**, with every destination the MVP will have (G19) – the ones that exist today (machine models, team members, own password, log out; `src/app/(team)/navigation.tsx`) together with the ones the MVP stories add: the machine overview (ST-007/ST-008), the triage list (ST-017), the open defects list (ST-021), the maintenance plan (ST-040), the due maintenance list (ST-043) and the dashboard (ST-048, ST-049). Each of those stories then takes its place in a navigation that is already decided; none of them re-decides it. Technician-only destinations stay hidden from helpers while the page and the module check the role again (G11, the pattern of `navigation.tsx`).
- **The German page names are decided here too** (user's decision, backlog grooming 2026-10-01): the dashboard is "Übersicht" (the `_UI (de)_` wording of **Dashboard** in `CONTEXT.md`), so the machine overview is **"Geräte"** – the plural of the `_UI (de)_` wording of **Machine** – and the two names do not collide.
- A machine in the overview shows only what tells it apart from its neighbours; everything that can be done to a machine happens on its machine record (G5).
- **Which facts the entry carries is decided here** (G6): a count is labelled in words, and a count that is zero is not shown. ST-021 (open defects per machine) and ST-057 (overdue maintenance per machine) add to this decision, they do not reopen it.
- The empty case and the two "nothing found" cases say what to do about them (G7).
- This is the first long list, so it settles open decision **O2** of `docs/product/ux-guidelines.md` – how much of the workshop PC's width a list may use.

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

Scenario: No machine matches the search
  Given the machines "LG-001" and "LG-002" are registered
  When a team member searches for "jukebox"
  Then no machine is listed
  And it says that no machine matches this search
  And clearing the search is offered

Scenario: No machine has the filtered machine status
  Given no machine is Out of order
  When a team member filters the machine overview by Out of order
  Then no machine is listed
  And it says that no machine is Out of order

Scenario: Visitors cannot open the machine overview
  Given nobody is logged in
  When the machine overview is opened
  Then the login is requested first

## Out of Scope
- The plain list itself and the action under its heading that leads to the registration form (ST-007)
- Number of open defects per machine (ST-021) and number of overdue maintenance tasks (ST-057)
- Finding retired machines (ST-055)

## Open Questions
- none
