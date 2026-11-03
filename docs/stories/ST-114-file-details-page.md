---
id: ST-114
title: See a file's details
type: story
context: BC-Collection
priority: should
size: L
risk: medium
events: [EVT-FileIndexingRetried]
depends_on: [ST-113, ST-038, ST-109]
labels: [feature:files, ui]
status: done
---

## Story
As a team member, I want one page for each file that says what it is, what it is attached to and how far the AI index got, so that I can see all of that in one place without knowing which machine record the file came from.

## Context
Feature `files` (`docs/domain/events.yaml` **RM-FileDetails**, **CMD-IndexFileForAi** by hand, **AGG-File**; `CONTEXT.md`
*File details*; `docs/product/ux-guidelines.md` **G18** Files block, **G35** as narrowed, **G3**, **G11**, **G17**, **G37**).
**This story owns the page (G18).** Adds to the machine record and to the form „KI“ of the done story ST-109, which is not
reopened.

**One job:** managing one file. **Entry point:** „Details“ next to each file in the machine record's files section, for
the whole team (G18), and a failed file on the form „KI“. ST-117 and ST-119 add further ways in.

**The page, in G18's order** (heading: the file's title):
1. **Head:** „Handbuch · PDF · 12,4 MB“ (file category, media type, size – G13), „Hinzugefügt von Tom am 02.11.2026“ (a
   file from before the feature shows who attached it and when), „Datei öffnen“, which behaves as the file's address does
   today (ST-037). ST-116 adds „Datei bearbeiten“ here, ST-119 the original file name.
   Media types read: „PDF“, „PNG“, „JPEG“, „WebP“, „Markdown“, „Text“, „Video“, „Audio“, every other „Anderes Format“.
2. **„Angehängt an“, read-only in this story** (ST-115 adds „Anhängen“ and „Lösen“): a machine reads „LG-042 · Medieval
   Madness“ and leads to its machine record; a retired machine reads „LG-041 · Ausgemustert“ and leads to its machine
   record; a machine model reads „Alle Geräte des Modells Medieval Madness“.
3. **„KI-Erfassung“, absent while AI is off (G37):** „Für die KI erfasst“, „Wartet auf KI-Erfassung“ or „Für die KI nicht
   lesbar: <reason>“, with ST-109's reason texts; only on a failed file and only for technicians „Erneut versuchen“.
   After it the technician stays on the page with ST-109's confirmation, „Eight Ball Schematic wird erneut für die KI
   erfasst.“, and the section says „Wartet auf KI-Erfassung“. Opening this page starts no run (HS-33 and HS-35 name only
   the defect page and the form „KI“). **The section does not refresh itself** (user, 2026-11-02; G35 as narrowed): a file
   can wait indefinitely, so the state is what the next load shows, as on the form „KI“.

ST-121 adds „Datei entfernen“ at the end of the page, for technicians (G18). Until then the machine record keeps its
„Entfernen“ (ST-038).

**On the machine record (G18):** each file additionally offers „Details“.

**On the form „KI“:** the title of a failed file leads to its file details. „Erneut versuchen“ stays there as well.

**Way back (G17; user, 2026-11-02):** the page knows where the person came from through its address, restricted to a
**closed set of origins, never a free return address**:
- a machine record, by museum number: „Zurück zum Gerät“;
- the form „KI“: „Zurück zu den Einstellungen“, for technicians, who are the only ones to reach „Einstellungen“ (G19 row 9a).

„Dateien“ is the third origin of the set and comes with its page (ST-117). Without an origin, or with anything else in the
address – a foreign web address, a museum number that does not exist – it offers „Zurück zu den Geräten“, leading to
the machine overview, until ST-117 makes that „Dateien“. What the page does stays on the page and keeps the origin
(„Erneut versuchen“ here; ST-115, ST-116 and ST-121 hand it on through their pages).

**Read model:** RM-FileDetails lives in Collection; the page adds AI assistance's state and reason and Team's name of
*Added by* (`docs/domain/context-map.md`). Which AI assessments named the file is deliberately not shown.

## Acceptance Criteria

Scenario: A team member opens a file's details from the machine record
  Given the machine model "Medieval Madness" of "LG-042" has the PDF "MM Operations Manual" of 12.4 MB, file category Manual, added by Tom on 02.11.2026
  When a helper taps „Details“ next to it on the machine record of "LG-042"
  Then the page is headed "MM Operations Manual" and shows „Handbuch · PDF · 12,4 MB“ and „Hinzugefügt von Tom am 02.11.2026“
  And „Datei öffnen“ opens the file

Scenario: „Angehängt an“ names every machine and machine model
  Given "MM Operations Manual" is attached to "LG-042" of the machine model "Medieval Madness", to the retired machine "LG-041" and to the machine model "Medieval Madness"
  When a team member opens its file details
  Then „Angehängt an“ lists „LG-042 · Medieval Madness“, „LG-041 · Ausgemustert“ and „Alle Geräte des Modells Medieval Madness“
  And „LG-041 · Ausgemustert“ leads to the machine record of "LG-041"

