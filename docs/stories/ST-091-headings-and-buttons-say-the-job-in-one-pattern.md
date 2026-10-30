---
id: ST-091
title: Headings, buttons and instructions say the job in one pattern
type: story
context: BC-Collection
priority: should
size: S
risk: low
events: []
depends_on: []
labels: [ui, feature:consistent-layout-dark-mode]
status: in-progress
---

## Story
As a team member, I want every form page to name its job the same way and every button to say what it does, so that I know at a glance where I am and what a tap will do, on whichever screen I am.

## Context
The word-level findings of the consistency audit `docs/reviews/2026-10-25-ux-audit-consistency.md` – **F4, F8, F9, F10** – all accepted by the user in the `/feature` grilling of 2026-10-25, completed in the story review of 2026-10-25 (`docs/reviews/2026-10-25-story-review.md`, decision 4: headings follow „<job> · <thing>“ everywhere). Yardstick `docs/product/ux-guidelines.md` **G34**, G1, G10b, G13, G14, G15. Only texts of the message catalogs change; no behaviour, no domain event. Changes the texts of the done stories ST-005, ST-012, ST-034, ST-035, ST-036, ST-037, ST-038, ST-039, ST-041, ST-045, ST-053 and ST-054 – none is reopened. Cross-cutting, filed under `BC-Collection` because most of the headings are Collection's. The account's edit page („Konto bearbeiten · Anna Berger“) is ST-088's.

**F4 / G34 – one pattern for a form page's heading: the job, then „ · “ and the thing it is done to** – as Repair and Maintenance already do („Defekt beheben · LG-042“, „Wartung erfassen · LG-042“):

