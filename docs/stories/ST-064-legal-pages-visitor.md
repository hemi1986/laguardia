---
id: ST-064
title: Legal pages for the visitor pages in German and English
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: []
depends_on: [ST-010]
labels: [mvp, visitor, ui]
status: in-progress
---

## Story
As a visitor, I want to read the privacy notice and the museum's imprint in German or English from every visitor page, so that I know who runs the page and what happens to my problem report and photo.

## Context
Story review 2026-09-26 (NEW-1). The visitor pages are public and visitor photos may show people (`docs/adr/0005-hosting-vercel.md`).
- The texts are provided by the museum in German and English; La Guardia shows them. The museum also decides whether an imprint is needed; if the museum provides one, it is shown.
- The privacy notice covers problem reports and their photos: no contact data is collected, photos have their location metadata removed, only team members see them, and a photo is kept as long as its problem report (ST-016).
- The language follows the visitor machine page (ST-010).

## Acceptance Criteria

Scenario: Visitor opens the privacy notice
  Given a visitor with a German browser is on the visitor machine page of "LG-042"
  When the visitor opens the privacy notice
  Then the museum's privacy notice is shown in German

Scenario: Legal pages in English
  Given the visitor has switched the visitor pages to English
  When the visitor opens the privacy notice or the imprint
  Then the English text is shown

Scenario: Legal pages are reachable from every visitor page
  When a visitor opens the visitor machine page, the report form or the confirmation after reporting
  Then the privacy notice and, if provided, the imprint can be opened from there

Scenario: Imprint only if the museum provides one
  Given the museum has not provided an imprint text
  When a visitor opens a visitor page
  Then no imprint is offered

## Out of Scope
- Writing the legal texts (the museum provides them)
- Legal pages for the team area

## Open Questions
- none
