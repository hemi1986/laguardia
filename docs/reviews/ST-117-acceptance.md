# Acceptance – ST-117: Find a file in the file overview with filters and pages
Date: 2026-11-06 · Tests run: `npx vitest run "src/app/(team)/team/dateien" src/modules/collection/file-overview.integration.test.ts src/platform/messages` → 11 files, 77 passed, 0 failed; `npx playwright test e2e/file-overview.spec.ts` → 3 passed (local team account present); `npm run typecheck` clean; `npm run lint` 0 errors · Preview: none (local testing)

check-scenarios: 10/10 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A helper finds every file in the overview | `dateien/file-overview.integration.test.ts` | Given built through CMD-AddFile with a stepping clock (removed, detached, 12.4 MB indexed); When through `loadFileOverview` + `FileOverviewView` as helper; Then "2 Dateien", order, entry line literal, no machine named, link to details, removed one absent | pass |
| A long list is paged and keeps its filters | same | 30 manuals + 30 photos; literals "30 Dateien · Seite 2 von 2", the 5 oldest, Zurück/Weiter, Zurück address followed to page 1, page 9 → 2. "Without JavaScript" proven by plain links plus the e2e no-JS spec | pass |
| Filtering by file category | `src/modules/collection/file-overview.integration.test.ts` | Collection query only; "1 Datei" text and the form choice are not asserted in this test (count text is covered by the paging test) | pass (see remark 1) |
| The filter "Angehängt an" … (outline) | same | All four examples with the scenario's data, retired machine included, expected lists as literals | pass |
| The file details lead back to the overview as it was | `dateien/file-overview.integration.test.ts` | Origin → "Zurück zu den Dateien" address, removal landing with confirmation and "26 Dateien · Seite 2 von 2", 7 foreign/forged origins → first page | pass |
| Filtering by how far the AI index got | same | Real indexing run (A indexed, B waits, C failed); only "C", line says "Für die KI nicht lesbar", selected value kept | pass |
| While AI is off neither the state nor its filter is shown | same | Key removed; no "KI" in text, no `aiIndex` select, both listed, back on after turning AI on | pass |
| No file yet says what to do | same | Empty and only-removed; text literal, link to Geräte, no Zurück/Weiter | pass |
| No match says so and keeps the filters | same | "Keine Datei passt…", link "Alle Dateien anzeigen", chosen value kept | pass |
| Someone not logged in does not reach the overview | `e2e/file-overview.spec.ts` | Real browser, redirect to /login, no heading | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at design size (360 px) | yes | e2e checks scrollWidth <= 360, plain form, `[overflow-wrap:anywhere]` on entries | yes |
| Works without JavaScript | yes (G40) | GET form + links; no-JS e2e spec | yes |
| Lists fast with realistic data | yes | paging happens in memory after a single SQL query for all matching files (and the AI states of all remaining files when the state filter is set); fine for hundreds to low thousands of files | yes (remark 2) |
| Journal entry per command | no | read-only page; no command added | n/a |
| Texts from message catalogs | yes | `src/platform/messages/team/collection.ts`; `messages.test.ts` passes with the approved „Weiter“ exception | yes |
| No personal data in logs | yes | nothing logged | yes |
| Security: team-only | yes | `requireTeamMember`; e2e redirect; `attachedTo` ids are validated against known machines/models (no injection, SQL uses bound params) | yes |
| Forged origin (G17) | yes | strict origin parser, tested with 7 forged values | yes |
| Superseded ST-114/ST-121 scenarios | yes | recorded in `superseded-scenarios.json`, their tests removed (user-approved) | yes |
| Docs (conventions) | yes | conventions.md section added | yes |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Very large file counts: all matching files are read and cut in memory | G40 only says 25 per page; no volume figure | no action; revisit with ST-118 (the data function is touched there anyway) |
| Page past the end combined with a removal landing (`fileRemoved` + stale page) | Handled: last page shown | none |
| Two filters that exclude each other with the state filter on AI-off | Ignored per G37 | none |
| A machine retired/deleted after bookmarking: unknown target dropped silently, shows all files | Story: "a value that is not ours is left out" (code comment, conventions) | none, consistent |
| A file attached to a model and its machine both shown once (no duplicates in the list) | Invariant: attached at most once; SQL uses `exists` | none |
| Filter "Angehängt an" lists every machine (hundreds) in one select | G20 native select | question for later, not a defect |
| Long titles / long museum numbers | entries wrap (`overflow-wrap:anywhere`); option labels are native | none |
| English UI / other language | project UI is German only | none |

## Remarks
1. The scenario "Filtering by file category" is tested at Collection query level; the page-level test only covers the category choice in "No match…" and the paging scenarios. "Schaltplan" selection through the form is covered in the e2e only for "Foto"; acceptable, no gap in behaviour.
2. In-memory paging is a deliberate simplification (note in the story: "plain query"); no finding meeting the follow-up hurdle.

No finding qualifies for a new story.

## Verdict
accepted with remarks
