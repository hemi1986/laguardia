# Acceptance – ST-013: Visitor reports a problem at the machine
Date: 2026-10-03 · Tests run: `npm test -- -t "ST-013"` → 5 passed (2 files); `npx playwright test e2e/report-problem.spec.ts` → 4 passed · Traceability: `check-scenarios.ts ST-013` → 8/8 covered · Preview: not checked (the preview database has no machines before ST-068, so only the unknown-number path would be visible; local e2e covers the rest)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Visitor reports a problem | `report-problem-command.integration.test.ts` (command: stored row, reporter visitor, time with fixed clock, journal) + untitled e2e "a visitor's problem report brings them back…" (`e2e/report-problem.spec.ts`) | Yes. Given: registered playable machine. When: the command for the first half; the real form page in a 360 px phone context for the second. Then: literals for description, reporter, time. The e2e covers redirect to `/m/<no>?…`, the confirmation in de and en. Remark: the e2e test is not titled `ST-013: …`, so the "back on the page with confirmation" half has no title link (the title is satisfied by the command test). | pass |
| Visitor machine page shows the number of untriaged problem reports | `visitor-machine-page.integration.test.ts` | Yes. Two reports with fixed clock yesterday/today; asserts "Schon 2× gemeldet…" / "Already reported 2 times…" and that neither description appears. | pass |
| One untriaged problem report is shown in singular | same | Yes, de and en literals. | pass |
| No hint without untriaged problem reports | same | Yes. Weak but adequate: `not.toContain("gemeldet")` / `"reported"`. | pass |
| Description is required | `e2e/report-problem.spec.ts` (+ command test "rejects … without a description and stores nothing") | Yes. Real form, empty submit, alert text "Bitte beschreibe das Problem.", `aria-invalid`, width ≤ 360; command test asserts nothing stored and no journal entry. | pass |
| Overlong description | `e2e/report-problem.spec.ts` (+ command test 2000 ok / 2001 rejected) | Yes. Alert "Bitte kürzer: höchstens 2000 Zeichen.", typed text kept (`toHaveValue`), boundary tested at command level. | pass |
| No reporting for machines not on display | `report-problem-command.integration.test.ts` | Yes at command level: error `machine-not-on-display`, nothing stored, no journal entry. The story rule says the command rejects, so this is the right level. The rejection message through the form is not tested (see edge cases). | pass |
| No contact data is asked for | `e2e/report-problem.spec.ts` | Yes for "requested": exactly one visible field named `description`, with and without JavaScript. "Stored": `storedProblemReport` equality in the command test shows only id, machine, description, reporter `{kind:"visitor"}`, time. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e uses a 360 px mobile context and asserts `scrollWidth ≤ 360` on form, rejections and confirmation | OK |
| List pages fast with realistic data | partly (no list; page adds one `count(*)` per request on `problem_report.machine_id`, which has no index) | `schema.ts` | OK now; add an index with the triage list (ST-017) |
| Command writes its journal entry | yes | tests: `EVT-ProblemReported` with the visitor as actor; nothing journalled on rejection; description not in the journal | OK |
| Texts from message catalogs, both visitor languages | yes | `visitor.de.ts` / `visitor.en.ts` (form, hint, confirmation, error texts); e2e runs de-DE and en-GB | OK |
| Language choice like the machine page | yes | page uses `currentVisitorMessages` and `VisitorLanguageSwitch` with back to `/melden`; e2e picks language by browser locale. The manual switch on the form page is not tested | OK (remark) |
| Works without JavaScript | yes | the only no-JS e2e run is the happy path ("No contact data"); the form uses `useActionState` with a plain `<form action>` and the page is server-rendered. Rejection (kept text, alert) without JS is not tested, although the form's doc comment claims it | OK (remark) |
| CSRF | yes (story, ST-003) | Server Action (Next.js built-in origin check); no test in this story posts from a foreign origin | OK by platform; no story-specific test (remark) |
| No personal data in logs | yes | journal entry carries no description and no reporter data | OK |
| Machine ID not exposed on the public machine page | yes | `loadVisitorMachinePage` strips `machineId`; existing test checks no UUID in HTML. The form page does carry the ID in a hidden field, which is needed to post | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Visitor opens `/m/LG-030/melden` for a machine Not on display directly: the form renders in full, the visitor types and is refused only on submit | Story Context: "if its report form page is opened directly anyway, the command rejects" – satisfied as written | question: acceptable, or should the page itself show the "not on display" text instead of the form? (UX only, no rule violated) |
| Rejection text for not-on-display and unknown machine in the form (`machine-not-on-display`, `machine-not-found`) is not shown in any test; the form marks only description errors invalid | no | fix now (optional, small): one test of the form refusal for LG-030 |
| Rejection without JavaScript (empty / overlong) is not tested, the doc comment claims it works | DoD "no JavaScript" in this review's task | fix now (small): run the two rejection e2e tests with `javaScriptEnabled: false` too |
| Untriaged count counts every problem report; once triage exists (ST-017/ST-018) triaged ones must drop out. ST-018 scenario line 44 already says "no longer counts that problem report", the code comment points to ST-018 | ST-013 context: counts untriaged ones | no action; ST-018 owns it |
| Count query has no index on `problem_report.machine_id` | DoD performance | take into ST-017 (triage list needs it anyway) |
| Retired machine: reporting is not rejected for visitors on a retired machine | story Out of Scope (ST-039, ST-055) | covered by existing stories |
| Team member opens `/m/LG-042/melden` while logged in: no redirect to the team page (the machine page redirects, ST-011) and the report is made as the team member | ST-011 / ST-015 | question: does ST-015 decide this? |
| Description of exactly whitespace, or 2000 characters plus trailing spaces: length is measured after trim, in UTF-16 units (an emoji counts 2) | story says "at most 2000 characters" | question: acceptable; mention in ST-013 notes if wanted |
| Double submit without JavaScript (button is disabled only with JS) creates two problem reports | D3: no rate limits; spam handled by triage | no action |
| `?gemeldet=1` shows the confirmation again on reload/bookmark, and anyone can craft the link | none | no action (harmless) |
| Very large post bodies (over the Server Action body limit, 1 MB by default) give a framework error rather than "Bitte kürzer" | story scenario "Overlong" (2000+ chars) | question: low risk, leave |
| The maximum length "2000" is written into both message texts rather than taken from `DESCRIPTION_MAX_LENGTH` | story: "maximum length shown" | no action (a literal in a catalog is acceptable) |

Follow-up hurdle: no finding is a security/data-loss risk that blocks a named story and cannot be fixed in an hour – **no new story is needed**.

## Verdict
**accepted with remarks.** All 8 scenarios have a real test that goes through the real entry point and asserts the scenario's literals; all tests pass. Remarks to consider in this story (about an hour in total): run the two rejection e2e tests also without JavaScript, add one test showing the not-on-display refusal through the form, and give the e2e test of the first scenario the `ST-013: …` title prefix (or add the confirmation assertion to a titled test).

## Resolution (main session, 2026-10-03)
1. Fixed: the browser test now carries `ST-013: Visitor reports a problem` and checks the redirect, the confirmation in both languages and the count.
2. Fixed: new browser test without JavaScript – a rejected report names the reason, marks the field and keeps the description.
3. Fixed: new browser test – the report form of a machine not on display refuses with the reason in words.
4. Unchanged: CSRF is the platform's (ST-003, `e2e/security.spec.ts`, `src/proxy.ts` covers `/m/…/melden`).
Questions (direct form of a machine not on display, team members on `/melden`, UTF-16 counting) go to the user with the pull request.
