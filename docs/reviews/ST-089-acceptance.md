# Acceptance – ST-089: One page width for every page, with fields and submit buttons across the column
Date: 2026-10-29 · Tests run: `npx playwright test e2e/one-page-width.spec.ts` → 6 passed, 0 failed (plus verify.ts: lint, types, unit/integration, traceability green; the 19 upload-spec failures of the full browser run are the known Blob-store environment issue) · Preview: none known, judged from local runs

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A list and its form page have the same width | e2e/one-page-width.spec.ts | 1280 px viewport; goes maintenance plan -> "Wartungsaufgabe hinzufügen" by click; asserts both columns 672 literal, same left edge, navigation link x equals left edge | passed |
| Records, dashboards, login, visitor, legal, not-found | same | Machine record, defect page, dashboard (technician), and login, /m/…, /datenschutz, not-found without session, each 672 literal | passed |
| Fields and the submit button span the column | same | /team/machines/new; every visible input/select/textarea (checkboxes excluded) equals column width, "Gerät erfassen" too | passed |
| Filter forms, one-tap buttons, record buttons as wide as words | same | "Filtern", "Übernehmen", "Status ändern" each < column/3 (a loose but sensible proxy for "as wide as their words") | passed |
| Sticker print page follows the paper | same | three machines, print page; `.sticker-page` is 794 px (A4) | passed |
| No page scrolls sideways at 360 px | same | form page with a rejection shown, list, machine record; `pageWidth` <= 360 | passed |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | scenario 6; padding unchanged, max-width only grows | OK |
| List pages fast | no | layout only | OK |
| Journal entry per command | no | no command | OK |
| Texts from catalogs | yes | no new texts | OK |
| No personal data in logs | no | no logging | OK |
| Conventions paragraph (Page) follows G16 | yes | SKILL.md rewritten, "wide" sentence removed; no `wide`/`widePageWidth` left in src | OK (PR must name the paragraph) |
| Conventions deviations (light check) | yes | shared `Page`/`pageWidth` used, nav lines up, no per-page widths found (grep for max-w-*), no domain-term issues | none |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Form pages whose submit button is not a plain `flex-col` child (other forms with `self-start`) | G16: submit spans column on form pages; grep shows the only remaining `self-start` buttons are one-tap/record buttons (deactivate, dashboard, record) | none |
| Pages with checkboxes/radio groups on a form: only text fields and choices tested | story lists "every text field and choice" | question, fine |
| Print page: the `(print)` layout is outside `Page`; tested at A4 only | story | none |
| Dark mode / other language | out of scope (ST-090) | none |
| Interpretation: content column 672 px (page box 704 px) vs earlier `wide` column 640 px | story context explicitly measures the column without margin | ok |

Minors: none. Skipped minors: the "as wide as their words" check uses `< column/3` rather than comparing to text width; acceptable.

## Verdict
accepted
