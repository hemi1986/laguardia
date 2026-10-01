---
id: ST-011
title: QR sticker leads visitors and team members to the machine
type: story
context: BC-Collection
priority: must
size: M
risk: medium
events: [EVT-MachineRegistered]
depends_on: [ST-009, ST-010, ST-060]
labels: [mvp, collection, visitor, ui]
status: ready
---

## Story
As a technician, I want to print a QR sticker with the museum number for a machine, so that visitors reach the visitor machine page and team members reach the machine record by scanning it with their phone camera.

## Context
- `docs/product/vision.md`: visitors report via a QR code on each machine. `CONTEXT.md`: the museum number is printed on the QR sticker.
- The QR code contains the stable address on the museum's custom domain (ST-060, decision D9), e.g. `/m/LG-042`; no sticker is printed before the custom domain exists. It is scanned with the phone's camera app, no special app (`docs/adr/0001-tech-stack.md`).
- The same address opens the machine record for a logged-in team member and the visitor machine page for everyone else. It is never served from a shared cache, so a visitor never gets a team member's page and vice versa.
- Every sticker carries a short prompt in German and English, "Problem? Scan mich!" / "Problem? Scan me!" (decision D14), next to the QR code and the museum number.
- Stickers are printed from a printable page for one or several selected machines, sized for a common A4 label sheet; the team names the label product the museum uses before the first print.

## Acceptance Criteria

Scenario: Technician prints a QR sticker
  Given the machine "LG-042" is registered
  When a technician prints the QR sticker of "LG-042"
  Then the sticker shows a QR code, the museum number "LG-042" in readable text and the prompt in German and English

Scenario: The QR code contains the stable address
  When the QR code on the sticker of "LG-042" is decoded by an automated test
  Then it contains the address of "LG-042" on the museum's custom domain

Scenario: Technician prints stickers for several machines on one label sheet
  Given the machines "LG-042", "LG-043" and "LG-044" are registered
  When a technician prints the QR stickers of these three machines together
  Then one printable A4 page shows three stickers, each with its QR code, museum number and prompt, placed on the label positions of the chosen label sheet

Scenario: Visitor scans the sticker
  Given nobody is logged in on the phone
  When the QR sticker of "LG-042" is scanned with the phone's camera app
  Then the visitor machine page of "LG-042" opens

Scenario: Team member scans the sticker
  Given a team member is logged in on the phone
  When the QR sticker of "LG-042" is scanned
  Then the machine record of "LG-042" opens

Scenario: Visitor and team member scan one after the other
  Given a team member scanned the sticker of "LG-042" and saw the machine record
  When a visitor scans the same sticker a moment later on another phone
  Then the visitor sees the visitor machine page, not the machine record

Scenario: No machine chosen for printing
  When a technician asks to print QR stickers without choosing a machine
  Then no printable page is produced
  And the technician is asked to choose at least one machine

Scenario: Finding the machines to print for
  Given 60 machines are registered
  When a technician chooses the machines to print stickers for
  Then the machines can be narrowed by museum number or machine model title, as in the machine overview
  And how many machines are chosen is shown next to the way to print

Scenario: Retired machines get no sticker
  Given the machine "LG-013" is retired
  When a technician tries to print the QR sticker of "LG-013"
  Then no sticker is offered

## Out of Scope
- Reprinting after a museum number correction (ST-035)

## Open Questions
- none
