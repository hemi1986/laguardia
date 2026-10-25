# Acceptance – ST-055: Retired machines in the overview, search and visitor page
Date: 2026-10-25 · Tests run: `npm test -- -t "ST-055|retired"` → 45 passed, 0 failed (20 files; the e2e spec was not re-run by me, the caller reports it green locally) · Preview: https://laguardia-9d2xpb79r-hemi6.vercel.app (not exercised: `e2e/retired-machines.spec.ts` is local only because the preview database has no technician before ST-068)

`check-scenarios.ts ST-055`: 5/5 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Retired machines leave the machine overview | `machine-overview.integration.test.ts` | Given: LG-012 active, LG-013 retired through the real `retireMachineCommand`. When: real data loader plus real view. Then: LG-013 absent, LG-012 present (a useful control). | OK |
| Team members find retired machines with a filter | same | `{ retired: true }` query. LG-013 entry contains "Ausgemustert" and no "Status:"; LG-012 does not contain "Ausgemustert"; checkbox present; no "none retired" note. Literals. | OK |
| The filter says when no machine is retired | same | Given: only an active machine. Then: LG-012 still listed, "Kein Gerät ist ausgemustert." shown. | OK |
| Search by museum number finds retired machines | same | Search "013": LG-013 found with "Ausgemustert", LG-012 not listed. | OK |
| Visitor machine page of a retired machine | `visitor-machine-page.integration.test.ts` | German and English, literal notes. Asserts no status, no defects or triage text, no "/melden" link. The report page 404 is covered in e2e (local). The test goes through the data loader and view, not the route; the route's `notFound` and redirect branches are unchanged. | OK |

Extra tests beyond the story, matching the user's decisions of 2026-10-25: retired machines never appear under a machine status filter, and the case where every machine is retired. Both are covered. The e2e spec covers the checkbox flow, the old QR sticker, the report page 404 and the 360 px width.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | `pageWidth <= 360` asserted in both e2e tests. The checkbox is a plain label inside the existing GET form. | OK (local run only) |
| List pages fast with realistic data | yes, slightly | One query without N+1. Added `retiredMachineCount` is one extra `count(*)`. | OK |
| Every command writes its journal entry | no | Read-only story. | n/a |
| Texts from message catalogs | yes | `team/collection.ts`, `visitor.de.ts` and `visitor.en.ts`. No literals in the views. | OK |
| No personal data in logs | no | Nothing is logged. | n/a |
| Public page leaks | yes | A retired machine returns only the title (`VisitorMachinePageData` union). No machine ID, no repair data loaded. | OK |
| Advisories | n/a | No dependency change. | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Report page `/m/LG-013/melden` of a retired machine | Yes. User decision: 404, and `loadReportForm` returns none. e2e checks it. | none |
| Posting a report directly for a retired machine | Yes, ST-015 rejects with `machine-retired` (test exists). | none |
| Machine with a reserved old museum number that is retired | Unchanged: the redirect applies only when the data is missing. | question: does a retired machine's old number still redirect? Probably fine. |
| The "Alle · n" count excludes retired machines while the list shows them with the filter on | Yes. User decision: counts stay over active machines. | none; the mismatch could surprise a reader |
| Search plus status filter hides retired machines | Yes, user decision. Tested. | none |
| The retired state is hidden in the visitor heading (the model title stays as the heading) | Yes, user decision. | none |
| Logged-in team member scanning the old sticker | Redirected to the machine record (ST-011, ST-009 marks it retired). Unchanged. | none |
| Overview with the filter on, no retired machine and a search with no match | Both "no match" and "Kein Gerät ist ausgemustert." show. | question: acceptable, minor |
| English UI on the team overview | Team UI is German only. | none |
| Long titles at 360 px | The entry layout is unchanged. | none |

## Verdict
accepted

Remarks, none blocking: (1) the preview was not exercised, because the browser test is local only; (2) the visitor scenario's test checks the page view, not the `/m/[museumNumber]` route (the report page 404 is covered by e2e only).
