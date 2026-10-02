# Acceptance – ST-007: Register a machine with its museum number
Date: 2026-10-01 · Tests run: `npx vitest run` → 198 passed (1 run had 1 failure: the LG-999 test timed out at 5000 ms; 3 reruns of `-t ST-007` and 2 further full runs all green) · `npx playwright test e2e/register-machine.spec.ts` → 4 passed · Preview: https://laguardia-elq3djwih-hemi6.vercel.app (not exercised – no technician account there; browser tests are local-only by decision)

Traceability: `check-scenarios.ts ST-007` → 17/17 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| 1 Assigned museum number | register-machine-command.integration.test.ts | Given LG-041 set up through the command in an emptied isolated DB. When through `executeCommand`. Then literals: LG-042 listed with model/location/status, history `[undefined → playable, "registration", eva, fixed time]`, journal entry. Real. | OK |
| 2 Technician gives the number | same | LG-007 + serial MM-12345 asserted (serial via store, per decision), journal data too. | OK |
| 3 Retired never reused | same | LG-050 registered, retired through a test-support command, LG-012 also present; expects LG-051. Real (the highest is the retired one). | OK |
| 4 Reserved numbers count | same | LG-045 corrected to LG-040 via test-support command, LG-041 present; expects LG-046. Real. | OK |
| 5 After LG-999 | same | Registers LG-001..LG-999 except 017 through the command; expects LG-017. Real, but takes about 2.8 s of the 5 s default timeout (see remarks). | OK, flaky risk |
| 6 Concurrent automatic assignment | same | `Promise.all` of two registrations against LG-041; sorted result ["LG-042","LG-043"]. Genuinely concurrent (advisory lock in the facts). | OK |
| 7 Duplicate rejected | same | Covers in use, retired and reserved (the corrected-away number) with the literal error code; nothing extra stored. | OK |
| 8 Other format rejected | same | "42" → `museum-number-format`, nothing stored. | OK |
| 9 Concurrent same number | same | Two parallel LG-060: exactly one ok, the other `museum-number-taken`, one machine stored. | OK |
| 10 Model and location required | same | Missing model, unknown model id, blank location – each rejected, nothing stored. | OK |
| 11 Helpers cannot register | same | Helper actor → `not-authorized`, nothing stored. Goes through the command (the real gate). | OK |
| 12 Spike reports removed | migrations.integration.test.ts | Migrates to 0004, inserts two "test-machine" reports, applies the rest; asserts count 0, column type `uuid`, FK violation named `problem_report_machine_id_fk` for an unregistered machine. All three Then lines checked. | OK |
| 13 No machine registered yet | machine-overview.test.ts (static render) | Renders the view with an empty list: text "Noch kein Gerät erfasst." and link to `/team/machines/new`. Rendering the view rather than the page is a user decision (shared e2e DB). The page-level wiring is not covered when the list is empty. | OK |
| 14 Overview lists machines | machine-overview.integration.test.ts | LG-002 registered before LG-001; exact list in order with all four fields. Retired exclusion is an extra test. | OK |
| 15 Rejected keeps what was typed | e2e/register-machine.spec.ts (+ no-JS variant) | Real form at 360 px: alert text, `aria-invalid` on museum number only, all values kept (model, location, status "limited"). Page width ≤ 360. Also proves the foundation item without JavaScript. | OK |
| 16 Back on overview | same | Goes from team start page via links; status preselected Playable; asserts URL, confirmation text with model, the number generic `LG-\d{3}` (decision), entry listed with location and status. The literal "LG-042" is not asserted (accepted decision, preview/shared DB). | OK |
| 17 Helpers not offered | same | A helper account is created through the UI, logs in, link absent, `/team/machines/new` redirects to `/team`. | OK |
| Foundation 1: error texts | command-errors.test.ts | All six codes have distinct non-empty texts; type check ties `CommandError<registerMachineCommand>` to the team codes. `not-authorized`, `not-found`, `version-conflict` exist in the diff and are covered by the existing test. The `machine-required` text is removed from the visitor catalogues. | OK |
| Foundation 2: runner proof in browser | e2e spec (360 px and no-JS) | Catalogue text, field marked, input kept. | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | Playwright viewport 360, `scrollWidth ≤ 360` on the form (rejected) and the overview. | OK |
| List pages fast with realistic data | yes (overview) | The overview is one joined, sorted query and no pagination. The tests use 0–2 machines (the LG-999 test fills 998 rows but never reads the list). Not measured with, say, 300 machines. | Remark (see questions) |
| Every command writes its journal entry | yes | Journal asserted for scenario 1 (type, actor, aggregate, data). Rejections write none (nothing stored is asserted). | OK |
| Texts from the message catalogs | yes | All UI texts and errors in `team.de.ts`; no literals in the components I read. | OK |
| No personal data in logs | yes | Journal data holds ids, museum number, location and status; no names. | OK |
| Terms per CONTEXT.md | yes | "machine status", "museum number" are used as in the glossary. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| The LG-999 test builds 998 machines serially and takes 2.8 s (up to over 5 s under load: it timed out once in the full run) | DoD: tests must be reliable | Fix now: raise the timeout for that one test, or seed the numbers in one batch. Not a new story. |
| All of LG-001..LG-999 given out → `no-museum-number-free` | The rule only says "next free lower number"; the command has an error and a German text, but no scenario or behaviour test of the command (only the text test) | Question: ok untested? A quick unit test of `registerMachine` would close it (fix now, minutes). |
| "LG-000", lower case "lg-007", surrounding spaces in the museum number (trimmed) | The format rule is "LG- plus three digits": LG-000 matches. Lower case is rejected, spaces are trimmed | Question: is LG-000 a valid museum number? Is trimming intended? |
| Blank museum number "   " is treated as not given → assigned | Context: "if no museum number is given" | Fine, a note only |
| Location and serial number have no maximum length; very long text goes into a card on 360 px | No rule | Question: a length limit? (the card could overflow – not checked) |
| Machine model dropdown: models with the same title are told apart by "(manufacturer, year)"; a model without a year shows "(Williams)" | UX | OK |
| No machine model exists yet → the page offers a link to the models instead of the form | No rule; sensible; not covered by a test | New story not needed; note only |
| The confirmation comes from `?registered=<id>`: a reload shows it again; a retired or invalid id shows nothing; any technician can fake a confirmation for an existing machine through the URL | G3 says nothing | Question: fine for the MVP? |
| Retired machines are not listed (extra test); how a retired machine becomes visible is open | Story: "active machines"; ST-008/ST-009 | Existing stories |
| Helper opens `/team/machines/new` → redirected to `/team` without a message | G11 | Question: an explanation text instead of a silent redirect? |
| Double submit (double tap on a phone) without JS: two registrations without a number get two machines | Not mentioned | Question: protection against double submit? (the runner may handle it; not tested) |
| Machine overview and the nonexistent team navigation: reached only via the start page link | Decided: ST-008 | OK |
| German only on the team side; visitor pages are not affected | Rules | OK |

## Verdict
**accepted with remarks.** Every scenario has a real test that checks its Given/When/Then with literals; all tests pass, the browser tests pass at 360 px and without JavaScript. The remarks, none of which meets the follow-up hurdle (no security or data-loss risk, each fixable here): (1) fix the timing of the LG-999 test (flaky once in the full run); (2) a behaviour test for `no-museum-number-free`; (3) answer the questions on LG-000, maximum lengths and the double submit. Scenario 16 asserts the number generically instead of "LG-042", as decided by the user.
