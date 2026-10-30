# Code review – refactor-history-by-year: A machine's history by year in one place (architecture review 2026-10-30, K2)
Base: main · Commits: 1 · Date: 2026-10-30

No story: a refactoring branch, reviewed against the intent "no change in what any page shows". It was checked by
reading the code, not by running pages. The intent holds.
- **Order.** All three read models already return newest first: `statusHistoryOfMachine` reverses the oldest-first
  history, `maintenanceRecords` orders by `date desc, recordedAt desc`, and `repairHistory` is documented newest first.
  So the old run-based grouping (status history, maintenance records) and `byYear`'s map plus sort of the years produce
  the same sections, and the entries keep the same order inside each year.
- **Repair history's chosen year.** `chosenYear` missing, unknown or with no entries still gives `year: undefined`,
  which brings back the year choice. Every group `byYear` returns has at least one entry, so `chosen.length > 0` means
  the same as the old `counts.has(chosenYear)`.
- **Empty states.** „An diesem Gerät wurde noch nichts repariert.“ shows only when there are no years. The maintenance
  records show `nothingRecorded`. The status history passes no `nothing` text, as before, since its first entry is the
  registration.
- **Back links.** `teamMachinePage()(n)` builds the same address as the old hand-built
  `/team/machines/${encodeURIComponent(n)}`. „Ausmustern“, „Datei entfernen“ and the record-maintenance page show the
  same text from the new key.
- **Unchanged tests.** `history-by-year.test.ts` and `messages.test.ts` pass (12 tests). The catalogue test still
  compares the merged top-level keys with the sum of the area files, so a second `machineHistory` key in any area would
  fail it.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Design / texts | `src/platform/messages/team/shared.ts:68-75` | The comment on `machineHistory` says it holds "the way back to the machine record from any page of a machine". But seven other pages of a machine still have their own copy of „Zurück zum Gerät“ under `back`: `attachFile`, `attachPhoto`, `machineStatusChange`, `machineCorrection`, `machineMove` (`collection.ts:167,190,212,252,260`), `changeTasks` (`maintenance.ts:69`) and `reportProblem` (`repair.ts:317`). The copies were only half consolidated, and the comment promises more than the code does. The key's name also does not fit three of its five users: retiring a machine, removing a file and recording maintenance are not histories, yet they read `machineHistory.backToMachine`. | Duplicated Code, Mysterious Name; conventions "UI texts" (a text shared by several areas goes to `shared.ts`) | Either narrow the comment to the history pages, or finish the job here: one shared `backToMachine` key (e.g. a top-level `machinePage.backToMachine` or a `sharedTexts` entry not named after histories) used by all the pages above. The second option takes well under an hour. |
