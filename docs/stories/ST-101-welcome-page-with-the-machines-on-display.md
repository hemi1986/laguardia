---
id: ST-101
title: Welcome page with the machines on display to report a problem
type: story
context: BC-Collection
priority: should
size: M
risk: low
events: [EVT-MuseumDetailsChanged, EVT-MachineRegistered, EVT-MachineStatusChanged, EVT-MachineMoved, EVT-MachineRetired, EVT-MachineModelCreated, EVT-MachineModelCorrected, EVT-MachineDetailsCorrected]
depends_on: [ST-100]
labels: [ui, visitor, feature:museum-start-page]
status: done
---

## Story
As a visitor, I want to see the machines on display on the museum's welcome page and tap the one that has a problem, so that I can report it even when I cannot find or scan its QR sticker.

## Context
Feature `museum-start-page` (user, `/feature` grilling and focused event storming 2026-10-31; `docs/domain/events.yaml`
**RM-WelcomePage**, **FLOW-MuseumStartPage**; `docs/architecture/data-model.md`, section *Museum settings*, derived
*Machines on display*; `docs/domain/context-map.md`). Replaces the minimal page at La Guardia's root address that ST-078
left (done, not reopened). Whether the machines are listed is the museum settings' switch „Geräteliste auf der
Startseite anzeigen“ (ST-100). The logo above the name comes with ST-102; this story does not wait for it – the page
is complete without a logo.

**The page – one job (G1):** say which museum this is and, if the technicians want it, lead a visitor to the machine
they want to report a problem for. The same page for everyone, logged in or not; German and English like every visitor
page (ST-010: language from the browser, the language switch, the choice kept). From top to bottom:
1. the language switch,
2. the logo, when there is one (ST-102),
3. the museum name as the heading (ST-100),
4. **only when the listing is on and at least one machine is on display:** the sentence „Etwas funktioniert nicht?
   Gerät antippen und Problem melden.“ and the list of the machines on display,
5. at the bottom, set apart from the rest: „Anmeldung fürs Team“ and the links to the legal texts (ST-064).

**The list** (RM-WelcomePage, *Machines on display*):
- Included: registered machines that are not retired and whose machine status is not *Not on display* – so
  *Playable*, *Limited* and *Out of order* machines are listed.
- Grouped by the machine model's machine category, in `CONTEXT.md`'s order – „Flipper“, „Arcade“, „Sonstiges“ (English
  „Pinball“, „Arcade“, „Other“); a group without a machine is not shown. Within a group, alphabetical by machine model
  title in the visitor's language, ignoring case (so „Ä“ sorts with „A“ in German); machines of one machine model by
  location, then by museum number (not shown).
- Each entry: the machine model title, its location below it, and – only for *Out of order* or *Limited* – the machine
  status in words („Außer Betrieb“, „Eingeschränkt“; English „Out of order“, „Limited“), so the visitor sees before
  tapping that the problem may already be known (G6). The museum number is not shown (G5).
- The whole entry is tappable and opens the machine's visitor machine page `/m/<museum number>` (ST-010) with its
  current museum number, where the visitor reports the problem as from the QR sticker (ST-013).
- The list is always current, like the visitor machine page (ST-010): a change to a machine, its machine model or the
  museum settings is visible at the next page load.
- ~50–60 machines (`docs/product/ux-guidelines.md`, scale): a visitor scrolls through the groups; no search, no folds
  – the visitor is looking for the machine in front of them, not choosing several (G27 does not apply).

**States:** listing off, or on with no machine on display – no sentence and no list, only the name, „Anmeldung fürs
Team“ and the legal links (the empty case, G7: for a visitor there is nothing to do about it; the QR sticker on the
machine still works). The page has no form, so it has no rejection.

**Interface:** works at 360 px, the usual page width (G16), always dark (G26), visitor texts German and English with
the informal address (G13), domain words in their `_UI (de)_` wording (G12). The English sentence above the list
(user, 2026-10-31): “Something not working? Tap a machine and report the problem.”

