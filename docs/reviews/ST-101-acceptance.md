# Acceptance – ST-101: Welcome page with the machines on display to report a problem
Date: 2026-10-31 · Tests run: `npx vitest run --project integration src/app/welcome-page.integration.test.ts` → 8 passed; `npx playwright test e2e/welcome-page.spec.ts` → 1 passed; `check-scenarios.ts ST-101` → 9/9 covered · Preview: none (not checked)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| The machines on display are listed by machine category and title | welcome-page.integration.test.ts | Machines registered through commands; page data plus the real view rendered. Asserts sentence before the first section, group headings and order, entry texts with location, no museum number, no "Sonstiges". | OK |
| Machines that are not playable say so | same | Out of order / Limited / Playable set at registration; literals "Außer Betrieb", "Eingeschränkt", and the Playable entry exactly "Pac-Man Halle 3". | OK |
| Machines not on display and retired machines are not listed | same | Status and retirement set up; checks neither title nor number appears, and a normal machine does. | OK |
| Tapping a machine opens its visitor machine page | same | Number corrected via command; asserts href `/m/LG-043` and that the visitor machine page loader accepts it with reporting possible. | OK |
| The welcome page in English | same | English locale; heading "Pinball", "Out of order", English sentence, no German sentence. "As entered" is only weakly shown (title and location have no translation to compare), but nothing translates them. | OK |
| With the listing switched off only the museum is shown | same | Switch off via the museum-settings command; h1 is the museum name, no sentence, no machine, no list; login and privacy links present. | OK |
| No machine on display shows no list | same | Only Not on display and retired machines; no sentence, no section, no ul; name and links present. | OK |
| Team members see the same welcome page | e2e/welcome-page.spec.ts | Real login, real settings form, a logged-in page and a separate visitor context compared. Same entry text, same h1, same sentence, "Anmeldung fürs Team" present, 360 px width checked, tap leads to /m/<number> with "Problem melden". Local only (needs the technician), as in the other team specs. | OK |
| Changes are visible at the next page load | same integration file | Page loaded, then moveMachine and changeMachineStatus commands, then loaded again. Asserts the new location and "Außer Betrieb". | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e checks page width <= 360; simple single-column list, whole entry is a link | OK |
| List pages fast with realistic data | yes | One joined query, sorted in memory for ~60 machines; page renders per request | OK |
| Every command writes its journal entry | no | Read model only, no command | n/a |
| Texts from the message catalogs | yes | visitor.de.ts and visitor.en.ts extended; no literals in the view | OK |
| No personal data in logs | yes | Nothing logged; public data only | OK |
| Advisories | not touched | No new dependency | n/a |
| Always current | yes | Page reads language (request-bound), so it is rendered per request; covered by the changes scenario | OK |
| Module boundary / traceability | yes | `welcomePage` exported from the collection module index; check-scenarios OK | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Two machines of one model, ordering by location then number | Yes, story Context ("by location, then by museum number"); implemented (numeric collator), no test | Fine as is; optional unit test |
| Machine model title in the "Ä" case ("Ä" sorts with "A") | Yes, story Context; the Intl.Collator with base sensitivity handles it, untested | Fine as is |
| Very long title or location on 360 px | No rule | Question: wrapping is not asserted in a test; the flex-col spans should wrap. No action |
| Privacy/legal links on a page with a list | Context item 5 | Provided by the shared VisitorPage; the integration tests assert them only on the off/empty pages. No action |
| Database failure on the root page | No rule | Question for the platform error page; not specific to this story |
| English visitor sorting titles by English collation | Yes, story ("visitor's language") | Implemented |

Verdict: accepted
