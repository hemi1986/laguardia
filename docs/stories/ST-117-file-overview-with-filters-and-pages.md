---
id: ST-117
title: Find a file in the file overview with filters and pages
type: story
context: BC-Collection
priority: should
size: L
risk: medium
events: [EVT-FileAdded, EVT-FileAttached, EVT-FileDetached, EVT-FileDetailsChanged, EVT-FileRemoved]
depends_on: [ST-114, ST-121]
labels: [feature:files, ui]
status: in-progress
---

## Story
As a team member, I want one page with every file of the museum that I can narrow by file category, by what it is attached to and by how far the AI index got, so that I find a file without knowing which machine it is attached to, also one attached to nothing.

## Context
Feature `files` (`docs/domain/events.yaml` **RM-FileOverview**, resolved **HS-36**; `CONTEXT.md` *File overview*;
`docs/domain/context-map.md`, *The file overview*; `docs/product/ux-guidelines.md` **G19 row 8a**, **G40**, **G18** Files
block, **G4**, **G5**, **G32**, **G37**, **G20**, **G7**). This story owns the page (G18); ST-118 adds the search, ST-119
„Datei hinzufügen“. No text search here.

**One job:** finding a file. **Entry point:** „Dateien“ under „Mehr“, directly after „Modelle“, for everyone (G19 row 8a).
Heading „Dateien“.

**The page, top down:** how many files match, the filters, the entries, „Zurück“ and „Weiter“. „Datei hinzufügen“ takes its
place directly under the heading with ST-119.

**Count (G4, G40):** the total of what matches, not of the page: „42 Dateien“, „1 Datei“, with more than one page
„42 Dateien · Seite 2 von 2“.

**An entry (G18, G5):** the title, which leads to the file details and is the only action; below it „Handbuch · PDF ·
12,4 MB · Für die KI erfasst“ (media type texts from ST-114). The AI index state is „Für die KI erfasst“, „Wartet auf
KI-Erfassung“ or „Für die KI nicht lesbar“ – the reason belongs to the file details – and is absent while AI is off (G37).
What a file is attached to is deliberately not shown here (G18). *Added at* orders the list and is not shown (G18, G5).

**Way back (user, 2026-11-02; ST-114, ST-121):** „Dateien“ is the third origin of the closed set. Coming from an entry, the
file details offer „Zurück zu den Dateien“ to this page with its filters and page, and a removal lands there with its
confirmation. The origin holds only this page's own known parameters, nothing else from the address. From here on, file
details without a known origin offer „Zurück zu den Dateien“ and a removal lands on the first page of „Dateien“, in place of the machine
overview.

**Order and pages (G40):** newest first; 25 to a page, with the buttons „Zurück“ and „Weiter“ under the entries, each only
when there is a page to go to. Works without JavaScript; the filters and the page stay in the address. An address with
a page past the end shows the last page.

**Removed files** are not listed; files attached to nothing are.

**Filters (G32, G20), one form sent with „Filtern“; combined they must all hold; sending them starts at page 1:**
- **„Dateikategorie“:** „Alle Dateikategorien“ (preselected), „Handbuch“, „Schaltplan“, „Foto“, „Sonstiges“.
- **„Angehängt an“:** „Alle“ (preselected), „Nirgends angehängt“, then the group „Geräte“ with „LG-042 · Medieval
  Madness“ by museum number, with retired machines at its end as „LG-041 · Ausgemustert“ (user, 2026-11-02), then the group
  „Modelle“ with „Medieval Madness“ by title. „Nirgends angehängt“ is an option of this one choice rather than a checkbox
  of its own, because together with a machine it could only ever find nothing.
- **„KI-Erfassung“, absent while AI is off (G37):** „Alle“ (preselected), „Für die KI erfasst“, „Wartet auf
  KI-Erfassung“, „Für die KI nicht lesbar“. While AI is off, such a value in a bookmarked address is ignored.

**What the filter „Angehängt an“ finds (HS-36):** a machine – what its machine record shows, attached to it or to its
machine model; a machine model – what is attached to it or to any of its machines, retired ones included. The file
details say exactly what a file is attached to.

**Empty cases (G7):** no file at all: „Noch keine Dateien. Eine Datei kommt über „Datei anhängen“ auf der Seite eines
Geräts dazu.“ with a link to „Geräte“ – replaced when ST-119 brings „Datei hinzufügen“. Nothing matches: „Keine Datei passt
zu diesen Filtern.“ with „Alle Dateien anzeigen“, and the filters stay as sent.

**Read model:** RM-FileOverview lives in Collection; the page adds the AI index state from AI assistance
(`aiIndexStatesOfFiles`), for the 25 shown, or for all that remain when the state filter is set
(`docs/domain/context-map.md`, steps 3 and 5).

## Acceptance Criteria

