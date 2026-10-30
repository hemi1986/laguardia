---
id: ST-092
title: Sections, lists, filters and links take one shape on every page
type: story
context: BC-Repair
priority: should
size: L
risk: medium
events: []
depends_on: [ST-091]
labels: [ui, feature:consistent-layout-dark-mode]
status: in-progress
---

## Story
As a technician, I want the machine record, the defect page, the dashboards and the lists to be built from the same pieces, so that I find things in the same place on every page and red means only "this cannot be undone".

## Context
The shape-level findings of the consistency audit `docs/reviews/2026-10-25-ux-audit-consistency.md` – **F1, F3, F5, F6, F7, F11, F12, F13, F14, F15** – all accepted by the user in the `/feature` grilling of 2026-10-25, with the new rules of that day: **G29** (sections framed, with a title), **G30** (red only on the question page), **G32** („Filtern“), and G1, G3, G5, G15, G17, G25. The word-level findings are ST-091 (built first – this story's pages carry its headings); F2 (status history) is ST-093; F16 (choices in groups) is ST-098. No behaviour of a command and no domain event changes. Changes the screens of done stories – among them ST-021, ST-033, ST-043, ST-047, ST-048, ST-051, ST-055, ST-058, ST-011, ST-038, ST-039, ST-041, ST-017, ST-064, ST-010 – none is reopened. Filed under `BC-Repair` because the defect page and the dashboards carry most of it. The story stays one story (user, story review 2026-10-25, decision 2: no split).

**What "the same shape" means here** (measurable): two things have the same shape when they are drawn with the same component and therefore the same colours, frame, size of text and heading level – checked against a named example on the pages that already have it (the machine record's sections, „Status ändern“ as the secondary button, „Zurück zum Gerät“ as the back link, the due maintenance filter's checkbox).

**F5 / G29 – one shape for a section of a record or a dashboard:** a frame with its title at the top, the same heading level everywhere, the section's empty sentence under it when there is nothing (G7), and its one link or button at its end. The machine record and both dashboards already have it; it comes to the defect page, the repair history's own page, the maintenance records' own page („Wartungseinträge · LG-042“), the repair times and the problem report's page in the triage.

**F11 / G30 – red only for what cannot be undone:** only the verb on a question page is red – „Endgültig ausmustern“, „Endgültig entfernen“ (file, maintenance task), „Endgültig verwerfen“. Every way *to* a question – „Gerät ausmustern“, „Wartungsaufgabe entfernen“, a file's „Entfernen“ (today a grey text link) – has the shape of any other secondary button. („Konto deaktivieren“ loses its red with ST-088.)

**F6 / G32 – a filter is applied with „Filtern“:** the team members list's „Anzeigen“ becomes „Filtern“; on the machine overview „Auch ausgemusterte Geräte anzeigen“ gets the button „Filtern“ of its own, so it takes effect without „Suchen“ and keeps a search already made – and a search keeps the ticked filter. The filter forms of the team members, the machine overview, the open defects and the due maintenance have one shape: their fields, then „Filtern“ as wide as its words.

**F7 – one shape for a search:** the sticker selection's search gets the machine overview's shape – the visible label „Suche“ and the hint below the field, not inside it.

**F1 / G25 – change lines on the technician dashboard** take the helper dashboard's shape – the thing, then „ · “, what happened „von“ whom, then „ · vor …“ in the helper dashboard's words of time („… · <what> von <who> · vor …“). Exactly:
- a status change: „LG-042 · Spielbereit → Außer Betrieb von Tom · vor 2 Tagen“
- a defect resolved or reopened: „„Flipper links schwach“ an LG-042 · behoben von Tom · vor 3 Stunden“ / „„Flipper links schwach“ an LG-042 · wieder geöffnet von Tom · vor 3 Stunden“

**F3 – the defect's page is headed by the defect's title** (G1), like every other record; the machine stays the link right under it.

**F14 – one shape per kind of entry** (G5, G15): a defect is its title as the link, with the machine on the line below (the open defects' entry) – also among the stale claims; a machine is „LG-042 · Medieval Madness“ as one link (the machine overview's entry) – also in the technician dashboard's section of machines not playable without open defects and in the due maintenance list's machines.

**F12 – the confirmation after creating sits first under the heading** (G3), above the button – also on the maintenance plan, where it sits below the button today.

**F13 – every page has a way on** (G17): the sticker selection gets „Zurück zu den Geräten“; the login, the legal pages and the visitor page of a retired machine get „Zur Startseite“ (English on visitor pages: „To the start page“, as on the not-found pages).

**F15 – one shape for back links and checkboxes:** back links are the small underlined link of the other pages, also on the defect page and in the "nothing found" cases of the open defects and the machine overview; on „Gerät erfassen“ the back link is as wide as its words. Checkboxes have one size everywhere, the sticker selection included.

## Acceptance Criteria

Scenario: The defect page is built from framed sections and headed by its title
  Given the defect "Left flipper weak" on "LG-042" has two work log entries
  When a team member opens the defect's page
  Then the page is headed "Left flipper weak", with "LG-042 · Medieval Madness" as the link right under it
  And each of its sections has the frame of the machine record's sections, with its title at the same heading level

Scenario: The history pages and the repair times are built from framed sections
  When a technician opens the repair history of "LG-042", „Wartungseinträge · LG-042“ and the repair times
  Then each section on them has the frame of the machine record's sections, with its title at the same heading level

Scenario: An empty section says so in its frame
  Given the defect "Left flipper weak" has no work log entry yet
  When a team member opens the defect's page
  Then its section of work log entries shows its title and the sentence that no work has been logged yet, inside its frame

Scenario: Only the verb of a question page is red
  Given a technician is on the machine record of "LG-042", which has the file "Manual"
  When the technician looks at „Gerät ausmustern“ and the file's „Entfernen“, and then opens the question before retiring
  Then „Gerät ausmustern“ and „Entfernen“ have the shape of the secondary button „Status ändern“ – not red and not a text link
  And on the question page only „Endgültig ausmustern“ is red

Scenario: The retired machines filter does not need the search
  Given "LG-013" is retired and the search field of the machine overview is empty
  When a team member ticks „Auch ausgemusterte Geräte anzeigen“ and applies it with „Filtern“
  Then "LG-013" is listed, marked „Ausgemustert“

Scenario: Filtering keeps the search
  Given a team member searched the machine overview for "medieval"
  When they tick „Auch ausgemusterte Geräte anzeigen“ and apply it with „Filtern“
  Then only machines matching "medieval" are listed, retired ones included
  And "medieval" is still in the search field

Scenario: Searching keeps the filter
  Given a team member ticked „Auch ausgemusterte Geräte anzeigen“ on the machine overview and applied it with „Filtern“
  When they search for "medieval"
  Then only machines matching "medieval" are listed, retired ones included
  And „Auch ausgemusterte Geräte anzeigen“ is still ticked

Scenario: The team members list is filtered with „Filtern“
  Given "Ben Weber" has a deactivated account
  When a technician ticks „Auch deaktivierte Konten anzeigen“ and applies it
  Then the button that applies it reads „Filtern“ and is as wide as its words
  And "Ben Weber" is listed, marked „Deaktiviert“

Scenario: The sticker selection's search is labelled like the machine overview's
  When a technician opens the sticker selection and types "042" into the search
  Then the field is labelled „Suche“ and its hint stays visible below it

Scenario: Change lines on the technician dashboard say what, who and how long ago
  Given Tom changed "LG-042" from Playable to Out of order 2 days ago and resolved "Flipper links schwach" on "LG-042" 3 hours ago
  When another technician opens the technician dashboard
  Then the recent changes read „„Flipper links schwach“ an LG-042 · behoben von Tom · vor 3 Stunden“ and „LG-042 · Spielbereit → Außer Betrieb von Tom · vor 2 Tagen“, in this order

Scenario: A machine is one link everywhere
  Given "LG-042" (Medieval Madness) is Out of order without open defects and "Clean glass (inside & out)" is due on it
  When a technician opens the technician dashboard and the due maintenance of "Clean glass (inside & out)"
  Then on both pages "LG-042 · Medieval Madness" is one link to its machine record

Scenario: A stale claim is listed like an open defect
  Given Anna claimed "Display flickers" on "LG-020" 15 days ago and logged no work since
  When a technician opens the technician dashboard
  Then "Display flickers" is the link to the defect and the machine is on the line below it

Scenario: The confirmation after adding a maintenance task sits under the heading
  When a technician adds the maintenance task "Wax playfield"
  Then on the maintenance plan the confirmation „„Wax playfield“ ist jetzt im Wartungsplan.“ is the first thing under the heading, above „Wartungsaufgabe hinzufügen“

Scenario: Pages without a way on get one
  When a technician opens the sticker selection, and a visitor opens the login, a legal page and the visitor page of the retired machine "LG-013"
  Then the sticker selection offers „Zurück zu den Geräten“
  And the login, the legal page and the retired machine's page offer „Zur Startseite“

Scenario: Back links have one shape
  When a technician opens the defect page, „Gerät erfassen“ and the machine overview after a search for "jukebox" that matches no machine
  Then the back links and the link clearing the search have the shape of „Zurück zum Gerät“ on the machine record pages
  And on „Gerät erfassen“ the back link is as wide as its words

Scenario: Checkboxes have one size
  When a technician opens the sticker selection and the due maintenance list with its filter
  Then the checkboxes of the sticker selection have the size of the filter's checkbox „Nur für Helfer:innen geeignet“

## Out of Scope
- Texts of headings and buttons (ST-091)
- The status history on the machine record (ST-093)
- Grouping the sticker selection and recording for several machines (ST-098)
- Sections of the legal pages (not records; G29 is about records and dashboards)

## Open Questions
- none

## Notes
- Size L (lead dev, story review 2026-10-25). The lead dev proposed a split – records and dashboards (F1, F3, F5, F14, building the shared section and G29) / lists, filters and links (F6, F7, F11, F12, F13, F15); the user decided no split (decision 2). The pull request can still follow that order internally.
- Depends on ST-091 because both change the same pages' texts and tests; ST-091 goes first.
