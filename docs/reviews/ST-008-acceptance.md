# Acceptance – ST-008: Machine overview with search and machine status filter
Date: 2026-10-02 · Tests run: `npx vitest run` → 212 passed / 0 failed (36 files); `npx playwright test` (local, with technician account) → 32 passed / 0 failed · Preview: https://laguardia-1envb5g7o-hemi6.vercel.app (not checked: a plain request to `/team/machines` is answered with a 302 to the Vercel SSO login, so the visitor scenario was only run locally)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Team member sees all active machines | `machine-overview.integration.test.ts` | Given: LG-002 (Out of order, Galaxian) and LG-001 (Playable) registered through the real command. When/Then: `toEqual` on the full entries with literals (all six fields) and in order LG-001, LG-002. The test runs against the read model; the rendering of category, technology, location and status in the entry (`MachineEntry`) is not asserted anywhere. | pass, remark 1 |
| Number of machines per machine status | integration test + `machine-overview.test.ts` (labels) | 45/6/3/5 machines are really registered; `machineStatusCounts` is asserted with literals. The view test uses different numbers (45/6/0/5) and asserts the labels "Spielbereit · 45" and so on, plus the zero count. The page itself is never run with 45/6/3/5. | pass |
| Filter by machine status | integration test | Given: 3 Playable and LG-002 and LG-007 Out of order. When: `machineOverview(db, {machineStatus})`. Then: exactly ["LG-002","LG-007"]. The filter link in the page is only checked as an `href` in the label test. | pass |
| Search by museum number | integration test | LG-042 registered, plus decoys LG-142 and LG-001. "042" returns only LG-042 (the decoys prove the substring match is not too loose). | pass |
| Search by title | integration test | LG-042 (Medieval Madness) plus decoy LG-043 (Galaxian). Lowercase "medieval" finds LG-042 only, so the match is case-insensitive. | pass |
| Retired machines are not listed | integration test | LG-013 is retired via the test-support command. Then: it is absent from the list, from a search for "013" and from the counts. This is stronger than the scenario. | pass |
| No machine matches the search | `e2e/machine-overview.spec.ts` (local only, skipped with BASE_URL) | A real browser at 360 px: it searches "jukebox <suffix>" through the navigation link "Geräte". It asserts the text `Kein Gerät passt zu „…“.`, 0 articles, no horizontal overflow, and that "Suche zurücksetzen" leads back to `/team/machines` with an empty field and a list. All three Then lines are covered. | pass |
| No machine has the filtered machine status | `machine-overview.test.ts` | The view is rendered on its own with `machineStatus: "out-of-order"` and no machines. It asserts "Kein Gerät ist Außer Betrieb.", no `<article`, and no "Noch kein Gerät erfasst.". The scenario's Given ("no machine is Out of order") is only represented by a count of 0 for that status in the props, and the test supplies counts with out-of-order = 0 implicitly. Not an end-to-end test through the page and database, but the user decided this in the test plan. | pass, remark 2 |
| Visitors cannot open the machine overview | `e2e/machine-overview.spec.ts` | `/team/machines` without a session redirects to `/login` and the username field is visible. It is real and runs without an account. | pass (local) |

