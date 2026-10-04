# Code review – ST-021: Open defects list and defect details
Base: main · Commits: 14 · Date: 2026-10-04

Checked: module boundaries (only `index.ts` across modules, the page composes – ST-009), read models as queries with the
injected clock, IDs (`RM-OpenDefects`), the eleven scenario tests at their seams, language (`check-language.ts`: no new
warnings – the 7 warnings all predate this branch), security of the two new team pages, scope against "Out of Scope"
and the test-plan decisions (GET filter form, count over all open defects, "offen seit N Tagen", machine record
section 4 left to `OPEN_QUESTIONS.md`). No commands were added; the two new stand-ins live in the module's
`*.test-support.ts` as the conventions allow.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Time convention | `src/platform/messages/team.de.ts:1514-1517` (`openFor`), callers `open-defects-data.ts:465`, `defect-details-data.ts:76` | "How many days a defect is open" is computed in the message catalogue as `Math.floor(hours / 24)` – calendar logic outside `time.ts`, and it counts 24-hour periods, not Berlin calendar days. A defect recorded yesterday at 23:00 shows "offen seit heute" at 08:00 the next morning – the words state something false. | Engineering conventions, *Time and time-based rules* ("All calendar logic goes through `src/platform/time.ts`"); ADR 0002 (time-based rules computed on read with the time helper) | Compute the number of days in the page data function with the existing helpers (`daysBetween(calendarDate(openSince), today(clock))`) and pass days, not hours, to a catalogue text that only chooses the wording. One case at a day boundary in the existing tests (or a `time.ts` table case) pins it down. |
| 2 | major | Domain rules / naming | `src/modules/repair/defects.ts:1304-1320`, `defect-details.tsx:323-329` | `defectDetails` returns any defect, whatever its state, typed as `OpenDefect & …`, and the page says "offen seit N Tagen" for it. Once ST-028 (resolve) or retirement closes a defect, its own page – the page ST-021 makes the target for every later link to a defect – will claim a resolved or closed defect is open. The aggregate's state (open / resolved / closed on retirement, AGG-Defect invariant 2) is dropped on the way. | AGG-Defect invariant "A defect is either open (possibly on hold), resolved, or closed on retirement"; smell Mysterious Name (`OpenDefect` for a defect that may not be open) | Let `defectDetails` carry the defect's state with its own type (not `OpenDefect`), and show "offen seit …" only for an open defect. How a resolved defect's page reads belongs to ST-028; this story only must not state a falsehood. |
| 3 | minor | Test seam | `src/app/(team)/team/defects/open-defects.test.ts:759-767` | "ST-021: No defect is open" renders the view with hand-made `total: 0` data; the Given ("no defect is open") never reaches `loadOpenDefects`. The seam catalog row it relies on is for states "the shared databases can never show", but this story already uses an isolated database where the empty state is easy to arrange. | tdd skill (scenario's Given/Then at the agreed seam); seam catalog | Move the scenario into `open-defects.integration.test.ts` (`withoutMachines` leaves no defect) and render through `loadOpenDefects`; keep the view-only table test for the nothing-matches wording. |
| 4 | minor | Design (leaking module) | `defect-details-data.ts:7`, `defect-details.tsx:4` | The defect page imports `ShownReporter` and `reporterName` from the triage page's files (`../../triage/…`). Two pages now depend on one page's internals; a change to the triage list's reporter wording changes the defect page silently. | codebase-design (locality); smell Feature Envy | Move the shown reporter and its name to a small shared file under `src/app/(team)/team/` (or next to the message catalogue) that both pages import. |
| 5 | minor | Code smell – Repeated Switch | `src/modules/repair/defects.ts:1258` | `priorityRank` repeats the priority order as SQL `CASE … ELSE 2`, beside the `priorities` list in `defect.ts` that already states it; an unknown value silently sorts as *low*. | Repeated Switches / Duplicated Code | Build the `CASE` from `priorities` (index = rank), or comment that the two must stay in step. |
| 6 | minor | Consistency | `defect-details.tsx:320` (also the pre-existing `machine-overview.tsx:172`) | The museum number goes into the machine record link unencoded, while every other link and redirect to `/team/machines/<number>` uses `encodeURIComponent`. Harmless today (`LG-\d{3}`), but HS-18's corrected museum numbers make the format a moving part. | Engineering conventions, *Server Actions and forms* (museum number URL-encoded under a fixed path) | `encodeURIComponent(details.museumNumber)`. |
| 7 | minor | Code smell – silent fallback / Duplicated Code | `open-defects-data.ts:459-460`, `defect-details-data.ts:71-72` | A machine Collection cannot name becomes `""`, so the page shows " · " and links to `/team/machines/`. The same two-line fallback appears in both data functions; `OpenDefectsItem` and `DefectDetailsData` repeat the same six fields. | Duplicated Code, Data Clumps | One small helper for "label of a machine" used by both pages; a defect always has a machine (AGG-Defect invariant 1), so a missing label may as well fail loudly. |
| 8 | minor | UX detail | `open-defects.tsx:870` | A `?machine=` value that is not among the offered machines (an old bookmark, a machine whose last defect was resolved) leaves the select on "Alle Geräte" while the list says "LG-0xx hat keine offenen Defekte" – the form shows a different filter from the one applied. | G7 (a filter that matches nothing says what to do) | Offer the chosen museum number as an option too when it is in the filter, or drop it from the filter when it names no machine with open defects. |

Not findings: the count sentence ignoring the filter, the GET filter form, "Defekte" in the line at G19 row 4 and
section 4 of the machine record left open – all as decided in the test plan. Team member names on the defect page are
team-only (`requireTeamMember()`), the defect ID in the address is validated before it reaches a query, and free text is
rendered escaped by React.

**Verdict: ready to merge** – no blockers; fix the two majors in this story (each well under an hour).
Most important finding: #1 – "offen seit N Tagen" is calendar logic in the message catalogue counting 24-hour periods, so it can say "seit heute" for a defect recorded yesterday; compute calendar days with `time.ts` in the page data.

## Resolution (2026-10-04, `/implement ST-021` step 6)

| # | Outcome | Commit |
|---|---|---|
| 1 | Fixed – the page data counts Berlin calendar days (`daysBetween(calendarDate(…), today(clock))`); `openFor` only words them. New test at the day boundary (23:00 yesterday → "offen seit 1 Tag" at 08:00). | 2cc3616 |
| 2 | Fixed – `DefectDetails` is its own type with the defect's state and `recordedAt`; "offen seit …" only for an open defect. New test with a resolved defect. How a resolved defect's page reads stays with ST-028. | e0f049d |
| 3 | Fixed – "ST-021: No defect is open" runs through `loadOpenDefects` on an emptied isolated database; the nothing-matches wording stays a view table test. | 4ac3360 |
| 4 | Fixed – `ShownReporter`, `shownReporter` and `reporterName` live in `src/app/(team)/team/reporter.ts`, used by the triage list, the problem report's page and the defect's page. | 4ac3360 |
| 5 | Fixed – the `CASE` is built from `priorities`. | 1998497 |
| 6 | Fixed on the defect page. The pre-existing link in `machine-overview.tsx` is ST-008's code and is left as it is – revisit when HS-18's corrected museum numbers come in. | 1998497 |
| 7 | Skipped minor – the same fallback is the pattern of the triage list (ST-017); a shared "machine label" helper is worth it once a third page needs it. Revisit at `/improve-codebase-architecture`. | – |
| 8 | Fixed – a machine the address names stays chosen in the select even when it is not offered. | 1998497 |

No finding passes the follow-up hurdle; no new story.
