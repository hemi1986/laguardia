# Acceptance – ST-064: Legal pages for the visitor pages in German and English
Date: 2026-10-04 · Tests run: `npx vitest run src/app/visitor-legal-links.test.ts` → 1 passed; `npx playwright test e2e/legal-pages.spec.ts` → 3 passed; `check-scenarios.ts ST-064` → 4/4 covered · Preview: none (local run only)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Visitor opens the privacy notice | e2e/legal-pages.spec.ts | Given: de-DE phone, real machine page of a registered machine. When: clicks the "Datenschutz" link. Then: URL /datenschutz, German h1 "Datenschutzhinweis" inside lang="de", text "Wir erheben keine Kontaktdaten". Note: the content asserted is placeholder text. | pass |
| Legal pages in English | e2e/legal-pages.spec.ts | Switch via the real language button, then the "Privacy" link, English h1 and sentence inside lang="en". The imprint branch is conditional and does not run today. | pass (imprint half untested) |
| Legal pages are reachable from every visitor page | e2e/legal-pages.spec.ts | Machine page, report form and real confirmation after sending a report: the "Rechtliches" nav has the privacy link with href /datenschutz. Imprint is checked only if present. | pass |
| Imprint only if the museum provides one | src/app/visitor-legal-links.test.ts | Rendered-view test of both catalogue states: no "/impressum" or "Impressum" when null; the link appears when an imprint exists. It renders the component, not a full page, as the approved plan says. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e visitor context uses 360x800 mobile; links are a small flex row | OK |
| List pages fast | no | no lists | n/a |
| Journal entry | no | no command | n/a |
| Texts from the message catalogs | yes | `legal` section in visitor.de/en.ts; pages only render catalog texts | OK |
| No personal data in logs | yes | nothing logged | OK |
| Visitor page also reachable for not-found machine / start page | yes | links added to start page and the machine not-found page | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Conditional imprint branches in e2e: with `imprint: null` the "Imprint" part of scenarios 2 and 3 never runs, and nothing asserts `/impressum` returns 404 | Scenario 4 covers "not offered", not the direct URL (user decision says 404) | Acceptable for now, since the museum has no text and the unit test covers both states. Remark: add a one-line e2e assertion for the 404 on /impressum now (cheap), and make the imprint-present path a check in ST-042 when the text arrives. Not a new story. |
| Ships placeholder privacy notice, which says PLACEHOLDER on the page | User decision 2026-10-04; ST-042 go-live checklist item added | Fine; the placeholder removal is tracked in ST-042. Must not go live before then. |
| Language switch on legal pages returns to the same page (back=path) | Context: language follows machine page | Works by design; not browser-tested (question: confirm manually) |
| Legal links on the team area | Out of scope | none |
| Retired machine page / "Not on display" page | Not stated | Question: "every visitor page" - not-on-display uses the machine page, which has the links; retired not separately tested. |
| English catalog has an imprint while German lacks one | messages.test.ts requires the same keys | covered by existing test |

Verdict: accepted with remarks

## Resolution (2026-10-04, /implement refactor step)
- 404 on `/impressum` without an imprint: new e2e test "the imprint address is not found while the museum provides no imprint".
- Language switch on a legal page: now browser-tested inside "ST-064: Legal pages in English" (English → Deutsch → English stays on `/datenschutz`).
- Retired machine: its visitor machine page uses the same `VisitorPage` frame as every visitor page (code review finding 1), so it carries the legal links by construction; no separate test.
- Imprint-present path: checked with the museum's text under ST-042's go-live item.
