# Acceptance – ST-024: Log work on a defect
Date: 2026-10-11 · Tests run: `npx vitest run src/modules/repair "src/app/(team)/team/defects"` → 26 files, 184 passed, 0 failed · `check-scenarios.ts ST-024`: 6/6 covered · Browser test `e2e/log-work.spec.ts` read, not rerun (local only; verify --e2e was green before the push) · Preview: not exercised (deployment protection, no team account on the preview database)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Team member logs work | `src/modules/repair/log-work-command.integration.test.ts` | Given: open defect "Left flipper weak" recorded through the real report-and-triage command; list shows no last entry beforehand. When: `logWorkCommand` by Tom with the literal texts (blanks trimmed). Then: the entry has literal what-was-done, parts, Tom's ID and the fixed time; defect still open at version 1; the open defects list shows `lastWorkLogEntry` with Tom and the time; the journal entry is `EVT-WorkLogged` with actor, machine and references only (no free text). All lines asserted. The list's "when and who, not the text" decision is asserted in `open-defects.integration.test.ts` on the rendered page: „Letzter Arbeitsschritt: 06.10.2026, 11:30 · Anna", no text and no older entry; and "nothing" for a defect without entries. The scenario's own test checks the read model, the page test the wording – together complete. | pass |
| Defect details show all work log entries newest first | `src/app/(team)/team/defects/[defectId]/defect-details.integration.test.ts` | Three entries by real commands on Mon/Tue/Wed (two authors). When: the real data loader plus the rendered view. Then: data order Wed, Tue, Mon with literal names/times/parts; rendered HTML contains all three in that order (positions sorted), parts line once. Complete. | pass |
| Helper logs work without claim on a defect not suitable for helpers | `log-work-command.integration.test.ts` | Given asserted before the When (`suitableForHelpers: false`, no claim). Anna (helper) logs; entry by Anna, no parts, still unclaimed, shown as last entry in the list, journal actor Anna. Complete. | pass |
| What was done is required | same file | Empty and whitespace-only both give `what-was-done-required`; work log empty, list has no last entry, journal empty. The form-level rejection (kept texts, catalog wording) is in `arbeitsschritt/log-work-rejection.integration.test.ts`. Complete. | pass |
| No work on resolved defects | same file | Given: resolved through the real resolve command. Tom and Anna both rejected with `defect-not-open`; work log empty, journal identical to before. Complete. | pass |
| Work log entries cannot be changed | same file | Judged below. | pass (with remark) |

Judgement of "Work log entries cannot be changed": the story states "there is no way to change or remove", so the honest test is of the store, not of an absent command. The stand-in `tamperWithWorkLogForTest` runs through the real `aggregateCommand` and the real `defects` store, with both actors, and rewrites every entry (`change`) and empties the list (`remove`). After each attempt the stored entry is equal to the original (`toEqual([byTom])`) – this fails if `saveHistory` ever updated or deleted rows. Then `logWork`, `claim` and `resolve` run, and `xmin` of the row is unchanged, which proves the row is never written again (not just rewritten with the same values). That is a real proof at the store seam and stronger than most append-only tests. Remarks: (1) nothing prevents a future store change that deletes and re-inserts with the same values from passing the first loop but the `xmin` check would catch it – good; (2) there is no database-level guard (trigger, revoked UPDATE/DELETE), so "anyone" with direct SQL can still change it – an intended application-level rule, not a gap in the scenario; (3) the Gherkin "anyone tries" has no UI or HTTP variant, because no such path exists – acceptable.

