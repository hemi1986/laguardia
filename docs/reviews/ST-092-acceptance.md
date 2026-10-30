# Acceptance – ST-092: Sections, lists, filters and links take one shape on every page
Date: 2026-10-30 · Tests run: `npm test -- -t "ST-092"` → 4 passed (2 files); `npx playwright test e2e/one-shape.spec.ts` → 12 passed; `check-scenarios.ts` → 16/16 covered · Preview: none (local run)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Defect page: framed sections, headed by title | one-shape.spec.ts | Two real work-log entries; h1 = title; machine link first in main with "LG-0xx · Medieval Madness"; every section's frame (bg, radius, shadow) and heading tag/size compared with machine record's first section | pass |
| History pages and repair times framed | one-shape.spec.ts | Real defect, real maintenance record; same comparison on repair history, a history entry, Wartungseinträge (h1 checked), repair times | pass |
| Empty section says so in its frame | one-shape.spec.ts | Defect without work; h2 "Arbeitsschritte" and sentence inside `[data-slot=card]` | pass |
| Only the verb of a question page is red | machine-record.integration.test.ts (view seam, not browser) | Class of "Gerät ausmustern"/"Entfernen" equals "Status ändern" class; no `bg-destructive` on the record; only "Endgültig ausmustern" red on question. Weaker than the browser (no computed colour), accepted because Blob is suspended. "Wartungsaufgabe entfernen" and "Endgültig verwerfen" are not asserted (not in the scenario); I confirmed in code that all three are `destructive` only on the confirm step, `outline` otherwise | pass (remark) |
| Retired filter without search | one-shape.spec.ts | Empty search verified, tick + "Filtern", URL, "Ausgemustert" marker, still ticked | pass |
| Filtering keeps the search | one-shape.spec.ts | Search by model title, then filter; counts 2, other machine absent, field keeps value | pass |
| Searching keeps the filter | one-shape.spec.ts | Reverse order; both machines listed, tick kept | pass |
| Team members filter "Filtern" | one-shape.spec.ts | Real deactivated account; button width < text + 40 px; "Deaktiviert" shown | pass |
| Sticker search labelled like overview | one-shape.spec.ts | Visible label "Suche", no placeholder, hint text visible below field | pass |
| Change lines on technician dashboard | technician-dashboard.integration.test.ts | Fixed clock, literal strings, order, links for defect and machine | pass |
| A machine is one link everywhere | technician-dashboard.integration.test.ts | Dashboard and due-maintenance view both asserted with literal link text | pass |
| Stale claim like an open defect | technician-dashboard.integration.test.ts | Literal entry text; title link followed by the machine line | pass |
| Confirmation under the heading | one-shape.spec.ts | `h1 + *` holds the status; y-order checked above the add link | pass |
| Pages without a way on | one-shape.spec.ts | Sticker selection href, login, legal page, retired visitor page (German) with "Zur Startseite" | pass |
| Back links have one shape | one-shape.spec.ts | Computed type/colour/underline equal to the example on four links, width equals words | pass |
| Checkboxes one size | one-shape.spec.ts | Bounding box of sticker checkbox equals the due-maintenance filter checkbox | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px width | yes | `pageWidth <= 360` asserted on defect page, repair times, machine overview, members, stickers, login/legal/visitor | OK |
| Lists fast with realistic data | no new queries, only presentation | diff touches data only in the dashboard's change lines | OK |
| Journal entry per command | no command changes (events: []) | – | n/a |
| Texts from catalogs | yes | new texts in `src/platform/messages/team/*`; "Zur Startseite" via `messages.machinePage.toStart` / `teamMessages.login.toStart` | OK |
| No personal data in logs | no logging added | – | OK |
| Advisories | not touched | – | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| English visitor page of a retired machine ("To the start page") is not tested; the e2e visitor uses de-DE only | Story F13 requires English on visitor pages | Covered by the shared `toStart` message; the not-found pages already used it. Optional check, no action |
| Filter on the machine overview with a very long search term at 360 px | none | question, no action |
| "Wartungsaufgabe entfernen" and "Endgültig verwerfen" colour not asserted in a test (only the code was read) | G30 | Cheap to add, but the scenario names only machine and file; no action |
| Filter tick plus pagination or sorting of the overview, if it exists | none | question |
| Dark mode: shape checks compare computed colours in light mode only | feature is `consistent-layout-dark-mode`; a later story | out of scope here |
| The red check is at view level, so a CSS regression in the `destructive` variant is not seen | G30 | accepted; environment limit (Blob suspended until 2026-11-27) |

No finding passes the follow-up hurdle.

## Verdict
accepted with remarks

Remarks: the red scenario is tested at the view seam (class comparison), not in the browser. This is reasonable given the suspended Blob store. Nothing blocks.
