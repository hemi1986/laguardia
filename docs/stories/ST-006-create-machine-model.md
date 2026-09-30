---
id: ST-006
title: Create a machine model
type: story
context: BC-Collection
priority: must
size: S
risk: low
events: [EVT-MachineModelCreated]
depends_on: [ST-004]
labels: [mvp, collection]
status: in-progress
---

## Story
As a technician, I want to create a machine model with title, manufacturer, year, machine category and technology, so that machines of that model can be registered and share its data, manuals and schematics.

## Context
Command `CMD-CreateMachineModel` (technicians only). Rules and invariants (`AGG-MachineModel`):
- Title, manufacturer and machine category (*Pinball*, *Arcade*, *Other*) are required; the year is optional.
- The technology is optional and must fit the machine category: Pinball – *EM*, *Solid-state*, *DMD*, *LCD*; Arcade – *CRT*, *LCD*; Other – none.
UI wording (de): Modell, Kategorie (Flipper / Arcade / Sonstiges), Technik.

## Acceptance Criteria

Scenario: Technician creates a pinball machine model
  Given a technician is logged in
  When the technician creates a machine model with the title "Medieval Madness", the manufacturer "Williams", the year 1997, the machine category Pinball and the technology DMD
  Then the machine model "Medieval Madness" exists with these details
  And it can be chosen when registering a machine

Scenario: Technology is optional
  When a technician creates a machine model with the title "Wurlitzer 1015", the manufacturer "Wurlitzer" and the machine category Other without a technology
  Then the machine model exists without a technology

Scenario Outline: Technology must fit the machine category
  When a technician creates a machine model with the machine category <category> and the technology <technology>
  Then the machine model is rejected because the technology does not fit the machine category

  Examples:
    | category | technology |
    | Arcade   | DMD        |
    | Pinball  | CRT        |
    | Other    | LCD        |

Scenario: Required details are missing
  When a technician creates a machine model without a manufacturer
  Then the machine model is rejected because the manufacturer is required

Scenario: Helpers cannot create machine models
  Given a helper is logged in
  When the helper tries to create a machine model
  Then the action is rejected

## Out of Scope
- Correcting a machine model (ST-036)
- Files of the machine model (ST-037)

## Open Questions
- none
