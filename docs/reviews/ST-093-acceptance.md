# Acceptance – ST-093: Status history on the machine record – the latest five and a page of its own
Date: 2026-10-30 · Tests run: `npm test -- -t "ST-093"` → 7 passed (2 files); `npx playwright test e2e/status-history.spec.ts` → 2 passed · Preview: none (checked locally)

## Scenarios
check-scenarios.ts: 9/9 covered.

| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| The machine record shows the latest five status changes | machine-record.integration.test.ts | 8 entries built (registration + 7 changes); asserts 5 `li`, order 7..3, no registration entry, link href and „Alle Statusänderungen (8)“ after the last entry. Literals. | pass |
| The whole status history on its own page | status-history.integration.test.ts | 3 in 2025 / 5 in 2026 via the real data function and view; heading, both year headings with counts, order (years and within), who/when, back link href. The link click is covered by the href assertion on the record, not by a click. | pass |
| A short status history needs no link | machine-record.integration.test.ts | One entry „Erfasst als Spielbereit“, no link. | pass |
| Five entries need no link, six do | machine-record.integration.test.ts | LG-043 with 5, LG-044 with 6; both asserted as in the scenario. | pass |
| The year of an entry is the year in Berlin | status-history.integration.test.ts | Change at 2025-12-31T23:30Z; listed under „2026 · 1 Eintrag“, registration under „2025 · 1 Eintrag“. | pass |
| A reserved museum number leads to the current one | e2e/status-history.spec.ts | Real correction in the browser, then old URL -> redirect, heading, back link; also checks 360 px width. Skips on the preview (no technician account); runs locally and passed. | pass |
| A retired machine's status history stays reachable | status-history.integration.test.ts | Retired machine with 7 entries; page shows all 7. The record's link for a retired machine is not asserted (the record path is the same code, tested for active machines). | pass (remark) |
| The page of an unknown machine | status-history.integration.test.ts | `loadStatusHistory` is undefined and the page shows „Kein Gerät mit der Museumsnummer LG-999.“ | pass |
| Visitors do not reach the status history page | e2e/status-history.spec.ts | Anonymous visit goes to /login, heading „Anmelden“. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | e2e asserts page width <= 360; list uses `overflow-wrap:anywhere`, same list component as the record | yes |
| List pages fast with realistic data | yes | One query for the history plus one names lookup; no per-entry queries; grouping in memory | yes |
| Command writes journal entry | no | read-only story | n/a |
| Texts from message catalogs | yes | `teamMessages.statusHistory` and `machineRecord.allStatusChanges`; singular „1 Eintrag“ handled | yes |
| No personal data in logs | yes | nothing logged | yes |
| Advisories | n/a | no dependency change | n/a |
| Team only | yes | `requireTeamMember()` on the page; e2e covers visitor redirect | yes |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Retired machine: the record's „Alle Statusänderungen (7)“ link is not asserted | Scenario wording says "follows" the link | remark; the same code path, low risk |
| Reserved number on the preview: e2e skips there (no team account) | no | known (CI team-test skip), not specific to this story |
| Page for a reserved number of a retired machine | Context: "as the machine record does" | question, not needed now |
| Helper role on the page | "Team members only" - every team member allowed | OK as implemented |
| Very long reasons on a phone | G17 | `overflow-wrap:anywhere` applied |
| Machine record with 5 entries in one year, 20+ entries on the page | G24: grouped by year always here | OK, consistent with the story |

## Verdict
accepted with remarks

Remarks (none blocking): the link click of the "whole page" scenario and the record link of the retired scenario are asserted through hrefs / the same code path, not by a click or an extra assertion.