Additional tests read: `arbeitsschritt/log-work-rejection.integration.test.ts` (kept texts, catalog words, actor from the session regardless of posted `loggedBy`/`loggedAt`, version conflict incl. empty, "abc" and stale version, retry succeeds), `open-defects.integration.test.ts`, `defect-details.integration.test.ts` second test (empty state, `?logged=1` alone confirms nothing, button only on open defect, entries stay visible after resolution), `e2e/log-work.spec.ts` (technician twice, helper on not-suitable defect, resolved meanwhile with kept text, plus a project at 360 px width per its describe block at line ~199 – taken from the spec).

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Scenario tests titled exactly, verify green | yes | check-scenarios 6/6; vitest 184 passed; verify --e2e green by the implementer (529 + 126) | OK |
| Commands via `aggregateCommand`, ID from events.yaml, journal data without free text | yes | `log-work-command.ts`; `EVT-WorkLogged` and `CMD-LogWork` exist in events.yaml; journal `data` = entry ID + loggedBy only, asserted | OK |
| No `new Date()` / `randomUUID()` in domain code | yes | `log-work.ts` uses `clock.now()` and `newId()` | OK |
| Server Actions only through `formAction`, actor from `currentPerson()` | yes | `arbeitsschritt/actions.ts` uses `formAction`; rejection test posts a foreign `loggedBy` and expects the signed-in actor | OK |
| Texts from catalogs; new terms in CONTEXT.md first | yes | `team.de.ts` has all texts incl. the term "Work log entry"/"Arbeitsschritt". I did not verify that `CONTEXT.md` already holds "Work log entry" (changed files list does not include it, so it must pre-exist – grep it before merge) | OK, check |
| Only `index.ts` imported across modules | yes | pages import `@/modules/repair`; test-support imports are relative within the module | OK |
| Migration generated and committed | yes | `0017_defect_work_log.sql`, snapshot and journal; hand-written FK to team_member with a comment (ADR 0002) | OK |
| Usable at 360 px | yes | single-column form with two textareas and one button on its own page (G21); e2e spec per its viewport project (not rerun by me) | OK (from spec) |
| Lists fast with realistic data | yes | last entry is a correlated subquery with `ORDER BY position DESC LIMIT 1` per row (two subqueries, one per column) over an index on `defect_id`; fine for dozens of open defects | OK |
| Journal entry per command | yes | asserted; rejected commands leave the journal empty | OK |
| No personal data in logs | yes | free text kept out of the journal; names are resolved at read time | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Only whitespace in what was done | Rule "what was done is required"; trimmed, tested (`"  \n "`) | covered, no action |
| Parts used of only whitespace | none; `trim() || undefined` stores no parts | fine, no action |
| Parts used given, what was done empty | Rule: what was done is required | covered (test posts parts with empty text), the form keeps the parts |
| Very long text | none; no maximum in story or data model (`text` columns) | question (same as ST-028's closing note): maximum length for free texts? Minor |
| Two team members log work at the same moment | HS-16 version check, decided: „Jemand hat das inzwischen geändert", input kept | covered by the rejection test. Question (minor): every entry also bumps the defect version, so a claim or a log by someone else forces a re-submit although appending could never conflict – decided behaviour, only worth a line at acceptance |
| Defect resolved while the form is open | AGG-Defect invariant (only open defects) | covered (unit rejection test and e2e): form and texts kept, reason shown |
| Defect closed on retirement | Context: "not closed on retirement"; `logWorkRefusal` returns `defect-not-open` for any state but open | enforced, no test because the state is not reachable yet; belongs to ST-039 (as for ST-028). Minor, line only |
| Defect on hold | ST-029 scenario "logging work does not resume it" | not reachable yet; `logWorkRefusal` accepts only `open` – ST-029 must decide whether a defect on hold is a separate state or a flag (if a state, logging work would be refused). Question for ST-029, minor |
| `?logged=1` typed by hand | none | confirmation only shows when the viewer logged the last entry (`youLoggedLast`), tested for the empty case; if Tom typed it after Anna's later entry nothing shows. Fine |
| Entry by a deactivated account | none | name falls back to `unknownTeamMember` if not found; FK `ON DELETE RESTRICT` keeps the row. Question: does a deactivated member's name still resolve (probably yes). Minor |
| Last work log entry in the list after several entries | Context: list shows the last entry | tested with two entries (Mon/Tue, shows the second, not the first). Ties on the same timestamp resolve by insertion `position`, good |
| Same text entered twice (double tap on the button) | none | button is disabled while pending; with JavaScript off a double submit would be refused by the version check on the second request. Fine |
| Helper opens the form for a defect not suitable for helpers | HS-8 (anyone may log) | allowed, tested in e2e |
| Visitor / unauthenticated | team area | `requireTeamMember()` on page and action. Fine |
| English (visitor) pages | not applicable | no visitor change; work log is not shown to visitors |
| Plain-text rendering of free text | G-rules / existing "Texts are plain text" | rendered as React text with `whitespace-pre-line`, so line breaks survive and markup is escaped. Fine |
| Photos on entries | ST-032 | out of scope |

## Findings
Blockers: none. Majors: none. Minors: (1) no maximum length for the free texts (question, same as ST-028); (2) logging work on a defect closed on retirement has no test until ST-039 makes the state reachable; (3) ST-029 must make sure a defect on hold still accepts work (the refusal is currently "state is not open"); (4) confirm before merge that `CONTEXT.md` contains "Work log entry" (not in the diff); (5) every log bumps the defect version and so makes a concurrent claim or log ask for a re-submit – decided, noted for the user.

Verdict: accepted with remarks

## Resolution (implementation, 2026-10-11)

- **#1 maximum length:** not built – the story names none, and the user wants none (2026-10-11; the same holds for ST-028's closing note).
- **#2 closed on retirement:** refused by `logWorkRefusal`; its test comes with ST-039.
- **#3 on hold:** a hold is a sub-state of *open* (data model), so the rule lets work be logged; the scenario is ST-029's.
- **#4 glossary:** *Work log entry* („Arbeitsschritt“) is in `CONTEXT.md`.
- **#5 version check when appending:** the user's decision in the test plan; the form now says that sending again is enough (code review #1).
