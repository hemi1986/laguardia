---
id: ST-090
title: Dark design on every page, with a switch to light per device
type: story
context: BC-Collection
priority: should
size: M
risk: medium
events: []
depends_on: []
labels: [ui, feature:consistent-layout-dark-mode]
status: in-progress
---

## Story
As a team member, I want La Guardia to open in a dark design and to switch my device to a light one when I need it, so that the screen does not glare in the dim museum halls and the bright workshop can still have a light page.

## Context
Decided by the user in the `/feature` grilling of 2026-10-25 and the story review of 2026-10-25 (`docs/reviews/2026-10-25-story-review.md`, decision 4); yardstick `docs/product/ux-guidelines.md` **G26**, **G31**, with G6, G9, G14 and G19 (row of the switch). Changes the done story **ST-076**, whose open question was answered "light only for now, `prefers-color-scheme` is not followed" (user, 2026-09-29) – that decision is replaced, ST-076 is not reopened. Also changes the done story **ST-008** (the team navigation's „Mehr“, G19) and the print page of the done story **ST-011**. Cross-cutting, no domain event; filed under `BC-Collection` like ST-089. Findings D1–D3 of `docs/reviews/2026-10-25-ux-audit-consistency.md` are part of it.

**The design**
- **Pages open in the dark design, whatever the phone or PC is set to.** The system setting is not followed.
- **Which pages follow the device's choice:** the team pages, the login and the not-found page of the team pages show the design the device was switched to, and the dark design on a device without a choice (user, 2026-10-25, story review).
- **Which pages are always dark and offer no switch:** the visitor pages – the visitor machine page, the report form, the start page and the not-found page of the visitor pages – and the legal pages, whatever the device was switched to.
- **The switch:** an entry under „Mehr“ in the team navigation, for every team member, **between „Passwort ändern“ and „Abmelden“** (G19). It names the design it switches to: „Helles Design“ while the page is dark, „Dunkles Design“ while it is light (G14). It is a small form, so it works without JavaScript. After the tap the team member is on the same page they were on, with the same address – so a filter or search in the address of a list is kept. **Text typed into a form but not yet sent is lost by switching**, as with any other way off the page; the switch is not meant for the middle of a form.
- **The choice belongs to the device**, not to the account: switching at the workshop PC leaves the phone as it is, and the choice stays on the device after logging out and in again.
- **The page arrives in its design**: it is shown in the chosen design from the first moment, also without JavaScript, and without a script written into the page (the Content Security Policy of ST-070 stays as it is).
- **The QR sticker print page is light as a whole**, on screen and on paper, whatever the switch says – including its own controls („Drucken“, „Zurück zur Auswahl“, the count) (D2).
- **No page depends on one design** (G26): nothing has a colour of its own; every control – checkbox, radio button, choice list (also opened), date field, file chooser – is drawn in the design of the page around it, in both designs (D1); rejections and confirmations keep their icon and stay recognisable without colour in both (G6, G9).
- **Every fold looks the same** (G31, D3): „Mehr“, „Verwalten“ on the defect page, and the groups of G27 (ST-094) – one fold with the same marker, showing whether it is open or closed, in both designs.
- The team UI stays German only – no language switch on team pages (G26).

**What is checked** (lead dev, story review 2026-10-25): a page or a control "is in the dark design" when its computed colour scheme is dark (and light for the light design) – not by comparing pixels.

## Acceptance Criteria

Scenario: Pages open dark although the device is set to light
  Given a phone set to a light system design that never used the switch
  When a team member opens the machine overview and a visitor opens the visitor machine page of "LG-042"
  Then both pages are shown in the dark design

Scenario: A team member switches the device to light
  Given a team member is on the machine record of "LG-042" in the dark design
  When they open „Mehr“ and choose „Helles Design“
  Then they are on the machine record of "LG-042" again, now in the light design
  And „Mehr“ now offers „Dunkles Design“ in the same place

Scenario: Switching on a filtered list keeps the filter
  Given a team member searched the machine overview for "medieval" in the dark design
  When they choose „Helles Design“
  Then the machine overview is shown in the light design
  And it still lists only the machines matching "medieval", with "medieval" in the search field

Scenario: The switch sits between „Passwort ändern“ and „Abmelden“
  Given a helper is logged in
  When the helper opens „Mehr“
  Then the entries end with „Passwort ändern“, „Helles Design“ and „Abmelden“, in this order

Scenario: Switching works without JavaScript
  Given JavaScript is switched off in the browser
  When a team member chooses „Helles Design“ on the open defects list
  Then the open defects list is shown in the light design

Scenario: The choice belongs to the device
  Given Anna switched the workshop PC to the light design
  When Anna opens La Guardia on her phone
  Then her phone shows the dark design
  And the workshop PC still shows the light design after she logs out and in again

Scenario: The login and the team not-found page follow the device's choice
  Given a team member switched the workshop PC to the light design and logged out
  When the login is opened on the workshop PC, and a team page address that does not exist
  Then both are shown in the light design
  But on a device without a choice both are shown in the dark design

Scenario: Visitor and legal pages are always dark and offer no switch
  Given a device was switched to the light design by a team member
  When nobody is logged in and the visitor machine page of "LG-042", a legal page and a visitor page address that does not exist are opened
  Then each is shown in the dark design
  And none offers a design switch

Scenario: The sticker print page stays light
  Given a team member's device shows the dark design
  When a technician opens the print page for the QR stickers of "LG-042"
  Then the label sheet and the page's own controls are shown in the light design
  And the printout is black on white

Scenario: Native controls follow the design
  Given the dark design
  When a technician opens the registration form of a machine with the choice of the machine model opened, the form recording maintenance with its date field, and the form attaching a file with its file chooser
  Then the opened choice list, the checkboxes, the date field and the file chooser are in the dark design, like the page around them
  And in the light design the same controls are in the light design

Scenario: Every fold looks the same
  Given the dark design
  When a technician opens the defect page of an open defect
  Then „Mehr“ and „Verwalten“ show the same marker while closed
  And both show the same, different marker while open, in both designs

## Out of Scope
- A language switch on team pages (the team UI stays German, G26)
- A design choice stored in the account (decided: per device)
- Keeping typed form input across a switch of the design
- Museum colours, logo, typography

## Open Questions
- none – the login follows the device's choice and is dark without one; the team not-found page the same; visitor and legal pages are always dark (user, 2026-10-25, story review).

## Notes
- Size estimate by the requirements engineer: M (the colour tokens exist since ST-076; the work is the device choice without JavaScript, the print page, the native controls and one fold look).
- Lead dev (story review 2026-10-25): the server renders the design from a device setting before the page is sent, so no inline script is needed (ST-070); the visitor, legal and print pages must not follow that setting (a route-group decision, e.g. by the proxy); print needs a light set of colours scoped to it; one shared fold for „Mehr“, „Verwalten“ and G27's groups. Theme resolution per route group is a convention topic – the pull request names the paragraph of `.claude/skills/engineering-conventions/SKILL.md` it adds or changes.
- Built after ST-089 (order by ID within `should`).