| 2 | minor | Test quality | `src/app/(team)/team/machines/[museumNumber]/reparaturhistorie/repair-history-data.ts:64-65` | This branch rewrote how the repair history picks its year from `?jahr=`. No test covers a year that is not in the history: the integration test only calls `page()`, `page("2026")` and `page("2025")`. The rewrite is right, but nothing pins "an unknown year shows the year choice". | tdd skill (a scenario's Then must be checked); the review brief asks for the unknown year | Add one assertion to `repair-history.integration.test.ts`: `page("1999")` (and possibly `page("abc")`) shows the year links and no entries. |
| 3 | minor | Scope | 16 files outside `machines/[museumNumber]` (e.g. `defects/[defectId]/manage-defect.tsx`, `triage/[problemReportId]/verwerfen/actions.ts`, `stickers/*`, `members/*`, several tests) | The commit also reformats 16 unrelated files: it ran `prettier --write .`, which caught formatting drift already on `main`. This does not change behaviour, but it is about half the diff and hides the refactor in review and in `git blame`. `verify.ts` does not check formatting, so the drift can come back. | Scope (behaviour/changes the work does not ask for) | Move the formatting into its own commit, or a separate small PR, titled as such. If drift on `main` keeps happening, consider `prettier --check` in `verify.ts`; that is for the main session to decide, not this branch. |
| 4 | minor | Primitive Obsession | `src/app/(team)/team/machines/[museumNumber]/history-by-year.ts:127,131` | `when` returns `Date \| string`, and every string is taken to be a Berlin `YYYY-MM-DD`. A caller that passes an ISO instant string (for example a serialized `Date`) would silently get the UTC year, so an entry at New Year's Eve 23:30 Berlin would land in the wrong year. `src/platform/time.ts` already has a `CalendarDate` alias for this. | Primitive Obsession; conventions "Time and time-based rules" (all calendar logic through `time.ts`) | Type it `Date \| CalendarDate`, so the meaning shows in the interface. Optionally add a `calendarYear(instant)` helper to `time.ts` so the `.slice(0, 4)` is not calendar logic outside the time helper. |
| 5 | minor | Duplicated Code | `src/app/(team)/team/machines/[museumNumber]/reparaturhistorie/repair-history.tsx:25,46`; `ausmustern/page.tsx:40`; `datei-entfernen/[fileId]/page.tsx:35` | `MachineHistoryFrame` now builds the machine address with `teamMachinePage()`. Right beside it, the repair history view still builds `/team/machines/${encodeURIComponent(museumNumber)}` by hand for its year links, and so do the two touched pages, where `teamMachinePage("ausmustern")` / `teamMachinePage()` are already imported. The title of the chosen year also searches `data.years` again (`find(...)?.count ?? 0`), though the data already knows the count. | Duplicated Code; conventions "The museum number in a page's address" (K1) | Use `teamMachinePage()` / `teamMachinePage("reparaturhistorie")` in the lines touched here. Optionally have `loadRepairHistory` return the chosen year's count (or its `HistoryYear`), so the view stops looking it up. |
| 6 | minor | Mysterious Name | `src/app/(team)/team/machines/[museumNumber]/machine-history.tsx:160-166` | The prop `nothing` reads oddly at the call sites: `nothing={data.years.length === 0 ? … : undefined}`. The frame also leaves it to each caller to decide that the history is empty. | Mysterious Name | Rename it to `emptyText` (or similar). Optionally pass `years` and let the frame decide that the list is empty; that is a judgement call, since the repair history's years are `{year, count}` rather than `HistoryYear`. |

Checked and fine:
- **Table test.** `history-by-year.test.ts` has literal expected values from worked examples, including the Berlin New
  Year case (22:30Z / 23:30Z) and the calendar-date case. It is not tautological and goes through `byYear`'s interface
  only.
- **Moved lists.** `StatusChangeList` and `MaintenanceRecordList` moved unchanged. Their only importers are the machine
  record (`machine-record.tsx`, `machine-maintenance.tsx`) and the two history pages.
- **Conventions paragraph.** It is accurate: what `byYear` does, the frame and `YearSections`, that the repair history
  uses only the frame and the grouping, the list files beside the record, and "never groups by year itself". It fits
  G24 and G4a (the repair history keeps G4a's year choice; the other two show every year on one page, as decided in
  ST-047 and ST-093).
- **Other areas.** No ADR, module boundary, command, event or security surface is touched. There are no new texts on
  visitor pages and no `_Avoid_` words in the new names.

**Verdict: ready to merge**
**Most important finding:** #1. The shared „Zurück zum Gerät“ key claims to serve every page of a machine, but seven
pages still keep their own copy, and three of the key's own users are not histories.

## Resolution
- **#1 fixed** – `BackToMachine` (`machine-history.tsx`) is the one way back from any page of a machine: the link and `teamMessages.machinePages.backToMachine`. The seven `back: "Zurück zum Gerät"` keys and their hand-built links on twelve pages are gone; `machineHistory` keeps only the year text.
- **#2 fixed** – the repair history test opens `?jahr=1999` and gets the year choice.
- **#3 fixed** – the 16 unrelated formatting changes are reverted (no longer in the branch).
- **#4 fixed** – `when` returns `Date | CalendarDate`.
- **#5 fixed** – the repair history and the file removal page build the machine's address with `teamMachinePage`; the retire page uses `BackToMachine`. The chosen year's count lookup in the view stays (one `find` over a handful of years).
- **#6 fixed** – `emptyText`.
