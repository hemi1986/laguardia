# Backlog grooming 2026-10-17

Scope: every story that is not `done` (35). Challenged in parallel by `product-owner`, `lead-dev` and `ux-designer`
on the change list below. Previous run: `2026-10-11-backlog-grooming.md`.

## 1. Health check

| Finding | What it turned out to mean |
|---|---|
| ST-042 depends on ST-061, ST-062, ST-065 (all `wont`); ST-062 on ST-061 | Expected: the hosting block was deferred as a whole (user, 2026-10-17). A `wont` story on `wont` stories is no inversion. Lead dev added ST-061 → ST-065 (doing it on Hobby and moving later is rework). |
| G7 empty case – ST-029, ST-034, ST-039, ST-041, ST-045, ST-055, ST-057 | Mostly not real (UX): ST-034/ST-039 have no list, ST-041's empty text exists, ST-045's "nothing selected" is a rejection with an existing text. Wording only for ST-029 (filter-empty), ST-055, ST-057. |
| G8 typed input – ST-014, ST-030, ST-032, ST-034, ST-036, ST-039, ST-041, ST-053, ST-054 | Real only where a file is involved (G8a): ST-032, ST-054 and ST-037 (not listed by the check). Every runner form keeps its text input (ruling of 10-11 stands). |
| G11 "is not offered" – ST-029 … ST-041 | Not real: the refusal functions decide what a page offers; no sentence needed (ruling of 10-11 stands). |

## 2. What changed since 2026-10-11

Done: ST-024, ST-025, ST-026, ST-027, ST-028, ST-033, ST-040, ST-043, ST-044, ST-048, ST-056 – **all `must` domain
stories are done** (32 of 58). Technical: ST-063 (update routine), ST-066 (spike configuration and data). ADR 0008
accepted (Sentry EU, Better Stack). User decision 2026-10-17: hosting, operations and go-live (ST-065, ST-061, ST-062,
ST-042) deferred to the end; until then test data only on Hobby.

## 3. Frontmatter changes already made by the reviewers (within their fields)

| Story | Change | By | Reason |
|---|---|---|---|
| ST-034 | priority could → should | PO | XS; location is required and nothing else changes it after registration |
| ST-068 | priority should → could | PO | the local e2e covers the flow; the preview part belongs to the hosting block |
| ST-070 | priority should → could | PO | hardening for real visitor text, none is live |
| ST-035 | size M → L | lead dev | the foundation checklist (museum number register, redirect) is unbuilt |
| ST-036 | size S → M, risk → medium | lead dev | "newly applying task counts as done on the correction date" needs a history of category/technology changes published by Collection |
| ST-037 | size M → L, risk → high | lead dev | abandoned direct uploads vs. ADR 0007 (no cleanup job); no entry for a machine model |
| ST-039 | risk → high, depends_on + ST-029 | lead dev | Collection → Repair policies create a module cycle; report-vs-retire race; "on hold" scenario |
| ST-045 | risk → medium | lead dev | needs a batch result (per-machine transaction, partial success) |
| ST-050 | size M → L, risk → high | lead dev | "previous visit" written on open is overwritten by prefetch and action re-renders |
| ST-051 | depends_on + ST-030, ST-039 | lead dev | its scenarios need reopen and retirement in the Given |
| ST-058 | risk → low | lead dev | every section reads from state; the page pattern exists (ST-048) |
| ST-061 | size S → M, depends_on + ST-065 | lead dev | three providers, PII scrubbing |
| ST-062 | size S → M | lead dev | weekly Blob backup needs a scheduler (ADR 0002 has none) |
| ST-081 | size → M, risk → medium | lead dev | 13 scenarios, three pages, first "ask once" pattern |
| ST-084 | size → XS, risk → low | lead dev | `withPhotoToChooseAgain` exists |

## 4. Per story

