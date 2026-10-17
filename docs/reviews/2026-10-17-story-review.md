# Story review 2026-10-17

Stories: ST-047, ST-051, ST-081, ST-084, ST-085, ST-086, ST-087 – revised or created by the backlog grooming of the
same day (`2026-10-17-backlog-grooming.md`). Reviewed in parallel by `product-owner`, `lead-dev` and `ux-designer`
(all but ST-085 have a screen; ST-087 only for what the UX needs).

## Frontmatter changes made by the reviewers

| Story | Change | By |
|---|---|---|
| ST-051 | priority should → must (vision success criterion 2); depends_on + ST-027 | PO, LD |
| ST-047 | size S → M (new page, cross-module section, change to ST-044's action) | LD |
| ST-081 | depends_on [] → [ST-005] | LD |
| ST-084 | depends_on + ST-023 (shares its rejection text and the G8a helper) | LD |
| ST-085 | size L, risk high | LD |
| ST-086 | size M, risk medium | LD |
| ST-087 | size XS, risk medium | LD |

## Per story

### ST-047 Maintenance on the machine record – approve with changes (PO, LD, UX)
- Story line "As a team member" – helpers record most maintenance (PO, UX).
- Return path: opened from the machine record, „Wartung erfassen" leads back to it – back link „Zurück zum Gerät", also after a rejection; the target is a fixed choice (machine record or due list), never a URL from the address (open redirect) (LD, UX).
- The confirmation on the record is derived server-side as in ST-044, not from a query parameter alone (LD).
- Scenarios: *Only the 5 latest maintenance records are on the machine record* (7 records → 5 newest, link „Alle Wartungseinträge (7)" to the page „Wartungseinträge · LG-042", newest first, with „Zurück zum Gerät"); *Helpers record only maintenance suitable for helpers from the machine record* (G11); scenario 1 gives dates so "newest first" can be asserted (LD, UX).
- Wording as ST-043: „fällig seit 3. Juni 2026", marker „Überfällig"; the records page groups by year with a count once it grows, like the repair history page (UX).

### ST-051 Repair times – approve with changes (PO: must; LD, UX)
- Numbers in the scenarios as shown: „2,0 Tage"; "earliest problem report counts" gets an observable Then; "switch to 90 days" gets a defect resolved 60 days ago; the navigation scenario names „Reparaturzeiten" right after „Wartungsplan" (LD).
- Rules: the period is elapsed time (30 × 24 h, like ST-058's 7 days) with a boundary test; a reopened defect does not count for time to resolved until resolved again, its first work log entry stays the first (LD).
- Each median carries its own number of defects („Bis behoben: 5,0 Tage · 3 Defekte"); half-empty case („Bis behoben: kein Defekt in diesem Zeitraum") and per-priority empty text („Keine Defekte in diesem Zeitraum."); a reopened open defect shows no time to resolved on its page; a line under the period choice says what is measured (UX).
- Glossary: „Reparaturzeiten" and the two durations go into `CONTEXT.md` before the story is built (UX). `RM-RepairTimes.fed_by` in `events.yaml` lacks `EVT-DefectReopened` and `EVT-DefectClosedOnRetirement` (LD → domain model).

### ST-081 Act on one account – approve with changes (PO, LD, UX)
- Landing and confirmations: every action lands on the team member's page with a confirmation that names the person („Konto von Anna Berger deaktiviert." etc.) (LD, UX).
- Question page buttons „Konto deaktivieren" / „Zurück" – no „Endgültig", deactivating can be undone (G10a); own account: „Dein Konto deaktivieren? Du wirst sofort abgemeldet." (UX).
- The last active technician account offers neither deactivating nor the change to helper and says why; replaces the current "refused, no question" scenario (UX).
- A deactivated account's page offers only „Konto wieder aktivieren"; a rejected password reset names the reason at the form with the field marked and empty; only deactivated entries carry „Deaktiviert" (UX).
- Creating: „Neues Teammitglied" / „Teammitglied anlegen" / „Clara Vogt ist angelegt." (UX).
- Scenarios for resetting a password and changing a role from the account page (PO).
- "activate again" instead of "reactivate"; history out of the Context into Notes; the stale "not reviewed yet" note goes (PO).
- Technical: the filter as a GET parameter (works without JavaScript); the confirm step as a page, not a dialog; the page moves to `Field` (LD).

### ST-084 Photo must be chosen again – approve (PO, LD, UX)
- Context: "plain infinitive (G13)" instead of "plain imperative" (UX); scenario 5 quotes ST-016's text (LD).
- Plan notes: `withPhotoToChooseAgain` moves to a shared place (the visitor form must not import from `(team)`); existing ST-015/ST-023 assertions of the old team wording change legitimately (LD).

### ST-085 Direct private large-file upload – approve with changes (PO, LD)
- Task text: the decision (b) plus the rejected alternatives, not the discussion (PO).
- Items: a browser-side upload function with progress and failure (counterpart of `src/photo/browser.ts`); the size limit a parameter of the seam, refusal tested at small scale (in-memory adapter + one e2e on the Development store), 100 MB once manually on the preview; a ~25 MB multipart upload; the route verifies Origin and a team session itself; "works under the security headers" is an e2e on the preview; the seam catalog row for content storage extended (LD).
- ADR input for the superseding ADR: pending uploads recorded in the database, stale ones deleted after the response of a later request; what happens when someone attaches after the content is gone → a scenario in ST-037 (LD).
- Cite the closed 100 MB answer in `OPEN_QUESTIONS.md` (PO).
- Conflict: PO wants ADR and upload split into two tasks; LD keeps one task (as the grooming decided), optional split 085a/085b.

### ST-086 Claimed defects and what changed – not ready (LD, UX; PO: approve with changes)
- Blocker (UX): a claimed defect resolved by someone else just disappears – it stays listed with „Behoben von Tom" for 7 days.
- How long change lines stay, in what order, whether they say when (LD, UX – question).
- Journal gaps (LD): the release event does not carry the former claimant (`data: {}`; `events.yaml` lists only "Released by"); `EVT-DefectDetailsChanged` must say which of title or mark changed; ST-029's mapping journals the hold reason, not the note – all part of the ST-079 conversion branch; a journal query over many aggregates with a time window is new platform code.
- Wording (UX): „Tom hat Ben zugewiesen"; „Tom hat die Übernahme aufgehoben – nicht mehr für Helfer:innen geeignet".
- Scenarios (UX, PO, LD): resolved by someone else; without changes; taken over → section 1 and the dashboard do not say empty; assigned to someone else; priority, resumed lines; own actions never listed; boundary at 7 days; newest first.
- The implementation paragraph ("first typed read of the event journal") moves to Notes (PO); the ST-079 prerequisite stays a Note – start the story only by name (LD).

### ST-087 Spike: how a dashboard visit is recorded – approve with changes (PO, LD, UX)
- Tested on a production build (prefetch does not happen in `next dev`); criterion 2 "confirm" (every Server Action re-renders its page – known); check back/forward and a second tab; if the result changes ST-050's scenarios, ST-050 goes back to review; stop at 2 h (LD).
- Check what happens to the marks when one marked entry is opened and the person comes back to „Übersicht" (navigation, back, reload) (UX).
- "Last visit" (glossary) throughout instead of "previous visit"; ST-050 depends on the spike (PO – already the case).

## Proposed guideline changes (UX)

- **G10b amended:** a reversible action that ends someone's access uses the same question page, but its button names the action without „Endgültig".
- **G24 – history on a record:** the 5 latest entries and a link „Alle … (n)" to a page of its own, grouped by year once it grows, with „Zurück zum Gerät" (shape of the repair history; ST-047, later ST-037).
- **G25 – change lines on a dashboard:** one line per change, who and what (and when), newest first; one's own changes are never listed (ST-086, ST-058, ST-050).

## Conflicts

1. ST-086 – how long change lines stay: LD 7 days for every line (like ST-058); UX every change since the claim with when it happened, and a defect that left the helper stays 7 days.
2. ST-085 – split into ADR/cleanup and upload: PO yes; LD keep one task (grooming).

## Decisions (user, 2026-10-17) – all as recommended

1. **ST-086 (conflict 1 for UX):** every change by someone else since the helper claimed the defect, newest first, each line ending with when it happened in words („· vor 2 Tagen"). A defect that left her (taken over, released, or resolved by someone else) stays in section 1 for 7 days with that change.
2. **ST-050/ST-087:** the last visit moves forward only when the dashboard is opened more than one hour after the current visit began – one round on the floor is one visit. The spike reports whether this can be built.
3. Everything else as recommended:
   - ST-085 stays one task (conflict 2 for LD).
   - ST-051: elapsed time (30 × 24 h); no word "Median" in the UI – one sentence explains it: „Typische Dauer: Die Hälfte der Defekte ging schneller, die Hälfte langsamer."; each time carries its own number of defects; „Reparaturzeiten" and the two durations into `CONTEXT.md`; priority set back to `should` after the health check: `must` pulled ST-039 (ADR first) ahead of the defect lifecycle in the generated backlog; priority does not set the order (user).
   - ST-081: landing on the team member's page with a confirmation naming the person; „Konto deaktivieren" without „Endgültig"; the last active technician account offers neither deactivating nor the change to helper.
   - Guidelines: G10b amended, G24, G25.
   - `events.yaml`: the release event carries the former claimant; `EVT-DefectDetailsChanged` says which of title or mark changed; `RM-RepairTimes` is also fed by `EVT-DefectReopened` and `EVT-DefectClosedOnRetirement`.
   - All per-story changes listed above are adopted.
