# UX audit – consistency of the existing team and visitor screens

**Date:** 2026-10-25 · **Reviewer:** ux-designer · **Yardstick:** `docs/product/ux-guidelines.md` as amended on
2026-10-25 (G16 one width, G26 dark design, G27 grouped checkboxes, G28 account pages).

**Reviewed (code, not a browser run):** every page under `src/app/(team)/`, `src/app/m/`, `src/app/login/`,
`src/app/page.tsx`, the legal and not-found pages, the print page of the QR stickers, the shared components in
`src/components/` and `src/app/(team)/navigation.tsx`, and the message catalogs in `src/platform/messages/`.

**Order:** job → understanding → states → language → consistency → polish. The user asked for consistency, so
that level gets the most room – but nothing below was found at the first three levels that stops a person from doing
a job at 360 px. **No blockers.**

## Outcome (user, 2026-10-25)

**All 19 findings are accepted.** Where they go:

- **D1–D3** → the dark-mode story (G26, G31).
- **F2** (status history, latest five and a page of its own) → a story of its own.
- **F16** (the two existing checkbox choices) → the per-machine maintenance / G27 stories.
- **F1, F3–F15** → one consistency story.

The questions and the proposed guidelines are answered and written into `docs/product/ux-guidelines.md`: question 1
→ G16 (the submit button spans the column), question 2 → G27 (sticker selection and „Für mehrere Geräte erfassen“
follow it), question 3 → G27 and G26 – **not as recommended**: „Alle auswählen“ exists only with JavaScript (without
it the control is not shown), and the design switch is a small form that works without JavaScript anyway. The
proposed rules became G29 (framed sections), G30 (red only for what cannot be undone), G31 (one look for every fold)
and G32 („Filtern“). The design switch sits between „Passwort ändern“ and „Abmelden“ (G19); the team pages get no
language switch. G28's edit page: „Konto von Anna Berger bearbeiten“ / „Konto speichern“.

## What the decisions of 2026-10-25 already cover

Not findings – these screens will change with the stories of the `/feature` of 2026-10-25 and are not counted again:

