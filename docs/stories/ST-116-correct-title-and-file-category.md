---
id: ST-116
title: Correct a file's title and file category
type: story
context: BC-Collection
priority: should
size: M
risk: low
events: [EVT-FileDetailsChanged]
depends_on: [ST-114]
labels: [feature:files, ui]
status: done
---

## Story
As a team member, I want to correct a file's title and file category, so that a mistyped manual is found under the right name in the right group.

## Context
Feature `files` (`docs/domain/events.yaml` **CMD-ChangeFileDetails**, **AGG-File**, **RM-FileDetails**, **RM-MachineRecord**,
**RM-DefectAiAssessments**; `docs/architecture/data-model.md`, *File*, *Concurrency*, *Journal*;
`docs/product/ux-guidelines.md` **G18**, **G33**, **G34**, **G8**, **G14**, **G17**, **G3**). Adds „Datei bearbeiten“ to the head of
the page ST-114 owns. The file details keep their origin (ST-114) through the form page.

**One job:** correcting a file's title and file category. **Entry point:** „Datei bearbeiten“ in the head of the file
details, for the whole team. **Form page:** heading „Datei bearbeiten · MM Operations Manual“ (G34), fields „Titel“ and
„Dateikategorie“, „Zurück zur Datei“ (G17), button „Datei speichern“ (G14).

**The choice „Dateikategorie“ (G20, from ST-037):** „Handbuch“, „Schaltplan“, „Foto“, „Sonstiges“, in this order, the file's
current one preselected. Neither the original file name nor the content can be changed here: for other content, add the
new file and remove the old one (rule).

**Landing (G3, G33):** the file details with „„MM Manual“ gespeichert.“, also when nothing changed – then no event is
recorded and the version stays.

**Rejections (G8; everything typed stays):** an empty title, „Bitte einen Titel angeben.“; no file category, „Bitte eine
Dateikategorie wählen.“ (AGG-File: exactly one file category); someone changed the file meanwhile, the shared
„Jemand hat das inzwischen geändert. Bitte die Seite neu laden und noch einmal versuchen.“ (version check; a real attach or
detach raises the version as well, which is rare and harmless – data model); a removed file, „Diese Datei wurde schon
entfernt.“

**Where it shows:** the current title and file category show wherever the file shows; a corrected file category moves it to
that group on the machine record; a reference of an AI assessment shows the file's current title (RM-DefectAiAssessments).
It changes nothing in the AI index and costs nothing. The title stays out of the journal: EVT-FileDetailsChanged names
which details changed and the file category.

## Acceptance Criteria

Scenario: A helper corrects title and file category
  Given "MM Operations Manul" has the file category Other and is attached to "LG-042"
  When a helper changes the title to "MM Operations Manual" and the file category to „Handbuch“ under „Datei bearbeiten“ and saves
  Then the helper is on the file details with the confirmation „„MM Operations Manual“ gespeichert.“
  And the machine record of "LG-042" shows "MM Operations Manual" under Manual
  And the journal records which details changed, title and file category, without the typed title

Scenario: The form is headed with the file and has its current values
  Given "MM Operations Manual" has the file category Manual
  When a team member opens „Datei bearbeiten“ on its file details
  Then the page is headed „Datei bearbeiten · MM Operations Manual“
  And „Titel“ holds "MM Operations Manual", and „Handbuch“ is preselected among „Handbuch“, „Schaltplan“, „Foto“, „Sonstiges“

Scenario: An empty title is rejected
  Given "MM Operations Manual" has the file category Manual
  When a team member empties the title, chooses „Schaltplan“ and saves
  Then it is rejected with „Bitte einen Titel angeben.“ and „Titel“ is marked
  And „Schaltplan“ is still chosen
  And the file keeps its title and its file category

Scenario: A file without a file category is rejected
  Given "MM Operations Manual" has the file category Manual
  When a form is sent with the title "MM Manual" and no file category
  Then it is rejected with „Bitte eine Dateikategorie wählen.“
  And "MM Manual" is still filled in, and the file keeps its title and its file category

Scenario: Saving without a change is confirmed and records nothing
  Given "MM Operations Manual" has the file category Manual
  When a team member saves „Datei bearbeiten“ without changing anything
  Then nothing is rejected and the team member is on the file details with „„MM Operations Manual“ gespeichert.“
  And the journal records no change

Scenario: A change made meanwhile rejects the form and keeps what was typed
  Given a team member has „Datei bearbeiten“ of "MM Operations Manual" open
  And another team member has corrected the file since
  When the team member saves the title "MM Manual"
  Then it is rejected with „Jemand hat das inzwischen geändert. Bitte die Seite neu laden und noch einmal versuchen.“
  And "MM Manual" is still filled in, and the other team member's correction is still there

Scenario: A removed file cannot be corrected
  Given a team member has „Datei bearbeiten“ of "Old manual" open, and "Old manual" has been removed since
  When the team member saves it
  Then it is rejected with „Diese Datei wurde schon entfernt.“
  And "Old manual" shows nowhere

Scenario: A corrected title shows in earlier references and costs nothing
  Given AI is on, "MM Manul" is indexed, and a written AI assessment has a reference to it
  When a team member corrects the title to "MM Manual"
  Then the reference on the AI assessment shows "MM Manual"
  And the file is not indexed again, no request goes to OpenRouter, and the cost of indexing so far is unchanged

Scenario: Someone not logged in cannot correct a file
  Given "MM Operations Manual" exists
  When someone not logged in opens its „Datei bearbeiten“ address, or sends the form
  Then the person is sent to the login and the file keeps its title

## Out of Scope
- Replacing a file's content, changing the original file name (`docs/product/vision.md`, `CONTEXT.md`)
- Who changed the details and when – journal only, no read model shows it (data model)
- Changing what a file is attached to (ST-115)

## Open Questions
- none

## Notes
- Independent of ST-115: it needs only the page of ST-114. No helper rejection: every team member may do this.
- The version-conflict rejection on this form is the form-runner text of every team form that keeps its input: „Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.“ (ST-100, ST-103, ST-104, `conventions.md`); the scenario's "neu laden" wording contradicts "everything typed stays" (code review ST-116 #2).