## Acceptance Criteria

Scenario: The machines on display are listed by machine category and title
  Given the listing of the machines is switched on
  And "LG-042" of "Medieval Madness" (Pinball) stands at "Halle 2, Reihe 3"
  And "LG-005" of "Fireball" (Pinball) stands at "Halle 1"
  And "LG-020" of "Pac-Man" (Arcade) stands at "Halle 3"
  And no machine of the machine category Other is registered
  When a visitor with a German browser opens the welcome page
  Then the sentence „Etwas funktioniert nicht? Gerät antippen und Problem melden.“ is shown above the list
  And the group „Flipper“ lists "Fireball" and then "Medieval Madness", and the group „Arcade“ lists "Pac-Man"
  And each entry shows its location below its machine model title and no museum number
  And no group „Sonstiges“ is shown

Scenario: Machines that are not playable say so
  Given the listing of the machines is switched on
  And "LG-042" is Out of order, "LG-005" is Limited and "LG-020" is Playable
  When a visitor opens the welcome page
  Then the entry of "LG-042" says „Außer Betrieb“ and the entry of "LG-005" says „Eingeschränkt“
  And the entry of "LG-020" names no machine status

Scenario: Machines not on display and retired machines are not listed
  Given the listing of the machines is switched on
  And "LG-030" is Not on display and "LG-007" is retired
  When a visitor opens the welcome page
  Then neither "LG-030" nor "LG-007" is listed

Scenario: Tapping a machine opens its visitor machine page
  Given the listing of the machines is switched on
  And the museum number of the "Medieval Madness" machine was corrected from "LG-042" to "LG-043"
  When a visitor opens the welcome page
  Then the entry of "Medieval Madness" leads to the visitor machine page of "LG-043", where the visitor can report a problem

Scenario: The welcome page in English
  Given the listing of the machines is switched on
  And "LG-042" of "Medieval Madness" (Pinball) is Out of order
  When a visitor with an English browser opens the welcome page
  Then the group is headed „Pinball“, the entry says „Out of order“ and the sentence above the list is in English
  And the machine model title and the location are shown as they were entered

Scenario: With the listing switched off only the museum is shown
  Given the listing of the machines is switched off
  And machines are on display
  When a visitor opens the welcome page
  Then the welcome page shows the museum name as its heading
  And no sentence about reporting and no machine is shown
  And „Anmeldung fürs Team“ and the link to the privacy notice are offered at the bottom

Scenario: No machine on display shows no list
  Given the listing of the machines is switched on
  And every registered machine is Not on display or retired
  When a visitor opens the welcome page
  Then no sentence about reporting and no list are shown
  And the museum name, „Anmeldung fürs Team“ and the link to the privacy notice are shown

Scenario: Team members see the same welcome page
  Given the listing of the machines is switched on
  And a team member is logged in
  When the team member opens the welcome page
  Then the team member sees the same machines and the same texts as a visitor
  And „Anmeldung fürs Team“ is still offered

Scenario: Changes are visible at the next page load
  Given the listing of the machines is switched on
  And a visitor opened the welcome page while "LG-042" stood at "Halle 2, Reihe 3" and was Playable
  And a technician has since moved "LG-042" to "Halle 4" and set it Out of order
  When the visitor reloads the welcome page
  Then the entry of "LG-042" shows "Halle 4" and says „Außer Betrieb“

## Out of Scope
- The logo on the welcome page (ST-102)
- Searching, filtering or folding the list; a machine's photo, manufacturer or year on the welcome page
- Retired machines' pages and the visitor machine page itself (ST-010, ST-055)
- Opening hours, news, prices or other content (`docs/product/vision.md`, non-goals)

## Open Questions
None – the English sentence was decided by the user on 2026-10-31 (see Context).
