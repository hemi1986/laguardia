# Acceptance – ST-111: Earlier AI assessments on the defect page and in the repair history
Date: 2026-11-01 · Tests run: `npx vitest run "src/app/(team)/team/earlier-ai-assessments.integration.test.ts"` → 5 passed / 0 failed · Preview: none (light review lane, code and tests only; e2e not run by this review)

Traceability: `check-scenarios.ts ST-111` → 5/5 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| The newest AI assessment is open and the older ones are folded | `earlier-ai-assessments.integration.test.ts` | Given: real commands (request + write/fail helpers) for 29.10 written, 30.10 failed, 31.10 written. When: `loadDefectDetails` + `DefectDetailsView`. Then: newest text outside any `<details>` and above the first one; folds exactly `[30.10, 29.10]`, both closed, literals from the scenario. Yes. | pass |
| An earlier AI assessment opens without JavaScript | same | Native `<details>` content asserted in the markup (no JS needed). Written fold: summary, causes, check-first, references (link and „Eight Ball Manual, S. 12“), model, requester, cost line as literals. Failed fold: reason text. Extra: no „Erneut versuchen“ in the older one. Yes. | pass |
| An AI assessment being written is on top and the newest written one is folded | same | Given a written one plus a new request. „KI-Einschätzung läuft …“ before the first `<details>`; only fold is „… vom 31.10.2026“, closed, with its content. Yes. | pass |
| The repair history shows each defect's AI assessments folded | same | Both defects resolved. Both `MachineRecordView` and `RepairHistoryView` are checked: two folds newest first, closed, with content; "Display flickers" has no „KI-Einschätzung“. Yes. | pass |
| Earlier AI assessments stay readable while AI is off | same | Key removed through the real `changeAiSettingsCommand`. Defect page and repair history both show the folds and content; „KI-Einschätzung anfordern“ absent. Yes. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from message catalogs | yes | New header text `earlier(date)` in `src/platform/messages/team/ai-assistance.ts`; the view uses `teamMessages.aiAssessments` | OK |
| Fold look G31 / native `<details>`, no JS (G39) | yes | `ai-assessment-view.tsx` uses `<details>` with `summary.fold` (class exists in `globals.css`); the test asserts it in static markup | OK |
| Shared view (one rendering for page and history) | yes | `AiAssessmentContent` / `AiAssessmentFold(s)` extracted and reused by the defect page and both history views | OK |
| Domain language (CONTEXT.md "AI assessment") | yes | No `_Avoid_` synonyms in the new code or texts | OK |
| Date shown as Berlin day | yes | `calendarDate` / `formatCalendarDate`; test uses 11:00Z so the day is stable | OK |
| Long texts | yes | `[overflow-wrap:anywhere]` on the content | OK |
| Journal entry / migration / input handling | no | read-only story | n/a |
| Lists fast with realistic data | yes (light) | The history loads assessments per machine; I did not measure it. Reading the diff, no N+1 was apparent in the data modules | OK (not measured) |
| Personal data in logs | no | no logging added | n/a |

## Design choice judged: the repair history shows only written and failed assessments
Accepted. RM-MachineRecord is fed only by EVT-AiAssessmentWritten/Failed in `events.yaml`, and the history is a record of what was found. An assessment still being written has no finding yet, and it is visible on the defect page (G35). The story's scenario 4 names only "two AI assessments" and does not claim the in-progress one. The one oddity is that a defect that is resolved while a request runs shows nothing in the history until the assessment ends (see the edge cases). No change needed.

## Minors (no new story, none meets the follow-up hurdle)
1. The diff contains about 25 unrelated files that were only reformatted (prettier line wrapping, e.g. `forms.test.ts`, `create-team-member-form.tsx`, `logo-form.tsx`, `museum-logo.integration.test.ts`, the stickers tests). They add review noise to a size-S story. Revisit: put formatting changes in their own commit or leave them out of story branches.
2. The "no N+1 / realistic data" check for the repair history was done by reading only; there is no test with many defects. Revisit if the history page gets slow with long-lived machines.
3. The e2e path (real browser: fold opens by click) is not covered by this review. The static-markup test shows that `<details>` is used, which is enough for "without JavaScript".

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| A defect resolved or closed on retirement while an assessment is still being written | Story says resolved/closed defects keep their AI assessments (HS-30); an assessment in progress is not in RM-MachineRecord until it ends | question – fine as is; it appears in the history once written or failed |
| Two assessments on the same Berlin day | none; both folds get the same header „KI-Einschätzung vom 31.10.2026“ | question – a time of day in the header might help; revisit when a team asks |
| Many earlier assessments (for example 20) on one defect page or history entry | none | question – all are listed; fine for the first version |
| A failed newest assessment next to older ones | ST-108 keeps the retry on the newest only; test 2 checks that older failed ones have no retry | covered |
| Helper role viewing the history | outside this story; the view is under `/team` with the existing role rules | question |
| Reference to a removed file in an older assessment | handled in the view (label without link), not tested in ST-111 | question – ST-107 may cover it |

## Verdict: accepted with remarks
All five scenarios have real tests that check the Gherkin lines literally. The tests pass. Conventions are met. The remarks are the minors above.

## Implementer response (2026-11-01)

- Minor 1 (unrelated reformatting) – **fixed**: the 25 files only reformatted by Prettier are back to `main`'s version; the diff holds only ST-111's files.
- Minor 2 (performance with many defects) – **skipped**: the repair history reads the AI assessments of the shown defects in one query (`endedAiAssessmentsOfDefects`, `inArray`) and the files' titles once for all; the machine record only for its latest 3 repairs. Revisit when the load-time test (`machine-record-load.integration.test.ts`) gets AI assessments in its data set.
- Minor 3 (real browser) – **skipped**: the fold is a native `<details>` with `summary.fold`, the same element whose no-JavaScript behaviour the existing browser tests of „Verwalten“ and „Mehr“ cover; the full e2e run passed.
