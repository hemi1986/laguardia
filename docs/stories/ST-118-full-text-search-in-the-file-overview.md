---
id: ST-118
title: Search the file overview by title, names and content
type: story
context: BC-Collection
priority: should
size: L
risk: medium
events: [EVT-FileAdded, EVT-FileAttached, EVT-FileDetached, EVT-FileDetailsChanged, EVT-FileRemoved, EVT-FileIndexedForAi, EVT-FileLeftAiIndex]
depends_on: [ST-117, ST-119, ST-106]
labels: [feature:files, ui]
status: in-progress
---

## Story
As a team member, I want to type what I remember – part of a title, a file name, a machine or a word from inside a manual – so that I find the file without knowing how it was filed.

## Context
Feature `files` (`docs/domain/events.yaml` **RM-FileOverview**; `docs/domain/context-map.md`, *The file overview: searching
over Collection and AI assistance*; `docs/architecture/data-model.md`, *Content search in the file overview*, *Name of an
attachment in the search*; `docs/adr/0018-files-without-an-owner.md`; `docs/product/ux-guidelines.md` **G4**, **G32**, **G40**,
**G7**). Adds to the page ST-117 owns. Team members only, like the page.

**Two modules, the page composes (context map, ADR 0018).** Filed under BC-Collection, but it touches **BC-AiAssistance**:
- **Collection** publishes one query: every file not removed that passes the filters, and per word whether and how well
  its own text matches, computed when read.
- **AI assistance** publishes one query, `files containing these words`: per word, the files with a passage that contains
  it, and the rank of their best passage. It reads the stored words of passages of **indexed** entries, **whatever their
  embedding model**, needs no AI settings and makes no request to OpenRouter. It knows nothing of the overview. The words
  of existing passages are searchable as soon as the migration has run: nothing is indexed again.
- The **page data function** merges by file ID in memory. No query joins the two modules' tables.

**What is searched:** the title, the original file name, the names of what the file is attached to – for a machine its
museum number and its machine model's title, for a machine model its title, always the current values, a retired
machine's too – and the text of the passages of indexed files. Manufacturer and serial number are not searched. So a
manual attached to the machine model alone is not found by the museum number of one of its machines; the filter
„Angehängt an“ does that (HS-36).

**Words:** punctuation separates words („LG-042“, „medieval_manual-v2.pdf“). German and English word forms together
(„Spule“ finds „Spulen“, „coil“ finds „coils“). A file matches when **every word** is found in at least one of these places,
not all in the same one. No OCR, no search by meaning, no compound splitting: „Plan“ does not find „Schaltplan“. An
empty search, or one of punctuation only, is no search: the list stays as in ST-117.

**Order:** without search words newest first (ST-117). With them, best match first: by how many of the words are found in
the file's own data, then that rank, then the rank of the content, then newest. The two ranks are never added up.

**Form (G32):** one form „Suche“ with the button „Suchen“, above the filters of ST-117, which stay their own form with
„Filtern“. Each form keeps the other's values in what it sends, both stay in the address, a new search starts at page 1,
and „Zurück“ and „Weiter“ keep both (G40). The count says how many match.

**It says what it searches (under the field):** „Sucht im Titel, im ursprünglichen Dateinamen, in den Namen der Geräte und
Modelle und im Inhalt – im Inhalt nur bei Dateien, die für die KI erfasst sind. Gescannte Seiten ohne Text werden dort nicht
gefunden.“ The sentence and the content search stay while AI is off, since what was indexed stays searchable (context map).

**Nothing found (G7):** „Keine Datei passt zu dieser Suche.“ with „Alle Dateien anzeigen“; the words and filters stay as sent.

## Acceptance Criteria

Scenario Outline: A file is found by its own data and by what it is attached to
  Given "MM Operations Manual" with the original file name "medieval_manual-v2.pdf" is attached to "LG-042" of the machine model "Medieval Madness"
  And "Eight Ball Notes" is attached to "LG-050" of the machine model "Eight Ball"
  When a team member searches for „<words>“
  Then "MM Operations Manual" is listed and "Eight Ball Notes" is not

  Examples:
    | words              |
    | Operations         |
    | medieval_manual    |
    | LG-042             |
    | Medieval Madness   |