| Today | Afterwards |
|---|---|
| „Status von LG-042 ändern“ | „Status ändern · LG-042“ |
| „Standort von LG-042 ändern“ | „Standort ändern · LG-042“ |
| „Datei an LG-042 anhängen“ | „Datei anhängen · LG-042“ |
| „Foto an LG-042 anhängen“ | „Foto anhängen · LG-042“ |
| „LG-042 ausmustern“ | „Ausmustern · LG-042“ |
| „Angaben von LG-042 korrigieren“ | „Angaben korrigieren · LG-042“ |
| „Datei entfernen“ | „Datei entfernen · LG-042“ |
| „„Wax playfield“ ändern“ (a maintenance task's change form) | „Wartungsaufgabe ändern · Wax playfield“ |
| „Modell „Medieval Madness“ korrigieren“ | „Modell korrigieren · Medieval Madness“ |
| „Für mehrere Geräte erfassen“ (heading of the page) | „Wartung erfassen · Clean glass (inside & out)“ – the maintenance task's name; the button leading there keeps „Für mehrere Geräte erfassen“ |

The question texts of G10 stay as they are („LG-042 ausmustern? …“) – they are questions, not headings.

**F8 – buttons name the thing** (G14):
- own password: „Speichern“ → „Passwort ändern“
- a maintenance task's change form: „Änderungen speichern“ → „Wartungsaufgabe ändern“
- retiring, before the question: „Weiter“ → „Gerät ausmustern“ (it leads to the question; only „Endgültig ausmustern“ carries it out)

**F9 – „Endgültig …“ for what cannot be undone** (G10b): the verb on the question before removing a maintenance task, „Entfernen“ → „Endgültig entfernen“ (ST-041 named it before G10b's wording existed).

**F10 – team instructions in the infinitive, not *du*** (G13):
- „Bitte lade die Seite neu und versuche es noch einmal.“ → „Bitte die Seite neu laden und noch einmal versuchen.“ (the rest of the text unchanged) – in the team catalog; the visitor catalog keeps its *du* text.
- the hint beside the status choice when linking: „Den Status kannst du nur ändern, wenn du einen behobenen Defekt wählst – er wird wieder geöffnet.“ → „Der Status lässt sich nur ändern, wenn ein behobener Defekt gewählt wird – er wird wieder geöffnet.“
- the rejection: „Den Status kannst du hier nur ändern, wenn ein behobener Defekt wieder geöffnet wird. Bitte „Status nicht ändern“ wählen.“ → „Der Status lässt sich hier nur ändern, wenn ein behobener Defekt wieder geöffnet wird. Bitte „Status nicht ändern“ wählen.“
- Visitor texts keep *du*; confirmations and dashboards may keep *du* (G13).

Browser tests that find a page by its old heading or a button by its old name are changed with the reason named in the pull request – no test is weakened.

## Acceptance Criteria

Scenario: Form pages of a machine name the job first
  Given the machine "LG-042" is registered
  When a technician opens the forms to change its status, change its location, attach a file, attach a photo, correct its details and retire it
  Then they are headed „Status ändern · LG-042“, „Standort ändern · LG-042“, „Datei anhängen · LG-042“, „Foto anhängen · LG-042“, „Angaben korrigieren · LG-042“ and „Ausmustern · LG-042“

Scenario: The question before removing a file names the machine in its heading
  Given the machine "LG-042" has the file "Manual"
  When a technician chooses to remove "Manual"
  Then the question page is headed „Datei entfernen · LG-042“

Scenario: The change forms of a maintenance task and a machine model name the job first
  Given the maintenance task "Wax playfield" is in the maintenance plan and the machine model "Medieval Madness" exists
  When a technician opens the change form of "Wax playfield" and the correction form of "Medieval Madness"
  Then they are headed „Wartungsaufgabe ändern · Wax playfield“ and „Modell korrigieren · Medieval Madness“

Scenario: Recording for several machines names the maintenance task
  Given "Clean glass (inside & out)" is due on "LG-042" and "LG-043"
  When a team member chooses „Für mehrere Geräte erfassen“ for it
  Then the page is headed „Wartung erfassen · Clean glass (inside & out)“

Scenario: Buttons say what they do
  When a team member opens „Passwort ändern“, and a technician opens the change form of a maintenance task and the form retiring "LG-042"
  Then the buttons read „Passwort ändern“, „Wartungsaufgabe ändern“ and „Gerät ausmustern“

Scenario: The team catalog has no vague button texts left
  When the team message catalog is scanned for button texts
  Then none of them is „Speichern“, „Änderungen speichern“ or „Weiter“

Scenario: Removing a maintenance task is confirmed with „Endgültig entfernen“
  Given the maintenance task "Wax playfield" is in the maintenance plan
  When a technician chooses to remove it
  Then the question offers „Endgültig entfernen“ and „Zurück“

Scenario: A version conflict asks in the infinitive
  Given two technicians opened the same defect
  When the second one sends a change after the first one changed it
  Then the change is rejected with „Jemand hat das inzwischen geändert. Bitte die Seite neu laden und noch einmal versuchen.“
  And what happens to the typed input is unchanged from today – only the text changes

Scenario: The status hint when linking speaks in the infinitive
  Given the machine "LG-042" has an untriaged problem report and an open defect
  When a technician opens the form linking the problem report to a defect
  Then beside the status choice it reads „Der Status lässt sich nur ändern, wenn ein behobener Defekt gewählt wird – er wird wieder geöffnet.“

Scenario: The status rejection when linking speaks in the infinitive
  Given the machine "LG-042" has an open defect and none resolved recently
  When a technician links a problem report to the open defect and chooses a new machine status
  Then the change is rejected with „Der Status lässt sich hier nur ändern, wenn ein behobener Defekt wieder geöffnet wird. Bitte „Status nicht ändern“ wählen.“
  And the form keeps what was typed as it does today (ST-053)

## Out of Scope
- Shapes of sections, lists, filters and buttons (ST-092)
- The heading of the account's edit page (ST-088)
- Visitor texts (they keep *du*)

## Open Questions
- none

## Notes
- Size estimate by the requirements engineer: S – catalog texts and the tests that name them.