Traceability: `check-scenarios.ts ST-008` → 9/9 scenarios covered.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | The 360 px overflow check covers the nothing-found state of the overview and every team page in `team-shell.spec.ts`. The overview with a long list, 5 filter links wrapping, and a long title or location is not measured. | ok, remark 3 |
| List page fast with realistic data | yes | One query for the list and one grouped count, in parallel, with no N+1. The count test uses 59 machines. There is no index on museum number or status and no pagination, which is fine at this size (about 60 machines). `ilike '%…%'` is a sequential scan, fine at that size. | ok |
| Command writes journal entry | no | The story only reads. | n/a |
| Texts from message catalogs | yes | All new texts are in `team.de.ts` (`machines.search`, `noMatch`, `clearSearch`, `noneWithStatus`, `team.more`, `team.home` = "Übersicht"). The status labels reuse `texts.statuses`. | ok |
| No personal data in logs | yes | Nothing logged; the search term appears only in the URL and the page. | ok |
| Role check (G11, ADR 0004) | yes | `requireTeamMember()` on the page; technician-only links are hidden from helpers in the navigation, and registering is offered only to technicians. | ok |
| Context: navigation decided (G19) | yes | `navigation.tsx` implements the daily line (Übersicht, Geräte) and "Mehr" (Modelle, Teammitglieder for technicians, Passwort ändern, Abmelden). Destinations of later stories (Sichtung, Defekte, Wartung, Wartungsplan) are intentionally not there yet; the doc comment says they appear with their story. The table in G19 lists all 10. Keyboard order and "once per destination" are tested in `team-shell.spec.ts`. | ok |
| Context: page names | yes | "Geräte" and "Übersicht" are in use and do not collide. | ok |
| Context: G5 | yes | One entry carries only identity facts. The "Gerät erfassen" action is above the list and not on the entry. | ok |
| Context: G6 | yes, see remark 4 | The counts are labelled in words and the status is prefixed "Status:". The story's bullet says "a count that is zero is not shown", but the user's decision of 2026-10-02 shows zero counts in the filter, which the story text no longer matches. | ok, remark 4 |
| Context: G7 | yes | The empty state and both nothing-found states say what is the case and offer a way out for search. The status-filter nothing-found state offers no link to return (the filter links stay visible above it, so there is a way out). | ok |
| Context: O2 / G16 | yes | `Page wide` is `max-w-2xl` (672 px) and the overview and the navigation use it. O2 is moved into G16. | ok |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| The story context (G6 bullet) still says "a count that is zero is not shown", while the user decided to show zeros in the status counts (G6 vs. user decision). | Contradicts the story text only. | Fix now: reword the context bullet in ST-008 (a documentation change, not a hurdle story). The bullet's scope (counts per machine, ST-021/ST-057) is different from the status counts. |
| A search combined with a status filter that has no match shows "Kein Gerät passt zu …" with a link that keeps the filter. Reasonable, but not specified. | No | Question: accept as is. |
| When no machine exists at all the search and filter are hidden and the empty state is shown. If every machine is retired, the same empty text ("Noch kein Gerät erfasst.") appears. | No rule | Question, low priority. |
| A search with only whitespace is treated as no search (trimmed). Characters `%`, `_` and `\` are escaped, so they are searched literally. | No | Fine, no action. Not covered by a test (the escape code and trim are untested). Add a small test now if desired. |
| A machine with a very long title or location, or a 5-link filter at 360 px, is not measured in a browser (only `break-words`). | G16 | Fix now (optional): a 360 px check with a long title in the overview. |
| An unknown `machineStatus` in the URL silently filters nothing (`statusOf`) and a repeated `search` parameter uses the first. | No | Fine, no action. |
| A helper opens the overview: the test "Helpers are not offered registering" is in `register-machine.spec.ts`, but the helper's navigation (no Modelle, no Teammitglieder inside "Mehr") is not asserted in the new navigation. | G11 | Fix now (small): assert the helper's "Mehr" content. |
| No test shows that the "Not on display" machines are counted in "Alle" or listed. | Story: "all active machines" | Question: confirm that "Alle" includes Not on display (the implementation does). |
| Sorting by museum number is a text sort (`LG-10` before `LG-9` when the numbers are not zero-padded). | Story: "sorted by museum number" | Question: the number format is generated and zero-padded? Check with ST-007's generator. |
| The "Mehr" menu is a native `details` that does not close on outside click or on navigation. | G19 (no JS) | Question for UX. |
| Preview: the deployment is behind Vercel SSO, so the visitor scenario could not be checked there. | n/a | Check by the user in a logged-in browser, or provide a bypass token. |

None of these meets the follow-up hurdle (no security or data-loss risk, no named story blocked). All are fixable in the story or are questions.

Remarks:
1. The rendered entry (category, technology, location, status text) has no assertion; a regression in `MachineEntry` would go unnoticed. A small `renderToStaticMarkup` assertion would close it.
2. The scenario "No machine has the filtered machine status" is tested only at the view level; the real filter on the database returning zero rows is covered by the filter test implicitly.
3. The 360 px check covers only the empty-search state of the overview.
4. See the first row of the edge-case table.

## Verdict
**accepted with remarks.** All 9 scenarios have a real test titled correctly; all tests pass (212 vitest, 32 Playwright); the story context bullets (navigation, page names, G5, G6, G7, O2) hold. Remarks: reword the G6 bullet in the story, add a test for the rendered entry, check the long-title overview at 360 px, and check the helper's "Mehr" content. The visitor scenario on the preview could not be checked because of the SSO wall.
