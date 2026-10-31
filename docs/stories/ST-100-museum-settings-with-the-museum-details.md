---
id: ST-100
title: Museum settings with the museum's name and whether the machines are listed
type: story
context: BC-Collection
priority: should
size: M
risk: medium
events: [EVT-MuseumDetailsChanged]
depends_on: []
labels: [ui, feature:museum-start-page]
status: in-progress
---

## Story
As a technician, I want to set the museum's name and whether the machines on display are listed on the welcome page, so that visitors see the museum's own name and – once we want it – can report a problem without finding a QR sticker.

## Context
Feature `museum-start-page` (user, `/feature` grilling and focused event storming 2026-10-31; `docs/domain/events.yaml`
**AGG-MuseumSettings**, **CMD-ChangeMuseumDetails**, **EVT-MuseumDetailsChanged**, **RM-MuseumSettings**, **HS-27**,
**FLOW-MuseumStartPage**; `docs/architecture/data-model.md`, section *Museum settings*). This story builds the museum
settings page and its first form; the logo (ST-102) and the legal texts (ST-103) add their forms to it. The welcome
page that uses the listing is ST-101.

**The page – this story owns it (G18).** A technician page „Museumseinstellungen“ in the team area, reached under
„Mehr“ in the team navigation, technicians only. Its one job: how the museum presents itself to visitors (G1). Below the
heading the link „Startseite ansehen“ to the welcome page (G17). Its sections, in this order, each a framed section with
its title (G29) and its own form saved on its own: **„Museum“** (this story), **„Logo“** (ST-102), **„Rechtstexte“**
(ST-103). After saving, the technician is on the same page, with a confirmation and the saved values (G3).

**The form „Museum“** – `CMD-ChangeMuseumDetails`, technicians only (ACT-Technician):
- Name of the museum, required: an emptied name is rejected with „Bitte einen Namen angeben.“ (invariant *The museum
  name is never empty*). A name of only spaces counts as empty.
- „Geräteliste auf der Startseite anzeigen“, a checkbox, off by default.
- **Defaults** until a technician changes them (the museum settings always exist and are never created –
  invariant *There is exactly one museum settings*): the name „Flipper- & Arcade Museum Eschbach“
  (`docs/product/vision.md`), the listing off.
- **Version check of this part only:** if someone changed the museum details meanwhile, the save is rejected with
  „Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.“ – the usual team text. A
  save of the logo or the legal texts in between never rejects it (data model, *three parts, versioned separately*;
  shown in ST-103).
- **Storage of the three versions** (user, 2026-10-31, story review): each of the three parts of the museum settings –
  the museum details, the logo, the legal texts – has its own version and is kept as its own record, so the existing
  aggregate store and its version check apply unchanged. A part that was never saved holds its defaults. This story
  builds the record of the museum details; ST-102 and ST-103 add theirs the same way.
- **Saving without a change** records no event and is no rejection: the form lands like a save and shows the values as
  saved (HS-27, G33).
- Every rejection keeps what was typed and names the reason at the form (G8, G9); the kept input is tested once here,
  in "An emptied name is rejected" – ST-102 and ST-103 reference G8.
- The journal names which details changed and who changed them; the typed name stays out of it (EVT-MuseumDetailsChanged).

**The museum's name for visitors:** the saved name replaces today's hard-coded museum name everywhere a visitor page
names the museum – the welcome page (ST-078) and both visitor pages for an address that leads nowhere (ST-070): an
unknown address and an unknown museum number – in German and in English alike (the name is not translated).

**Permission (G11):** a helper does not see „Museumseinstellungen“ under „Mehr“, and opening its address gets what
every other technician-only page gives; the command refuses a helper anyway.

**Interface:** the usual page width (G16), dark design (G26), German team wording (G12, G13), buttons that say what they
do (G14). Decided (user, 2026-10-31): „Museumseinstellungen“ under „Mehr“
right after „Teammitglieder“ and before „Passwort ändern“ (G19); field label „Name des Museums“; button „Museum
speichern“; confirmation „Museum gespeichert.“.

## Acceptance Criteria

Scenario: A technician changes the museum's name
  Given the museum name is "Flipper- & Arcade Museum Eschbach"
  When a technician saves the museum form with the name "Flippermuseum Eschbach"
  Then the museum settings show the name "Flippermuseum Eschbach" with a confirmation
  And the change names the technician who made it

Scenario: The museum's name replaces the hard-coded name on the visitor pages
  Given a technician saved the museum name "Flippermuseum Eschbach"
  When a visitor opens the welcome page in German and in English
  Then both show "Flippermuseum Eschbach"
  And a visitor opening an unknown address sees "Flippermuseum Eschbach"
  And a visitor opening an unknown museum number sees "Flippermuseum Eschbach"

Scenario: Before any change the museum settings hold the defaults
  Given no technician has changed the museum details yet
  When a technician opens the museum settings
  Then the form „Museum“ shows the name "Flipper- & Arcade Museum Eschbach"
  And „Geräteliste auf der Startseite anzeigen“ is off

Scenario: A technician switches the listing of the machines on
  Given the machines are not listed on the welcome page
  When a technician saves the museum form with „Geräteliste auf der Startseite anzeigen“ switched on
  Then the museum settings show the listing switched on
  And the museum name is unchanged

Scenario: An emptied name is rejected
  Given the museum name is "Flipper- & Arcade Museum Eschbach"
  When a technician empties the name, switches the listing on and saves the museum form
  Then the save is rejected with „Bitte einen Namen angeben.“ at the name
  And the listing is still switched on in the form
  And the museum name and the listing are unchanged

Scenario: Saving without a change is no rejection
  Given the museum name is "Flipper- & Arcade Museum Eschbach" and the listing is off
  When a technician saves the museum form without changing anything
  Then the museum settings show the same values with a confirmation
  And no change of the museum details is recorded

Scenario: A change made by someone else meanwhile is not overwritten
  Given a technician opened the museum settings
  And another technician then saved the museum name "Flippermuseum Eschbach"
  When the first technician saves the museum form with the name "Arcade Museum Eschbach"
  Then the save is rejected with „Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.“
  And the form still holds "Arcade Museum Eschbach"
  And the museum name is still "Flippermuseum Eschbach"

Scenario: Technicians reach the museum settings under „Mehr“
  Given a technician is logged in
  When the technician opens „Mehr“ in the team navigation
  Then „Museumseinstellungen“ is offered
  And the museum settings page offers „Startseite ansehen“, which opens the welcome page

Scenario: Helpers do not get the museum settings
  Given a helper is logged in
  When the helper opens the address of the museum settings
  Then the museum settings are not shown, as on every technician-only page
  And „Mehr“ does not offer „Museumseinstellungen“ to the helper
  And a museum form sent by the helper is rejected and changes nothing

## Out of Scope
- The machines on the welcome page (ST-101) – this story only stores whether they are listed
- The logo (ST-102) and the legal texts (ST-103)
- The museum name inside the legal texts – that is the text the technicians write (ST-103)
- Who changed the museum settings and when, shown on a page (journal only)

## Open Questions
None – the place under „Mehr“ and the form's wording were decided by the user on 2026-10-31 (see Context).