Scenario Outline: „KI-Erfassung“ says how far the AI index got
  Given AI is on and the file "MM Operations Manual" <has this state>
  When a team member opens its file details
  Then the section „KI-Erfassung“ says „<text>“
  And opening the page started no run

  Examples:
    | has this state                     | text                                                   |
    | is indexed                         | Für die KI erfasst                                     |
    | has no entry for the current model | Wartet auf KI-Erfassung                                |
    | failed as format not indexed       | Für die KI nicht lesbar: Dateiformat wird nicht erfasst |

Scenario: A technician tries a failed file again from its details
  Given AI is on and "Eight Ball Schematic" failed as OpenRouter not reachable
  When a technician taps „Erneut versuchen“ on its file details
  Then the technician stays there with the confirmation „Eight Ball Schematic wird erneut für die KI erfasst.“
  And the section says „Wartet auf KI-Erfassung“
  And the page does not refresh itself, and the next load shows the state by then

Scenario: While AI is off there is no section „KI-Erfassung“
  Given "Attract mode.mp4" failed, and a technician removed the key, so AI is off
  When a technician opens its file details
  Then no section „KI-Erfassung“ is shown and „Erneut versuchen“ is not offered
  And „Erneut versuchen“ sent anyway is rejected and nothing is indexed

Scenario: A helper sees the details but cannot try a failed file again
  Given a helper is logged in, AI is on and "Attract mode.mp4" failed
  When the helper opens its file details
  Then the state „Für die KI nicht lesbar“ is shown, and „Erneut versuchen“ is not offered
  And „Erneut versuchen“ sent anyway is rejected and nothing is indexed

Scenario: A removed file has no details page, and nobody outside the team reaches one
  Given "MM Manual (wrong edition)" was removed and "MM Operations Manual" exists
  When a team member opens the file details address of "MM Manual (wrong edition)"
  And someone not logged in opens the file details address of "MM Operations Manual"
  Then the team member gets the not-found page
  And the other person is sent to the login and sees nothing of the file

Scenario: A failed file on the form „KI“ leads to its details
  Given AI is on and "Attract mode.mp4" failed as format not indexed
  When a technician taps its title in the failed files on „Einstellungen“
  Then its file details are shown with what it is attached to and its reason

Scenario Outline: The way back leads to where the person came from
  Given AI is on, and "Attract mode.mp4" is attached to "LG-042" and failed as format not indexed
  When a technician opens its file details from <where they are>
  Then the page offers „<way back>“, which leads back to <where they are>

  Examples:
    | where they are                       | way back                    |
    | the machine record of "LG-042"       | Zurück zum Gerät            |
    | the failed files on „Einstellungen“  | Zurück zu den Einstellungen |

Scenario Outline: Without a known origin the way back leads to the machines
  Given "MM Operations Manual" exists
  When a team member opens its file details through an address with <this origin>
  Then the page offers „Zurück zu den Geräten“, which leads to the machine overview
  And no link on the page leads anywhere the address named

  Examples:
    | this origin                       |
    | no origin                         |
    | a foreign web address             |
    | a museum number that does not exist |

## Out of Scope
- Removing a file on this page, and where a removal lands (ST-121)
- Attaching and detaching (ST-115), correcting title and file category (ST-116)
- The file overview (ST-117), the original file name (ST-119)
- A preview, a list of the AI assessments that named the file, replacing a file's content (`docs/product/vision.md`)

## Open Questions
- none

## Notes
- **Split in the story review (user, 2026-11-02, `docs/reviews/2026-11-02-story-review.md`, decision 2):** the removal went to ST-121, and the way back came in. The app works after this story alone: the machine record keeps its „Entfernen“ until ST-121.
- **Moved here (requirements engineer, 2026-11-02):** „LG-041 · Ausgemustert“ from ST-115, because „Angehängt an“ already has to show existing files attached to a machine that is retired. „Nirgends angehängt“ stays with ST-115, where it first can occur. The link from a failed file on the form „KI“ from ST-113.
- `/team/dateien/<id>` already is the address that **opens** a file (ST-037), and machine records and AI assessments' references lead there, so it stays that. The file details need an address of their own, below it, decided in the test plan after checking `node_modules/next/dist/docs/` for a `route.ts` beside a child `page.tsx`. Not-found and login are tested on the new address; a smoke assertion shows that the old address still opens the file.
- The closed set of origins is a security point: anything else is the default, so it cannot become an open redirect (review, ST-114). A helper who opens an address with the origin „Einstellungen“ gets the default way back (G11), since that page is not theirs: a test-plan item.
- „Hinzugefügt von …“ for a file from before the feature shows who attached it (ST-113's migration): a test-plan item, no scenario of its own.
- ST-117 supersedes the scenario "Without a known origin the way back leads to the machines", because the default then becomes „Dateien“; see the Notes there.
- The scenario „Angehängt an“ names … sets up the file's attachments in the test's data, since CMD-AttachFile arrives with ST-115.
