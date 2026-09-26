---
id: ST-011
title: QR sticker leads visitors and team members to the machine
type: story
context: BC-Collection
priority: should
size: null
risk: null
events: [EVT-MachineRegistered]
depends_on: [ST-009, ST-010]
labels: [mvp, collection, visitor]
status: review
---

## Story
As a technician, I want to print a QR sticker with the museum number for a machine, so that visitors reach the visitor machine page and team members reach the machine record by scanning it with their phone camera.

## Context
- `docs/product/vision.md`: visitors report via a QR code on each machine. `CONTEXT.md`: the museum number is printed on the QR sticker.
- The QR code contains a stable web address with the museum number (`docs/adr/0004-team-authentication.md`: visitor pages are addressed by museum number); it is scanned with the phone's camera app, no special app (`docs/adr/0001-tech-stack.md`).
- The same address opens the machine record for a logged-in team member and the visitor machine page for everyone else.
- Stickers are printed from a printable page for one or several selected machines, sized for a common A4 label sheet; the team names the label product the museum uses.

## Acceptance Criteria

Scenario: Technician prints a QR sticker
  Given the machine "LG-042" is registered
  When a technician prints the QR sticker of "LG-042"
  Then the sticker shows a QR code and the museum number "LG-042" in readable text

Scenario: Technician prints stickers for several machines on one label sheet
  Given the machines "LG-042", "LG-043" and "LG-044" are registered
  When a technician prints the QR stickers of these three machines together
  Then one printable A4 page shows three stickers, each with its QR code and museum number, placed on the label positions of the chosen label sheet

Scenario: Visitor scans the sticker
  Given nobody is logged in on the phone
  When the QR sticker of "LG-042" is scanned with the phone's camera app
  Then the visitor machine page of "LG-042" opens

Scenario: Team member scans the sticker
  Given a team member is logged in on the phone
  When the QR sticker of "LG-042" is scanned
  Then the machine record of "LG-042" opens

Scenario: Retired machines get no sticker
  Given the machine "LG-013" is retired
  When a technician tries to print the QR sticker of "LG-013"
  Then no sticker is offered

## Out of Scope
- Reprinting after a museum number correction (ST-035)

## Open Questions
- none
