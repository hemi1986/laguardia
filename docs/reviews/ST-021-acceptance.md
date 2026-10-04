# Acceptance – ST-021: Open defects list and defect details
Date: 2026-10-04 · Tests run: `npm test -- -t "ST-021"` → 11 passed, 0 failed (4 files); `check-scenarios.ts ST-021` → 11/11 covered; the e2e spec was read, not re-run (the caller reports `verify.ts --e2e` green) · Preview: https://laguardia-304skxizi-hemi6.vercel.app (protected, no team account – not usable for team pages)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Team member sees all open defects | open-defects.integration.test.ts | Yes. Defects recorded through real commands with a fixed clock (5 and 8 days). Literal expectations for museum number, model title, title, priority, helpers mark, open since, and order (data and rendered HTML). | pass |
| Oldest first within a priority | open-defects.integration.test.ts | Yes. 10 days vs 2 days, same priority; order asserted. The defects are recorded newest first, so the sort is really exercised. | pass |
| Filter by suitable for helpers | open-defects.integration.test.ts | Yes, data and HTML. | pass |
| Filter by machine | open-defects.integration.test.ts | Yes. Two machines, only LG-042 listed, HTML also checked. | pass |
| Team member opens a defect | defect-details.integration.test.ts | Yes. Machine (with link), title, priority, helpers mark, open since and the originating report with its description are asserted. | pass |
| Defect details show all linked problem reports | defect-details.integration.test.ts | Yes. Two linked reports from a visitor and a helper, plus an unrelated report that must not appear. Description, reporter and time are asserted. | pass |
| Machine overview shows the number of open defects | machine-overview.integration.test.ts | Yes. 2 open and 1 resolved gives "2 offene Defekte". The zero case is also asserted. | pass |
| No defect is open | open-defects.test.ts (unit, view only) | Partly. The view is rendered with `total: 0` directly, so "no defect is open" is not set up through the data loader and database. The Then (text, link to triage, no form) is asserted. | pass, remark |
| How many defects are open | open-defects.integration.test.ts | Yes. 7 defects are recorded and "7 Defekte sind offen." is asserted. The test uses a filter that matches nothing, which also shows that the count ignores the filter. | pass |
| A filter that matches nothing | open-defects.integration.test.ts (+ unit texts) | Yes. No list entry, the sentence, and the link back to /team/defects are asserted. | pass |
| Resolved defects are not listed | open-defects.integration.test.ts | Yes. A defect is resolved through a test stand-in command. Absence is asserted in the data and HTML, and the total is 1. | pass |

Browser test `e2e/open-defects.spec.ts` (no JavaScript, phone): filter by GET form, list entry, defect page, scrollWidth ≤ 360 px, overview count. It skips on the preview (no team account) and runs locally only.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e checks `scrollWidth ≤ 360` on the list and the details; `[overflow-wrap:anywhere]` for long titles | OK |
| List fast with realistic data | yes | One query for open defects (twice: all and filtered) and one label lookup. No pagination and no measurement. Fine for a museum-sized collection. | OK, remark |
| Command writes a journal entry | no | read-only story, no command | n/a |
| Texts from the message catalogs | yes | `team.de.ts` (`teamMessages.defects`, `terms`); the diff shows no inline German in the views | OK |
| No personal data in logs | yes | nothing logged; the reporter's name is only rendered on the page | OK |
| Works without JavaScript | yes | plain GET form, e2e runs with JS off | OK |
| Permissions | yes | `requireTeamMember` on both pages, so every team member can read them. This matches the story ("team member"). | OK |
| Terms from CONTEXT.md | yes | defect, problem report, suitable for helpers, open since | OK |
| Open question recorded | yes | machine record section 4 "open defects" (ST-009) is not built, recorded in OPEN_QUESTIONS.md | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| The defect page of a resolved defect (`/team/defects/<id>` kept in a bookmark) still renders and says "offen seit N Tagen". `defectDetails` does not look at the state. | No rule. The story only defines open defects. Resolving arrives with a later story. | Question: add the resolved state to the page when the resolve story is built (put it in that story's notes). No follow-up story. |
| The count sentence ignores the filter (approved decision) while the list shows fewer entries. | Approved in the test plan. | Fine. The sentence sits above the form and is not worded as a filtered result. |
| The machine overview count is plain text. It does not link to the list filtered by that machine. | No. | Question: a nice-to-have, a candidate for the ST-009 section 4 work. |
| The machine filter only offers machines with open defects, and an unknown or retired museum number in the URL gives "LG-xxx hat keine offenen Defekte." | Consistent with G7. | None. |
| The list has no pagination and is not measured with many open defects (for example 300). | The Definition of done says "fast with realistic data"; the story gives no number. | Question: low risk, no action. |
| The empty-state test does not go through the database. | n/a | Remark only. |
| Two priorities and the helpers filter together with no match give the generic text "passt zu diesem Filter". | Unit-tested. | None. |
| Other language: this is a team page, German only. | ux-guidelines: visitor pages are bilingual, team pages German. | None. |

No gap meets the follow-up hurdle. There is no security or data-loss risk and no named blocked story. All items are minor and can be handled in this story or by existing stories.

## Verdict
**accepted with remarks.** All 11 scenarios have a correctly titled, passing test that checks its Then lines with literal values. The remarks are that "No defect is open" is tested at view level only and that the defect page does not distinguish a resolved defect. Neither needs a new story.
