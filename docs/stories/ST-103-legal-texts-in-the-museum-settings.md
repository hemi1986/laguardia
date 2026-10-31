---
id: ST-103
title: Privacy notice and imprint written in the museum settings
type: story
context: BC-Collection
priority: should
size: M
risk: medium
events: [EVT-LegalTextsChanged]
depends_on: [ST-100]
labels: [ui, visitor, feature:museum-start-page]
status: ready
---

## Story
As a technician, I want to write the museum's privacy notice and imprint in German and English in the museum settings, so that visitors read the museum's own legal texts without a developer changing the code.

## Context
Feature `museum-start-page` (user, `/feature` grilling and focused event storming 2026-10-31; `docs/domain/events.yaml`
**AGG-MuseumSettings**, **CMD-ChangeLegalTexts**, **EVT-LegalTextsChanged**, **RM-LegalPage**, **RM-MuseumSettings**,
resolved **HS-25**, **HS-26**, **HS-27**; `docs/architecture/data-model.md`, section *Museum settings*; story review
`docs/reviews/2026-10-31-museum-start-page-story-review.md`; ADR 0013 `docs/adr/0013-markdown-for-legal-texts.md`).
Adds the section **„Rechtstexte“** (the glossary's team wording for the legal texts) as the last section of the museum
settings page that ST-100 owns (G18). The visitor legal pages `/datenschutz` and `/impressum` and their links on every
visitor page, headed „Rechtliches“, are ST-064's (done, not reopened); this story changes where their texts come from –
the museum settings instead of the visitor message catalogs.

**The form „Rechtstexte“** – `CMD-ChangeLegalTexts`, technicians only (ACT-Technician; a helper never reaches the page,
ST-100). Four texts:
- the privacy notice in German – **required**: emptied, the save is rejected with „Bitte einen Datenschutzhinweis
  angeben.“ (invariant *The German privacy notice is never empty*);
- the privacy notice in English, the imprint in German and the imprint in English – optional; one left empty is not
  provided (invariant *every other legal text is either not provided or not empty*);
- **no English imprint without a German one** (invariant, HS-25) – rejected at the English imprint (G9) with „Ein
  englisches Impressum geht nur zusammen mit einem deutschen. Bitte auch das deutsche Impressum angeben.“ – so the
  imprint link is offered in both languages or in neither.
- **Empty** means only spaces or line breaks, as for the museum name (ST-100). The browser's line breaks (`CRLF`) are
  taken as `LF` before a text is compared or saved, so a form nobody edited is no change.

**Markdown (HS-26, ADR 0013):** the texts are Markdown. Visitors see headings, paragraphs, bold and italic, lists and
links to `https` and `mailto` addresses. Anything else – raw HTML, an image, a table, a link to another kind of address
(`javascript:`, `http:`, a relative address such as `/impressum`) – is saved as typed and **shown as plain text: the
element's Markdown source appears exactly as typed** (user, 2026-10-31) – e.g. `![Bild](x.png)`, a table's lines with
their pipes, `<script>…</script>`, `[Klick](javascript:alert(1))`. The shown text contains no script, no image, no
table and no link other than to an `https` or `mailto` address. Saving is never rejected for it. The form says which
Markdown is shown. The visitor legal page's title („Datenschutzhinweis“ / „Impressum“) is the page's main heading, so
the text's own headings are shown one level below it.

**Defaults** until a technician changes the legal texts: the placeholder privacy notice that ST-064 shipped, in German
and English, converted to Markdown (it contains the word „PLATZHALTER“ / “PLACEHOLDER”), and no imprint. They are the
defaults of the museum settings; once this story is done the legal texts no longer live in the visitor message
catalogs.

**For visitors (RM-LegalPage):** `/datenschutz` and `/impressum` show the text in the visitor's language, the German
text where no English one is provided. Every visitor page – the welcome page included – links the privacy notice, and
the imprint only when one is provided; without an imprint there is no imprint link and `/impressum` is not found (as
today, ST-064).

**Saving:**
- **Version check of this part only:** if someone changed the legal texts meanwhile, the save is rejected with „Jemand
  hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.“. A change of the museum details or
  the logo in between never rejects it (data model, *three parts, versioned separately*) – shown here with the museum
  details, so this story does not wait for the logo (ST-102). The legal texts are kept as their own record with their
  own version, as ST-100 states for all three parts of the museum settings.
- **Saving without a change** records no event and is no rejection (HS-27, G33) – built and tested once in ST-100.
- Every rejection keeps all four texts as typed and names the reason at the field (G8, G9).
- The journal names which texts changed and who changed them; the texts themselves stay out of it.

**Definition of done** (not scenarios):
1. The Markdown rendering follows ADR 0013 (a new dependency; the ADR is accepted by the user before this story is
   built).
2. The pull request goes through the normal review lane plus `/security-review` – the first text written in La Guardia
   that is shown to the public.
3. The short notice about the photo on the visitor report form (ST-016, `reportForm.photo.notice`) stays in the message
   catalogs – it states what La Guardia itself does with a photo – and loses its „PLATZHALTER“ / “PLACEHOLDER” marker;
   anything museum-specific about photos belongs in the privacy notice it links to (user, 2026-10-31).

**Interface:** usual page width (G16), the legal pages always dark (G26), German team wording on the form (G13),
visitor legal pages German and English. Decided (user, 2026-10-31): field labels
„Datenschutzhinweis (Deutsch)“, „Datenschutzhinweis (Englisch, freiwillig)“, „Impressum (Deutsch, freiwillig)“,
„Impressum (Englisch, freiwillig)“; the hint „Angezeigt werden Überschriften (#), Absätze, **fett**, *kursiv*, Listen
und Links auf https- und mailto-Adressen. Alles andere erscheint als einfacher Text.“; button
„Rechtstexte speichern“; confirmation „Rechtstexte gespeichert.“.

## Acceptance Criteria

Scenario: Visitors read the privacy notice the technician wrote, in their language
  Given a technician saved a German privacy notice with a heading, a bold word, a list and a link to "https://flippermuseum-eschbach.de/kontakt"
  And an English privacy notice
  When a visitor with a German browser opens the privacy notice
  Then the German text is shown with its heading, the bold word, the list and the link
  And a visitor with an English browser is shown the English text

Scenario: An imprint in German only is offered in both languages
  Given a technician saved a German imprint and no English one
  When a visitor with an English browser opens a visitor page
  Then the imprint is offered there
  And opening it shows the German imprint

Scenario: Without an imprint none is offered
  Given the museum has an imprint in German and English
  When a technician empties both imprints and saves the legal texts
  Then no visitor page offers an imprint, in German or English
  And the address "/impressum" is not found

Scenario: Before any change the placeholder privacy notice is shown
  Given no technician has changed the legal texts yet
  When a technician opens the museum settings
  Then the form „Rechtstexte“ holds the placeholder privacy notice in German, containing „PLATZHALTER“, and in English, containing “PLACEHOLDER”, and no imprint
  And visitors are shown that placeholder privacy notice and no imprint

Scenario: An emptied German privacy notice is rejected
  When a technician empties the German privacy notice, types a German imprint and saves the legal texts
  Then the save is rejected with „Bitte einen Datenschutzhinweis angeben.“ at the German privacy notice
  And the typed German imprint is still in the form
  And the legal texts are unchanged

Scenario: An English imprint without a German one is rejected
  Given the museum has no imprint
  When a technician types only an English imprint and saves the legal texts
  Then the save is rejected with „Ein englisches Impressum geht nur zusammen mit einem deutschen. Bitte auch das deutsche Impressum angeben.“ at the English imprint
  And the typed English imprint is still in the form
  And no imprint is offered to visitors

Scenario: Markdown outside the shown elements reaches visitors as plain text
  When a technician saves a German privacy notice containing "<script>alert(1)</script>", "![Bild](x.png)", a table with the line "| Zweck | Dauer |" and "[Klick](javascript:alert(1))"
  Then the save succeeds and the form shows the text exactly as typed
  And the privacy notice shows "<script>alert(1)</script>", "![Bild](x.png)", "| Zweck | Dauer |" and "[Klick](javascript:alert(1))" as text
  And the shown privacy notice contains no script, no image, no table and no link other than to an https or mailto address

Scenario: Legal texts changed by someone else meanwhile are not overwritten
  Given a technician opened the museum settings
  And another technician then saved a new German privacy notice
  When the first technician changes the German imprint and saves the legal texts
  Then the save is rejected with „Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.“
  And the typed imprint is still in the form
  And the privacy notice is the one the other technician saved

Scenario: A change to another part meanwhile does not reject the legal texts
  Given a technician opened the museum settings
  And another technician then changed the museum name
  When the first technician saves a new German privacy notice
  Then the legal texts are saved
  And the museum name is the one the other technician saved

## Out of Scope
- The short notice about the photo on the visitor report form (ST-016) beyond removing its marker – see Definition of done
- A preview of the rendered text on the settings page
- Legal pages for the team area (ST-064)
- Keeping earlier versions of the legal texts or showing who changed them

## Open Questions
None – the wording was decided by the user on 2026-10-31 (see Context). What "shown as plain text" means, the
glossary's „Rechtstexte“ and the Markdown ADR were decided by the user after the story review (2026-10-31).