Scenario: A helper finds every file in the overview
  Given the files "Old manual" (removed), "Wiring notes" (attached to nothing, added yesterday) and "MM Operations Manual" (a PDF of 12.4 MB, file category Manual, indexed, added today)
  When a helper opens „Dateien“ under „Mehr“
  Then the page says „2 Dateien“ and lists "MM Operations Manual" before "Wiring notes"
  And the entry of "MM Operations Manual" says „Handbuch · PDF · 12,4 MB · Für die KI erfasst“, names nothing it is attached to, and its title leads to its file details
  And "Old manual" is not listed

Scenario: A long list is paged and keeps its filters
  Given 60 files, 30 of them with the file category Manual
  When a team member filters by „Handbuch“ and taps „Weiter“, without JavaScript
  Then the page says „30 Dateien · Seite 2 von 2“ and lists the 5 oldest manuals
  And „Zurück“ is offered and „Weiter“ is not
  And „Zurück“ leads to the first 25 manuals, and the address holds the filter and the page
  And an address with page 9 shows page 2

Scenario: Filtering by file category
  Given a manual, a schematic and a photo exist
  When a team member chooses „Schaltplan“ and taps „Filtern“
  Then only the schematic is listed and the page says „1 Datei“

Scenario Outline: The filter „Angehängt an“ finds what the machine record shows, what belongs to the machine model, and what is attached to nothing
  Given "Model manual" is attached to the machine model "Medieval Madness", "Own notes" to its machine "LG-042", "Retired notes" to its retired machine "LG-041", and "Other notes" to "LG-050" of another machine model
  And "Wiring notes" is attached to nothing
  When a team member chooses „<option>“ under „Angehängt an“ and taps „Filtern“
  Then exactly <files> are listed

  Examples:
    | option                    | files                                           |
    | LG-042 · Medieval Madness | "Model manual" and "Own notes"                  |
    | LG-041 · Ausgemustert     | "Model manual" and "Retired notes"              |
    | Medieval Madness          | "Model manual", "Own notes" and "Retired notes" |
    | Nirgends angehängt        | "Wiring notes"                                  |

Scenario: The file details lead back to the overview as it was
  Given a technician has filtered „Dateien“ by „Handbuch“ and gone to page 2
  When the technician opens the file details of an entry there
  Then the page offers „Zurück zu den Dateien“, which leads to „Handbuch“, page 2
  And removing that file lands there with its confirmation
  And file details without a known origin, a foreign web address or a foreign filter value included, offer „Zurück zu den Dateien“, and a removal from them lands on the first page of „Dateien“

Scenario: Filtering by how far the AI index got
  Given AI is on, "A" is indexed, "B" waits and "C" failed
  When a team member chooses „Für die KI nicht lesbar“ under „KI-Erfassung“ and taps „Filtern“
  Then only "C" is listed, saying „Für die KI nicht lesbar“

Scenario: While AI is off neither the state nor its filter is shown
  Given "A" is indexed and "C" failed, and a technician removed the key, so AI is off
  When a team member opens „Dateien“, also through an address that holds the state filter „Für die KI nicht lesbar“
  Then no entry says anything about the AI index, and the filter „KI-Erfassung“ is not shown
  And both "A" and "C" are listed
  And once AI is turned on again the state and the filter are shown as before

Scenario: No file yet says what to do
  Given no file exists, or only removed ones
  When a team member opens „Dateien“
  Then the page says „Noch keine Dateien. Eine Datei kommt über „Datei anhängen“ auf der Seite eines Geräts dazu.“ with a link to „Geräte“
  And it lists no entry and offers no „Zurück“ or „Weiter“

Scenario: No match says so and keeps the filters
  Given only manuals exist
  When a team member chooses „Foto“ and taps „Filtern“
  Then the page says „Keine Datei passt zu diesen Filtern.“ with „Alle Dateien anzeigen“
  And „Foto“ is still chosen

Scenario: Someone not logged in does not reach the overview
  Given "MM Operations Manual" exists
  When someone not logged in opens the address of „Dateien“
  Then the person is sent to the login and sees nothing of the files

## Out of Scope
- Text search (ST-118), „Datei hinzufügen“ (ST-119)
- Attaching, detaching or removing from the list (G5); these are on the file details
- Choosing the order, a preview, several files at once

## Open Questions
- none

## Notes
- First paged list: G40 is built here (G15) and tested once here.
- A file attached to nothing comes about only by detaching (ST-115) until ST-119; the scenarios set it up in the test's data, so this story does not depend on ST-115. It depends on ST-121 because a removal lands here.
- **Done scenarios this story supersedes** (`docs/engineering/conventions.md`, *A scenario of a done story that a later story supersedes*), because without an origin the way back and the landing become „Dateien“: ST-114 "Without a known origin the way back leads to the machines" and ST-121 "A removal without a known origin lands on the machine overview" go into `docs/stories/superseded-scenarios.json`, and their tests go with this story's change.
- In the filter's group „Geräte“ the order is museum number, retired machines last; in „Modelle“ title (test plan).
- `RM-FileOverview`'s fields name *Added at*; G18's entry does not. G18 is followed as instructed: it orders the list and is not shown.
- Without text search the data function is a plain query; ST-118 adds the merging.
