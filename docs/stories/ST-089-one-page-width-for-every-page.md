---
id: ST-089
title: One page width for every page, with fields and submit buttons across the column
type: story
context: BC-Collection
priority: should
size: S
risk: low
events: []
depends_on: []
labels: [ui, feature:consistent-layout-dark-mode]
status: ready
---

## Story
As a technician at the workshop PC, I want every page to have the same width, so that going from a list to its form and back does not make the page jump and every form looks like the same application.

## Context
Decided by the user in the `/feature` grilling of 2026-10-25; yardstick `docs/product/ux-guidelines.md` **G16** as changed that day. Changes the done stories **ST-076** (the shared page container with a narrow default) and **ST-008** (O2: only list pages grow to ~672 px); neither is reopened. Cross-cutting – filed under `BC-Collection` because the machine pages are most of the pages; no domain event changes.

- **Every page – list, form, record, dashboard, the login, the visitor pages, the legal pages and the not-found pages – has the same content column of at most 672 px** (what a list page has today). **What is measured:** the width of the content column – the box the page's heading, fields, lists and sections sit in, without the page's outer margin. In a window wide enough it is 672 px; in a narrower window it is the window minus the outer margin. One column, no side-by-side columns, as before.
- **On a form page with input fields, the fields use the whole width of that column, and so does its submit button** (G16). This is about form pages only: a filter form on a list (its „Filtern“), a one-tap button (claiming, „Konto deaktivieren“) and buttons on a record or a list stay as wide as their words.
- **Pages made for printing follow the paper**, not this rule: the QR sticker print page keeps its own layout (ST-011).
- Every page still works at 360 px without sideways scrolling.
- The team navigation already has the wide width; it lines up with every page afterwards.

Definition of done (not a scenario): `.claude/skills/engineering-conventions/SKILL.md`, the paragraph on `Page`, follows G16 – one width for every page; the sentence "A list page passes `wide` … a form page does not" goes. The conventions are approved by the user (CLAUDE.md), so the pull request names the changed paragraph (*Page*).

## Acceptance Criteria

Scenario: A list and its form page have the same width
  Given the workshop PC shows the team pages in a window 1280 px wide
  When a technician opens the maintenance plan and then „Wartungsaufgabe hinzufügen“
  Then the content column of both pages is 672 px wide
  And it starts at the same left edge on both pages, lined up with the team navigation

Scenario: Records, dashboards, login, visitor, legal and not-found pages have the one width
  Given a window 1280 px wide
  When the machine record, the defect page, the technician dashboard, the login, the visitor machine page, a legal page and the not-found page are opened one after the other
  Then the content column of each page is 672 px wide

Scenario: Fields and the submit button span the column of a form page
  Given a window 1280 px wide
  When a technician opens the registration form of a machine
  Then every text field and choice spans the whole width of the content column
  And „Gerät erfassen“ spans the whole width of the content column too

Scenario: Filter forms, one-tap buttons and buttons on a record stay as wide as their words
  Given a window 1280 px wide
  When a technician opens the due maintenance list with its filter, the defect page of an unclaimed defect and the machine record of "LG-042"
  Then „Filtern“, „Übernehmen“ and „Status ändern“ are each only as wide as their words

Scenario: The sticker print page follows the paper
  Given a technician chose three machines for QR stickers
  When the print page is opened in a window 1280 px wide
  Then the label sheet keeps its paper size and is not narrowed to the 672 px column of the other pages

Scenario: No page scrolls sideways at 360 px
  Given a phone 360 px wide
  When a form page with a rejection shown, a list page and the machine record are opened
  Then none of them is wider than 360 px

## Out of Scope
- Dark design (ST-090)
- A second layout for the workshop PC – it shows the same screen (G16)

## Open Questions
- none

## Notes
- Size estimate by the requirements engineer: S (one container, the submit buttons of the account forms, the conventions paragraph). Built after the maintenance chain (ST-094–ST-098) and ST-088, then before ST-090 and the consistency stories ST-091/ST-092 (user, story review 2026-10-25, decision 3) – the order follows from priority and IDs, no dependency needed.