Scenario: A file is found by the content of its indexed passages
  Given "Backbox schematic" was indexed before this search was built, and page 12 of it mentions „Spulen“
  And no file holds that word in its title or names
  When a team member searches for „Spule“
  Then "Backbox schematic" is listed
  And nothing was indexed again and no request went to OpenRouter

Scenario: Every word must be found, not all in the same place
  Given "Service guide" is attached to the machine model "Medieval Madness" and its passages mention „Spulen“
  And "Other guide" is attached to "Eight Ball" and its passages mention „Spulen“
  When a team member searches for „Medieval Spule“
  Then "Service guide" is listed and "Other guide" is not

Scenario: A word in a file's own data comes before the same word in the content only
  Given the older file "Coil chart" has the word in its title, and the newer file "Service guide" mentions „coil“ only on page 340
  When a team member searches for „coil“
  Then "Coil chart" is listed before "Service guide"

Scenario: The page says that only the content of indexed files is searched
  Given AI is on, "A" is indexed and mentions „Relais“, "B" waits and "C" failed, and both would mention „Relais“
  When a team member searches for „Relais“
  Then only "A" is listed
  And the page says that content is searched only in files indexed for the AI

Scenario: A scanned PDF is not found by its content
  Given the indexed PDF "Scanned schematic" has a page that shows „Netzteil“ only as an image, without a text layer
  When a team member searches for „Netzteil“ and then for „Scanned“
  Then the first search does not list it
  And the second one does

Scenario: Content stays searchable while AI is off
  Given "Backbox schematic" is indexed and mentions „Spulen“, and a technician removed the key, so AI is off
  When a team member searches for „Spule“
  Then "Backbox schematic" is listed, without an AI index state
  And no request goes to OpenRouter
  And the same holds with AI on while another embedding model is indexing the file again

Scenario: Search, filters and pages work together
  Given 30 manuals and 5 schematics mention „Relais“, and 10 further manuals do not
  When a team member searches for „Relais“, chooses „Handbuch“, taps „Filtern“ and then „Weiter“, without JavaScript
  Then the page says „30 Dateien · Seite 2 von 2“ and lists 5 manuals
  And the address holds the words, the filter and the page, and „Relais“ and „Handbuch“ are still chosen
  And a new search from there starts at page 1 and keeps „Handbuch“

Scenario: A corrected name is found at once and a removed file no longer
  Given "Own notes" is attached to the machine "LG-042" of the machine model "Medieval Madness" and "Old manual" mentions „Spulen“
  When a technician corrects the machine model's title to "Medieval Madness Remake" and removes "Old manual"
  Then a search for „Remake“ lists "Own notes"
  And a search for „Spule“ does not list "Old manual"

Scenario: Nothing found says so and keeps the words
  Given no file holds „Zylinderkopf“
  When a team member searches for „Zylinderkopf“
  Then the page says „Keine Datei passt zu dieser Suche.“ with „Alle Dateien anzeigen“
  And „Zylinderkopf“ is still filled in

## Out of Scope
- OCR, search by meaning, compound splitting, a search index in a place of its own (`docs/product/vision.md`, ADR 0018)
- Showing where in a file the word was found
- Words in a failed file's entry: a failed entry holds no passages

## Open Questions
- none

## Notes
- A stored word list per passage is added beside the existing passages with a migration; „German and English word forms together“ and how it is stored are for the test plan (ADR 0018: PostgreSQL full-text search).
- Definition of done: the module boundary holds – Collection names no AI, and no query joins the two modules (`docs/architecture/boundaries.yaml`, conventions, *Reading across modules – the page composes*).
- The original file name is available since ST-113; ST-119 shows it.
- **Built after ST-119 (user, 2026-11-02, story review decision 3):** the story is `should` like ST-119, and within a priority the lower ID goes first, so `depends_on: ST-119` fixes the order. It is an order the user asked for, not a technical need: nothing here uses ST-119's form.
- The sentence under the field says content is searched only in files indexed for the AI. A file that waits for the current embedding model while holding entries of an older one is still found by its content (scenario "Content stays searchable while AI is off"). The small imprecision is accepted: the sentence stays as it is.