| Story | Verdict | Who | Reason / proposal |
|---|---|---|---|
| ST-029 hold/resume | keep, revise wording | PO, LD, UX | upper edge of S; UX: G20 reason order, form wording, filter „Nur pausierte“; Q „Fortsetzen“ one tap |
| ST-030 reopen | revise | UX | entry from the resolved defect's page; the reopened defect's page says why it is open again (new scenario); reopening stored as its own entry (ST-028 #1, settled by the data model) |
| ST-031 change details | revise | UX | the form names that removing the mark releases the helper's claim; the confirmation names it |
| ST-053 link reopens | revise | LD, UX | linking happens on „Mit Defekt verknüpfen“, not in the triage list; G21 condition becomes "open or recently resolved"; say whether ST-052's path offers resolved defects; nested `runs` to check in the test plan |
| ST-036 correct model | revise | LD, UX | name the data Collection publishes; ends the G2a exception: creating on its own page, a machine model gets a page |
| ST-034 move | revise | LD, UX | carries the "retired machine cannot be moved" scenario (from ST-039, wanted on 10-11, never applied); wording |
| ST-041 change/remove task | revise | UX | entry „Ändern“ per task; removing asks once |
| ST-047 maintenance on record | revise wording | UX | section 5, empty texts, landing back on the record |
| ST-045 several machines | revise | LD, UX | entry button, selection page (G4a), partial success (new G23) |
| ST-037 files | **split** | LD (PO: build first) | (a) tech task: direct private large-file upload + decision on abandoned uploads (ADR input against ADR 0007); (b) story: attach and find by file category. UX: model entry, G8a, G20, empty section 8 |
| ST-039 retire | revise, after an ADR | LD, UX | ADR input: how a Collection event triggers Repair commands without a module cycle, and the lock against a concurrent report; UX: G10 question page, entry section 9, landing; open status question |
| ST-049 helper dashboard | **split** | LD, UX | A (S): sections, landing, empty case – no journal; B (M): "my claimed defects and what changed" – the first typed journal read, after ST-079 as its own branch. UX: G18 order, counts instead of machines, G6a change lines |
| ST-058 technician dashboard extras | revise (PO: split "recent changes" into a could) | PO vs LD/UX | LD: one story, risk low; UX: G18 (counts, not machines), `ui` label, wording, empty cases |
| ST-050 new since last visit | **spike first**, then revise | LD, UX | spike (~2 h): recording a visit without prefetch/re-render counting; UX: section 1 is a count („1 davon neu …“) |
| ST-051 repair times | keep should, revise | PO, LD, UX | success criterion of the vision; navigation place open (UX: row in „Mehr“); „2,5 Tage“ |
| ST-055, ST-057 | keep could, wording | UX | filter label, markers, visitor text; counts |
| ST-032 | keep could, revise | UX | G8a; photos also on the repair history (open question → yes) |
| ST-035 | keep could | LD | extract its foundation checklist into a tech task before it is pulled |
| ST-038, ST-054 | keep could | UX | ST-054 gets G8a; ST-038 gets the German of its question |
| ST-014 | keep could | all | only if spam occurs (settled) |
| ST-068 | keep could, revise text | PO, LD | text is stale (`e2e/report-problem.spec.ts` exists); belongs to the hosting block, ordering in Notes, no dependency on a `wont` story |
| ST-070 | keep could | PO, LD | after ST-037 (its "upload works under the policy" needs uploads); both propose re-adding it to ST-042's dependencies – the inversion that removed it on 10-12 is gone |
| ST-081 (draft) | revise before review | PO, UX, LD | drop search and count (G4, ~10 people); *Konto* wording; keep merged (LD) |
| ST-084 (draft) | keep | all | XS quick win; full English text in its scenario |
| ST-065, ST-042 | keep `wont`, fix text | LD | ST-065 still says the cleanup "moved back to ST-066", ST-042 item 6 says ST-065 took it over – both are stale since ST-066 is done |
| ST-061, ST-062 | keep `wont` | LD | ADR input for ST-062: an external scheduler for the weekly Blob backup |
| ST-046, ST-066, ST-067, ST-079, ST-080, ST-082 | unchanged | – | settled; files are kept (dropped stories are never deleted) |

## 5. Conflicts

1. **ST-037's place.** PO: build it first – the only open story for vision goal 4, and go-live is deferred. Lead dev:
   L/high, split it and decide the abandoned-upload question first; the user said on 10-12 files are not needed on day one.
2. **ST-058.** PO: split "recent changes" off as a `could`. Lead dev and UX: keep it whole (risk now low), revise to G18.
3. **ST-081's priority.** PO: `should` once shrunk (a mis-tapped deactivation is a dead end today). Lead dev: `could`.
4. **ST-051.** PO: `should`. Lead dev: `must` if the trial starts with it.

## 6. Proposed new work

- **Architecture run before the next block** (lead dev): 8 domain stories since 10-11; `loadDefectForForm` (ST-024 #4)
  and the second hand-written `AggregateStore` (ST-028 #2) are already triggered; Repair is flat (~60 files) and takes
  six more commands; Maintenance is unreviewed. Plus the built generic `version-conflict` text (UX): „Bitte lade die
  Seite neu …“ throws away what G8 keeps – one text in the spirit of `logWorkConflict` for every form.
- **ST-079 as its own branch** before ST-049 B (lead dev).
- **Spike for ST-050** (lead dev).
- **ADR inputs** (lead dev): Collection → Repair policies and the retire lock (ST-039); abandoned uploads vs. ADR 0007 (ST-037); external scheduler for Blob backups (ST-062, deferred).
- **Tech task from ST-037** (upload + abandoned uploads) and the extract of ST-035's foundation checklist (when ST-035 is pulled).
- **Gap: withdraw a mistakenly recorded maintenance record** (PO) – a mis-tap hides a task for its interval; no command exists. New rule → `/feature`.
- **Gap: account audit trail** (PO, LD) – decided on 2026-09-29 as its own feature after ST-005, never started: `/feature` or drop.
- **UX guideline changes** (UX): G10b question page before an irreversible action; G23 partial success; G13 clarified (infinitive in instructions, *du* in confirmations, German numbers); G10 example to *Konto*; G21's condition with ST-053; G22 with „Fortsetzen“ if it becomes one tap.

## 7. Not re-litigated

ST-014 only if spam occurs, ST-046 `wont`, ST-035 `could`, G19's navigation, the four deferred hosting stories as one
block at the end, ST-079/ST-080/ST-082 as non-stories, the G7/G8/G11 rulings of 10-11.

## 8. Open questions to settle (recommended answers)

- ST-039: the record of a retired machine shows „Ausgemustert" in place of the status (PO, LD, UX).
- ST-053: the stricter-status rule also applies when linking reopens (PO, LD).
- ST-032/ST-033: work log photos also on the repair history (PO, LD, UX).
- ST-019/ST-052: *note* – the domain-model skill narrows the `_Avoid_` entry of Work log entry (LD).

## Appendix – UX wording and scenarios for the requirements-engineer

Proposed by the ux-designer, to be applied only as decided in section 9.

- **ST-029:** reasons in glossary order („Wartet auf Ersatzteil“, „Wartet auf Techniker:in“, „Anderer Grund“), none preselected; page „Defekt pausieren · LG-042“ with „Grund“, „Notiz (optional)“, submit „Pausieren“; confirmation „„Display flickers“ ist pausiert – Wartet auf Ersatzteil.“; resume confirmation „„Display flickers“ geht weiter.“; filter „Nur pausierte“, empty „Kein offener Defekt ist pausiert.“
- **ST-030:** „Wieder öffnen“ under the „Abschlussnotiz“ on a resolved defect's page; page „Defekt wieder öffnen · LG-042“ with „Warum wieder öffnen?“; technician's status choice in ST-018's wording, „Status nicht ändern“ preselected; landing on the defect with „„Left flipper weak“ ist wieder offen.“; scenario *The page of a reopened defect says why it is open again* (reopened by, when, reason; the earlier closing note stays visible).
- **ST-031:** behind „Verwalten“ as „Titel und Eignung ändern“; title hint from ST-018; submit „Defekt ändern“; scenario *The form says that removing the mark releases the helper's claim*; the confirmation names the released claim.
- **ST-053:** "opens „Mit Defekt verknüpfen“ for that problem report"; open defects first, then recently resolved ones marked „behoben vor 3 Tagen“; offered when the machine has open or recently resolved defects; confirmation adds „ Der Defekt ist wieder offen.“; ST-052's linking page offers the same list (to settle in its review).
- **ST-036:** scenarios *Creating a machine model happens on its own page* („Neues Modell“, landing with „Modell „Medieval Madness“ angelegt.“) and *A machine model has its own page* (offers „Modell korrigieren“); the form says „Gilt für alle 3 Geräte dieses Modells.“
- **ST-037:** section 8, „Datei anhängen“; „Anhängen an“: „nur LG-042“ / „alle Geräte des Modells …“, none preselected; Dateikategorie in glossary order, none preselected; empty „Noch keine Dateien zu diesem Gerät oder seinem Modell.“; scenario *A rejection says the file must be chosen again* („Bitte einen Titel angeben. Die Datei muss erneut ausgewählt werden.“) – or says the file is still attached, if the implementation keeps it.
- **ST-054:** scenario as ST-084: „… Das Foto muss erneut ausgewählt werden.“
- **ST-032:** scenario „… Die Fotos müssen erneut ausgewählt werden.“; the conflict text names the photos; photos on the repair history page too.
- **ST-039:** section 9 „Gerät ausmustern“ (technicians); page „LG-013 ausmustern“ with „Grund“; question page „LG-013 ausmustern? 1 offener Defekt wird geschlossen, 2 Meldungen werden verworfen. Das lässt sich nicht rückgängig machen.“ (zero parts left out), buttons „Endgültig ausmustern“ / „Zurück“; landing „LG-013 ist ausgemustert.“; scenario *Retiring asks once and names what it closes*.
- **ST-041:** „Ändern“ per task; „Wartungsaufgabe entfernen“ asks „„Wax playfield“ aus dem Wartungsplan entfernen? Sie wird nie wieder fällig; die Wartungseinträge bleiben.“ („Entfernen“ / „Zurück“); confirmations „„Wax playfield“ geändert.“ / „„Wax playfield“ ist nicht mehr im Wartungsplan.“; scenario *Removing asks once*.
- **ST-045:** „Für mehrere Geräte erfassen“ on a task's view of the due list; due machines first, preselected, then „Weitere Geräte“ by location; „„Clean glass“ an 3 Geräten eingetragen.“; partial success adds one line per machine not recorded with its reason.
- **ST-047:** section 5 „Wartung“: due/overdue tasks with „Wartung erfassen“, then the latest records with a link to all; empty texts „Gerade ist an diesem Gerät keine Wartung fällig.“, „An diesem Gerät wurde noch keine Wartung eingetragen.“, „Nicht ausgestellt – es wird keine Wartung fällig.“; landing back on the record.
- **ST-049:** sections „Von dir übernommen“, „Für Helfer:innen geeignet“, „Fällige Wartung für Helfer:innen“ (counts, link to „Wartung“); change lines „Ben hat übernommen“, „Tom hat die Übernahme aufgehoben“, „Neuer Arbeitsschritt von Tom“, „Titel geändert“, „Priorität: hoch“, „Pausiert – Wartet auf Ersatzteil“, „Fortgesetzt“, „Behoben von Tom“; all-empty „Gerade ist nichts für dich offen.“
- **ST-058:** label `ui`; sections 3 „Liegengeblieben“, 4 „Überfällige Wartung“ (counts), 5 „Letzte Änderungen“ (below the all-empty sentence); empty texts per section.
- **ST-050:** scenario 1: the triage section says 1 of the waiting reports is new; marker „neu seit deinem letzten Besuch“.
- **ST-051:** „2,5 Tage“; „Letzte 30 Tage“ / „Letzte 90 Tage“ (30 preselected); empty per priority; on the defect page „Bis zum ersten Arbeitsschritt: 1,5 Tage · Bis behoben: 4,0 Tage“.
- **ST-034:** „Standort ändern“ → „Standort von LG-042 ändern“ → „LG-042 steht jetzt in „Workshop“.“
- **ST-035:** landing under the new number with „LG-420 heißt jetzt LG-042. Bitte einen neuen QR-Sticker drucken.“
- **ST-038:** „„MM Manual (wrong edition)“ entfernen? Die Datei wird endgültig gelöscht.“ („Endgültig entfernen“ / „Zurück“).
- **ST-055:** „Auch ausgemusterte Geräte anzeigen“, marker „Ausgemustert“, empty „Kein Gerät ist ausgemustert.“, visitor „Dieses Gerät ist nicht mehr im Museum.“ / "This machine is no longer in the museum."
- **ST-057:** „1 Wartungsaufgabe überfällig“ / „2 Wartungsaufgaben überfällig“, nothing at zero.
- **ST-081:** no search, no count; „Auch deaktivierte Konten anzeigen“; „Konto von Anna Berger deaktivieren? Anna wird sofort abgemeldet.“; „Konto wieder aktivieren“; retitle without "Find".
- **ST-084:** English scenario checks the full text "Please describe the problem. Please choose the photo again."

## 9. Decisions (user, 2026-10-17) – all as recommended

1. **`/improve-codebase-architecture` before the next block**, scoped to Repair, Maintenance and the dashboard/page data functions; it includes the generic `version-conflict` text.
2. **ST-037 is split** into a tech task (direct private large-file upload + the decision on abandoned uploads, as ADR input against ADR 0007) and the story (attach and find by file category). Both come after the defect lifecycle (ST-029, ST-030, ST-053, ST-031).
3. **Splits and open questions as recommended:** ST-049 split into A (sections, landing, empty case) and B (claimed defects and what changed), with ST-079 as its own branch before B; a spike before ST-050; ST-058 stays whole (conflict 2 decided for lead dev and UX). Open questions: retired machine shows „Ausgemustert" in place of the status (ST-039); the stricter-status rule applies when linking reopens (ST-053); work log photos also on the repair history (ST-032); „Fortsetzen" is one tap (ST-029, G22); repair times as a row in „Mehr" (ST-051, G19).
4. **ST-081** shrinks (no search, no count; deactivate asks once, reactivate, deactivated accounts behind a filter) and becomes `should` (conflict 3 decided for the PO). The user notes that should/could does not matter for the order – everything open will be built.
5. **New work:** withdrawing a mistakenly recorded maintenance record via `/feature` after the architecture run; ST-070 back into ST-042's `depends_on`; the account audit trail (open since 2026-09-29) is dropped.
6. **UX guidelines:** G10b, G23, G13 clarified, G10 example with *Konto*, G21's condition with ST-053, G22 with „Fortsetzen" as one tap – entered by the ux-designer.
7. Conflict 4 (ST-051 `must`?) not asked: priority does not decide the order any more (decision 4); ST-051 stays `should`.
8. All other verdicts of section 4 and the appendix's wording are adopted.
