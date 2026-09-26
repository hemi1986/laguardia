---
id: ST-010
title: Visitor machine page in German and English
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-MachineRegistered, EVT-MachineModelCreated, EVT-MachineStatusChanged, EVT-MachineModelCorrected]
depends_on: [ST-007]
labels: [mvp, visitor]
status: ready
---

## Story
As a visitor, I want to see a short page about the machine I am standing at in German or English, so that I can see whether it is known to be out of order before I decide to report a problem.

## Context
Read model `RM-VisitorMachinePage` – opened via the QR code (ST-011), public, no login, addressed by museum number. Deliberately minimal, no storytelling about the machine.
Fields: machine model title, manufacturer, year, machine status, titles of open defects (ST-018), number of untriaged problem reports (ST-013), whether reporting is possible (machine on display).
Language (`docs/adr/0001-tech-stack.md`): German and English message catalogs, language from the browser with a manual switch; a browser that prefers neither German nor English gets English. Defect titles are shown untranslated.
The page shows no team member names and no text of problem reports – neither visibly nor in the page source (no internal IDs either).
The page is always current: it is never served from a shared cache, so a machine status change is visible at the next page load.
The language choice is remembered for the visitor's following visitor pages.

## Acceptance Criteria

Scenario: Visitor with a German browser opens the page
  Given the machine "LG-042" of the machine model "Medieval Madness" (Williams, 1997) is Playable
  And the visitor's browser prefers German
  When the visitor opens the visitor machine page of "LG-042"
  Then the page shows "Medieval Madness", "Williams", 1997 and the machine status "Spielbereit" in German
  And reporting a problem is offered

Scenario: Visitor with an English browser opens the page
  Given the visitor's browser prefers English
  When the visitor opens the visitor machine page of "LG-042"
  Then the page texts and the machine status are shown in English

Scenario: Other browser languages get English
  Given the visitor's browser prefers French
  When the visitor opens the visitor machine page of "LG-042"
  Then the page texts and the machine status are shown in English

Scenario: Visitor switches the language
  Given the visitor machine page is shown in German
  When the visitor switches to English
  Then the page is shown in English
  And it stays English on the next visitor page the visitor opens

Scenario: Machine not on display
  Given the machine "LG-030" has the machine status Not on display
  When a visitor opens the visitor machine page of "LG-030"
  Then the page says that the machine is not on display
  And reporting a problem is not offered

Scenario: Changes are visible immediately
  Given a visitor opened the visitor machine page of "LG-042" while it was Playable
  And a technician has since set "LG-042" to Out of order
  When the visitor reloads the page
  Then the page shows the machine status Out of order

Scenario: No internal data in the page source
  When the page source of the visitor machine page of "LG-042" is inspected
  Then it contains no team member names, no problem report texts and no internal IDs

Scenario: Unknown museum number
  When a visitor opens the visitor machine page of "LG-999", which does not exist
  Then the page says in the visitor's language that no such machine exists

## Out of Scope
- Reporting a problem (ST-013), the count of untriaged problem reports (ST-013), titles of open defects (ST-018)
- Retired machines (ST-055)
- Legal pages (ST-064)

## Open Questions
- none