- **Width (G16):** every form page, the login, the visitor pages and the record pages without `wide`
  (`/team/machine-models`, the machine model's page, the machine record, the defect page) are narrower than the list
  pages today. They all go to the one width.
- **Accounts (G28):** the team member's page with its role button, password form and the link to the question page
  (`src/app/(team)/team/members/[teamMemberId]/account-view.tsx`), and the question page itself
  (`…/deaktivieren/page.tsx`, whose heading is the list's „Teammitglieder“ instead of the job – a G1 slip that goes away
  with the page).
- **Restriction in the maintenance plan:** the plan list's „Nur Flipper · EM“ / „Alle Geräte“ and the form's „Nur für
  Kategorie“ / „Und nur für Technik“ (`src/app/(team)/team/maintenance-plan/`) use *restriction*, which `CONTEXT.md` now
  lists under _Avoid_; G27's „Gilt für 12 Geräte“ replaces them.

## Dark design (G26) – what would look wrong

The good news first: the pages use the theme's colour tokens throughout; the dark values exist in
`src/app/globals.css`. Exactly one colour is written into a page, and it is the right one for paper.

| # | What | Where | Guideline | Instead | Size |
|---|---|---|---|---|---|
| D1 | Native controls – checkboxes, radio buttons, the open list of a choice, the date field, the file chooser – are drawn by the browser in its light look unless the page says it is dark. On a dark page they would be white boxes and a white drop-down. | every form; `src/components/ui/native-select.tsx`, the checkboxes in `team-members-list.tsx`, `open-defects.tsx`, `due-maintenance.tsx`, `record-for-several-form.tsx`, `sticker-choice.tsx`, `machine-overview.tsx`, the radios in `dismiss-form.tsx` | G26 („every control in the design of the page around it“) | Tell the browser the page's design, so its own controls follow it – in both designs. Check at 360 px with a choice list opened. | S |
| D2 | The print page's sticker text is black on purpose, but the page around it (the „Drucken“ button, „Zurück zur Auswahl“, the count) sits in the root frame that will be dark – the preview would be black text on a dark background. | `src/app/(print)/team/machines/stickers/print/page.tsx`, `src/app/(team)/team/machines/stickers/sticker-sheet.tsx` | G26 („the QR sticker sheet stays light, on screen and on paper“) | The print page is light as a whole, whatever the switch says. | S |
| D3 | The two folds look different: „Mehr“ has its own „▾“ and no browser marker, „Verwalten“ shows the browser's triangle. G27 adds a third fold (each group of checkboxes), and the browser's marker is one of the controls that changes with the design. | `src/app/(team)/more-menu.tsx`, `src/app/(team)/team/defects/[defectId]/manage-defect.tsx` | G15, G26 | One look for every fold, in both designs – see the proposed guideline below. | S |

## Findings

Severity: **major** – they can, but will get it wrong, misread it or not find it; **minor** – works and is understood,
but inconsistent or clumsy.

| # | Level | Severity | What | Where | Guideline | Instead | Size |
|---|---|---|---|---|---|---|---|
| F1 | states | minor | The technician dashboard's „Letzte Änderungen“ end with a date and time („· 12.10.2026, 14:05“) and start with the museum number in brackets („(LG-042) behoben · Tom · …“); the helper dashboard's change lines say who and what, then „· vor 2 Tagen“. Same kind of line, two shapes, and only one follows the rule. | `src/app/(team)/team/technician-dashboard.tsx` (`RecentChanges`), `src/platform/messages/team/dashboard.ts` (`statusChanged`, `defectChanged`) vs. `helperDashboard.changed` | G25 | Each line: who and what, then „· vor …“ with the helper dashboard's wording of the time (`elapsedInWords`). E.g. „LG-042 Spielbereit → Außer Betrieb · Tom · vor 2 Tagen“, „„Flipper links schwach“ an LG-042 behoben von Tom · vor 3 Stunden“ – the exact German is the story's. | S |
| F2 | understanding | minor | The status history on the machine record lists every status change since registration; the repair history and the maintenance records next to it show the latest five and a link to the rest. After a few years the status history is the longest section on the page and pushes the repair history and the files down. | `src/app/(team)/team/machines/[museumNumber]/machine-record.tsx` (section „Status-Historie“) | G24 | The latest five and „Alle Statusänderungen (n)“ to a page of its own with „Zurück zum Gerät“ – needs a story (new page, new link text). | M |
| F3 | understanding | minor | The defect's page has the heading „Defekt“ and the defect's title only as a smaller second heading. Every other record is headed by its thing: the machine record „LG-042 · Medieval Madness“, the machine model by its title, the team member by name. | `src/app/(team)/team/defects/[defectId]/page.tsx`, `defect-details.tsx` | G1, G15 | Head the page with the defect's title; the machine stays the link right under it. | S |
| F4 | consistency | minor | The form pages name their job in two grammars: Repair and Maintenance „Defekt beheben · LG-042“, „Wartung erfassen · LG-042“, „Priorität ändern · LG-042“; Collection „Status von LG-042 ändern“, „Standort von LG-042 ändern“, „Datei an LG-042 anhängen“, „LG-042 ausmustern“. „Für mehrere Geräte erfassen“ does not name the maintenance task in its heading at all, and „Datei entfernen“ not the machine. | `src/platform/messages/team/collection.ts` (`machineStatusChange`, `machineMove`, `attachFile`, `attachPhoto`, `machineRetire`, `machineCorrection`, `removeFile`), `maintenance.ts` (`recordForSeveral.title`) vs. `repair.ts` | G15, G1 | One pattern: the job, then „· LG-042“ – the majority today („Status ändern · LG-042“, „Ausmustern · LG-042“, „Wartung erfassen · Kugeln reinigen“). Catalog only. | S |
| F5 | consistency | minor | Sections of a page take three shapes: framed cards with a title (machine record, both dashboards), plain bold headings (defect page, repair history, repair times, maintenance records), plain medium headings (triage outcomes, the report section, the legal pages). The two records a technician uses most – machine and defect – look like two different applications. | `machine-record.tsx`, `technician-dashboard.tsx`, `helper-dashboard.tsx` vs. `defect-details.tsx`, `reparaturhistorie/repair-history.tsx`, `repair-times.tsx`, `triage/[problemReportId]/problem-report.tsx`, `legal-page.tsx` | G15 | One shape for a section of a record or a dashboard, and one heading level for a section's heading – see the proposed guideline below. | M |
| F6 | consistency | minor | Filters take four shapes with three words for the same act: a checkbox and a small „Anzeigen“ in one line (team members), a checkbox and a small „Filtern“ (due maintenance), several fields and a full-size „Filtern“ (open defects), and on the machine overview the checkbox „Auch ausgemusterte Geräte anzeigen“ inside the search form – it only takes effect with „Suchen“, with an empty search. | `members/team-members-list.tsx`, `maintenance/due-maintenance.tsx`, `defects/open-defects.tsx`, `machines/machine-overview.tsx` | G15, G14 | One word for applying a filter („Anzeigen“ or „Filtern“ – the user's pick, recommended „Filtern“, the majority) and one shape; on the machine overview the checkbox gets the same button as elsewhere, so it does not depend on „Suchen“. | S |
| F7 | consistency | minor | A search is labelled in two ways: the machine overview has the visible label „Suche“ and the hint below; the sticker selection hides the label and puts the hint into the field, where it disappears on the first letter. | `machines/stickers/page.tsx` vs. `machines/machine-overview.tsx` | G15 | The machine overview's shape on both. | S |
| F8 | language | minor | Buttons that do not say what they do: „Speichern“ (own password), „Änderungen speichern“ (maintenance task), „Weiter“ (retiring, before the question). Everywhere else the button names the thing: „Modell korrigieren“, „Defekt ändern“, „Standort ändern“. | `accounts.ts` `ownPassword.submit`, `maintenance.ts` `maintenancePlan.save`, `collection.ts` `machineRetire.submit` | G14 | „Passwort ändern“, „Wartungsaufgabe ändern“, „Gerät ausmustern“ (it leads to the question; only „Endgültig ausmustern“ carries it out). | S |
| F9 | language | minor | Removing a maintenance task is irreversible, but its verb button says „Entfernen“; removing a file, retiring and spam say „Endgültig …“. ST-041 decided „Entfernen“, before G10b's wording existed. | `maintenance.ts` `maintenancePlan.confirmRemove` | G10b | „Endgültig entfernen“ – confirm with the user, since ST-041 named it. | S |
| F10 | language | minor | Three team instructions address the person with *du* where G13 asks for the infinitive: „Bitte lade die Seite neu und versuche es noch einmal.“ (`version-conflict`), „Den Status kannst du nur ändern, wenn …“, „Den Status kannst du hier nur ändern, wenn …“. | `team/shared.ts` `sharedErrors["version-conflict"]`, `team/repair.ts` `link.statusOnlyWhenReopening`, `repairErrors["machine-status-without-reopening"]` | G13 | „Bitte die Seite neu laden und noch einmal versuchen.“, „Der Status lässt sich nur ändern, wenn …“. The visitor texts stay *du*. | S |
| F11 | consistency | minor | The entry to a destructive action has three looks: „Konto deaktivieren“ is red, „Gerät ausmustern“ and „Wartungsaufgabe entfernen“ are plain outlined buttons, a file's „Entfernen“ is a grey text link. The red verb on the question pages is consistent. | `members/[teamMemberId]/account-view.tsx`, `machines/[museumNumber]/machine-record.tsx`, `maintenance-plan/[maintenanceTaskId]/change-maintenance-task-form.tsx` | G15 | Red only for the button that carries out what cannot be undone (the verb on the question page); every way *to* it looks like any other secondary button. With G28 „Konto deaktivieren“ becomes such a way – it is reversible, so not red either. See the proposed guideline. | S |
| F12 | consistency | minor | The confirmation after creating sits in different places: below the create button on the team members, the machine models and the machine overview, above it on the maintenance plan. | `maintenance-plan/maintenance-plan.tsx` vs. `members/page.tsx`, `machine-models/page.tsx`, `machines/machine-overview.tsx` | G3, G15 | Always first under the heading, above the button – where the eye lands after the redirect (the record pages already do it). | S |
| F13 | consistency | minor | Pages without a way back or on: the sticker selection (no „Zurück zu den Geräten“, every other page reached from the machine overview has it), the login (no way to the start page), the legal pages (a visitor who opened „Datenschutz“ from the report form has only the browser's button), the visitor page of a retired machine (one sentence, no way on). | `machines/stickers/page.tsx`, `login/page.tsx`, `legal-page.tsx`, `m/[museumNumber]/visitor-machine-page.tsx` | G17 | „Zurück zu den Geräten“; „Zur Startseite“ on the login and the retired machine's page (the not-found pages have it); on a legal page „Zurück“ to where the visitor came from is not knowable without the browser – „Zur Startseite“ is the honest minimum. | S |
| F14 | consistency | minor | A defect is listed in three shapes on the dashboards and lists: title as link, machine on its own line (open defects, helper dashboard); title as link with „· LG-042 · Modell“ in the same line (stale claims); on the technician dashboard's section 2 and the due maintenance the museum number is the link and the model plain. | `defects/open-defect-entry.tsx`, `helper-dashboard.tsx`, `technician-dashboard.tsx`, `maintenance/due-maintenance.tsx` | G15, G5 | A defect: title as link, machine on the line below (the open defects' entry). A machine: „LG-042 · Medieval Madness“ as one link (the machine overview's entry). | S |
| F15 | polish | minor | The back links are small underlined text almost everywhere; on the defect page and in the „nothing found“ cases of the lists they are body-size, and on „Gerät erfassen“ the link stretches across the whole page. Checkboxes are a size larger on the sticker selection than everywhere else. | `defects/[defectId]/defect-details.tsx`, `defects/open-defects.tsx`, `machines/machine-overview.tsx`, `machines/new/page.tsx`, `machines/stickers/sticker-choice.tsx` | G15 | The back link's shape of all the other pages; one checkbox size. | S |
| F16 | consistency | minor | Choosing many with checkboxes exists twice already, in shapes G27 does not have: the sticker selection lists all machines flat (~60 checkboxes at museum scale), recording for several machines has two flat groups („Fällig“ ticked, „Weitere Geräte“). G27 is decided for the maintenance task's machines and a machine's tasks only. | `machines/stickers/sticker-choice.tsx`, `maintenance/mehrere/record-for-several-form.tsx` | G27, G4a, G15 | Question 2 below. | M |

## Consequences of the decisions that are not decided yet

- **The submit button at the new width.** Nearly every form's submit button spans the form today (at 384 px that is
  hardly noticed), the account forms' buttons are as wide as their words. At ~672 px a spanning button is a long bar on
  the workshop PC. G16 says the *fields* use the whole column; it says nothing about the button – question 1.
- **„Alle auswählen“ and the design switch without JavaScript.** The groups of G27 fold without JavaScript; whether
  „Alle auswählen“ and the switch „Helles Design“ / „Dunkles Design“ must work without it too is not decided –
  question 3.
- **The engineering conventions still describe two widths** (`.claude/skills/engineering-conventions/SKILL.md`, the
  `Page` paragraph: "a list page passes `wide` … a form page does not"). Not the ux-designer's file – it has to follow
  G16 when the width story is built.
- **The wording of G28's form is not complete:** the submit button and the heading of the edit page are not decided.
  Recommended: heading „Konto von Anna Berger bearbeiten“, button „Konto speichern“ – it matches the confirmation
  „Konto von Anna Berger gespeichert.“ (G14). For the requirements-engineer, into the story's Context.

## Proposed guidelines (for the user to approve)

- **A section of a record or a dashboard has one shape** (F5): a heading of one level, the section's empty sentence
  under it when there is nothing (G7), and its one link or button at its end. Which of today's two looks – framed or
  plain – is the user's choice; recommended framed, because the machine record and both dashboards, the pages people
  open most, already have it.
- **Red is for the button that does what cannot be undone** (F11): only the verb on a question page (G10b). A button
  that leads there, and a reversible action, look like every other secondary button.
- **Every fold looks the same** (D3): „Mehr“, „Verwalten“ and the groups of G27 – the same marker, which shows whether
  it is open, in both designs.
- **A filter is applied with one word** (F6) – recommended „Filtern“ – and a checkbox never depends on another form's
  button.

## Questions for the user

1. **Does the submit button of a form page span the whole column at the new width, like the fields?**
   Recommended: yes – it is what nearly every form already does, the button stays where the thumb expects it on the
   phone, and on the workshop PC it is the end of the form. Buttons on a record or a list stay as wide as their words.
2. **Do the two existing checkbox choices follow G27?**
   Recommended: yes. The sticker selection groups the machines by machine category and technology, like the machines
   of a maintenance task. Recording for several machines keeps „Fällig“ open and ticked, and „Weitere Geräte“ fold by
   machine category and technology under G27.
3. **Do „Alle auswählen“ and the design switch work without JavaScript?**
   Recommended: yes, both – each sends the page back to itself (with that group ticked and every other choice kept, or
   in the other design) and keeps the person on the same page, as the visitors' language switch already does; with
   JavaScript „Alle auswählen“ ticks in place.
