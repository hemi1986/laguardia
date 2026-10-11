# Acceptance – ST-052: Report a problem and link it or resolve it on the spot in the same step
Date: 2026-10-11 · Tests run: `npx vitest run` → 483 passed / 0 failed (79 files); `npx playwright test e2e/report-and-triage.spec.ts` → 10 passed / 0 failed; `check-scenarios.ts ST-052` → 13/13 covered · Preview: https://laguardia-hvqfxt27l-hemi6.vercel.app (behind deployment protection, not exercised; the browser tests ran locally on port 3100 at 360 px)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician reports and resolves on the spot in one step | report-and-triage-command.integration.test.ts | Yes. Stored report with reporter, outcome, triagedBy, literal note and timestamp; `defectId` undefined; no open defect; not in the triage list; journal has exactly the two events with no free text. | pass |
| Technician reports and links in one step | same | Yes. Given: open defect "Left flipper weak". Then: outcome linked with the defect ID, no new defect (titles still `["Left flipper weak"]`), journal events. | pass |
| Helper reports and resolves on the spot in one step | same | Yes. Reporter is Anna, outcome resolved on the spot, not in the triage list, journal. | pass |
| Helpers cannot link a problem report to a defect when reporting | report-and-link.integration.test.ts (form runner) + untitled e2e "a helper who opens the form for linking lands on the plain report form" | Then-part "neither report nor link stored" is checked (counts of reports, journal and photos unchanged, with a photo attached, error `not-authorized`). The When-part "sees the plain form" is only in the untitled e2e test, so the titled test covers half of the scenario. | pass, with remark R1 |
| Helpers' other problem reports still go to the triage list | command integration test | Yes. Untriaged (`triage` undefined) and in the triage list. Extra: a helper's defect-recorded outcome gives `not-authorized` and stores nothing. | pass |
| Technicians are offered all three triage outcomes when reporting | e2e/report-and-triage.spec.ts | Yes. Given: open defect created through the UI. All links asserted in order: "Mit Defekt verknüpfen", "Defekt erfassen", "Direkt behoben", "Zurück zum Gerät"; no inputs on the page; 360 px. | pass |
| No open defect, nothing to link when reporting | e2e | Yes. Link list without "Mit Defekt verknüpfen", sentence "LG-xxx hat keine offenen Defekte." present. | pass |
| Helpers are offered resolving on the spot when reporting | e2e | Yes. "Schon selbst behoben?" and the "Direkt behoben" link with the correct href above the description (box position and DOM order), no other outcome offered, and the plain form sends with a description only (confirmation asserted). | pass |
| A rejected resolution on the spot keeps what was typed | e2e | Yes. Alert text literal; note field `aria-invalid`, description not; description value kept; not stored (checked by absence from the triage list). | pass |
| A rejected link keeps what was typed | e2e | Yes. Radio is unchecked and rendered with title and "offen seit dd.mm.yyyy, hh:mm"; alert "Bitte einen Defekt auswählen."; description kept; not stored (the defect page shows no such report). The "reason shown at the form" is not tied to a marked field, which the scenario does not ask for. | pass |
| A defect resolved in the meantime cannot be linked when reporting | report-and-link.integration.test.ts (form runner) | Nothing stored, description and defectId kept in `values`, error `defect-not-open`, text "Dieser Defekt ist nicht mehr offen.". "The technician stays at the form" is not tested. **Known gap 2a, accepted by the user.** | pass (known gap) |
| After resolving on the spot when reporting, back on the machine record | e2e | Yes. URL, heading, the confirmation as a literal sentence, no "wartet auf die Sichtung", nothing in the triage list. | pass |
| After linking when reporting, back on the machine record | e2e | Yes. Confirmation names machine and defect; no triage wording; report visible on the defect's page. | pass |

## Form paragraph vs. built pages (read from the code and the e2e assertions)
| Point | Result |
|---|---|
| Helpers' `/melden`: "Schon selbst behoben?" and "Direkt behoben" above the description | matches; asserted by position and DOM order |
| Resolve page: heading, "Meldung" (hint, Foto (freiwillig)), "Direkt behoben" with "Was wurde gemacht?", submit, "Zurück zum Gerät" | matches (catalog texts) |
| Link page: heading, "Meldung", "Defekt", defects with title and "offen seit", none preselected, submit, back link | matches. The section heading "Defekt" is followed by a legend "Offener Defekt" (ST-022's text). It reads as a small duplicate and is not in the Form paragraph (remark R5). |
| Rejection texts with the photo sentence "Das Foto muss erneut ausgewählt werden." | tested at the form runner (link and resolve; not after photo rejections, per 3a). Not seen in the browser. |
| Retired text "LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert." on the two new forms | wired (`rejectionText`), but no test on any seam (remark R2) |
| Choice page order and "keine offenen Defekte" sentence | matches |
| ST-015's "wartet auf die Sichtung" absent after both new forms | asserted in e2e |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Scenario tests titled exactly, at the seams | yes | 13/13 covered; vitest and Playwright green | yes |
| Commands via `aggregateCommand`, IDs from events.yaml, journal data without free text | yes | journal asserted with `data` `{}` / `{ defectId }` | yes |
| No `new Date()` / `randomUUID()` in domain code | yes | decision functions get the clock and IDs through the context; fixed clock in tests | yes |
| Server Actions only through the form runner, actor only from `currentPerson()` | yes | both actions use `photoFormAction`; the outcome is fixed server-side. A helper cannot send defect-recorded or link through the resolve form's action, because the action hardcodes `resolved-on-the-spot` and reads only `description` and `note`. | yes |
| Texts from the catalogs | yes | `team.de.ts` | yes |
| 360 px | yes | `scrollWidth <= 360` asserted on the choice page, helper form, both rejections and the machine record | yes |
| Works without JavaScript | yes | untitled e2e test for both forms, rejection plus success | yes |
| Page composed from several modules' queries has a data-function test (conventions seam catalog) | yes, for `loadTriagedWhenReporting` | none (remark R3) | partly |
| List pages fast | not touched | – | n/a |
| No personal data in logs | yes | journal `data` without text; no logging added | yes |
| Migration | no schema change | – | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Machine retired between page load and send, on both new forms | Story Form paragraph fixes the text and says each rejection is followed by the photo sentence. Command rule exists (ST-015). No test on any seam proves the text or that the form stays. | R2: fix now – one runner test (retire the machine, send, expect `rejectionText` = "LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert." with values kept) |
| Machine already retired on page load (`/direkt-behoben`, `/mit-defekt-verknuepfen`) | Shows "Dieses Gerät ist ausgemustert – dafür gibt es keine Meldungen mehr."; no test | R2: add to the same test or a small e2e |
| Machine record opened with `?resolvedOnTheSpot=<id>` or `?linked=<id>` of another machine, of a report with another outcome, or a malformed ID | Code guards it (machine match, outcome match, UUID check). Convention says the page may say nothing the data does not support. No test. | R3: fix now (small integration test for `loadTriagedWhenReporting`) |
| The confirmation stays on a bookmarked or reloaded address and still says "eingetragen" | Same as ST-023's `defectRecorded` behaviour | question – accepted as is? |
| Double submit without JavaScript (two sends = two problem reports) | Button is disabled while pending with JavaScript; no rule against duplicates; same as ST-015/ST-023 | question |
| Helper sends link outcome through the link action | Story: "neither stored". Gets the existing `not-authorized` | known gap 1a, accepted |
| Link to a defect of another machine | `defect-of-another-machine`, tested at the command seam | covered |
| Helper opens `/melden/defekt-erfassen` | ST-023 area; command refuses with `not-authorized` (tested) | covered |
| Defect resolved in the meantime: stays on the form | Story scenario's last line | known gap 2a, accepted |
| Long description or defect title at 360 px | Link labels use `overflow-wrap:anywhere` | question, not tested |
| English texts / visitor | New pages are team pages (German only) | none |

## Remarks (no blockers, no majors)
- R1 (minor): "Helpers cannot link…" is split. The titled test covers only the sending part; "helper sees the plain form instead" is in an untitled e2e test. Consider titling it `ST-052: Helpers cannot link a problem report to a defect when reporting` too, or accept it as is.
- R2 (minor): retired-machine paths of the two new forms are untested (see edge cases).
- R3 (minor): `loadTriagedWhenReporting` has no test, although the conventions ask for one for pages composed from several queries.
- R4 (minor, known): 2a and 1a as accepted.
- R5 (cosmetic): "Defekt" section heading plus legend "Offener Defekt" on the link page.

None of these meets the follow-up hurdle; R2 and R3 can be fixed in this story within the hour.

## Verdict
accepted with remarks

## Resolution (implementation, 2026-10-12)

- **R1 not changed:** one test per scenario title; the redirect of a helper is the untitled browser test beside it, as in ST-023.
- **R2 fixed:** a runner test covers a machine retired while either new form was open – nothing stored, the text, and the photo sentence only where a photo was attached. A machine already retired when the page loads shows no form (`retired && !state`), without a browser test – retiring has no UI before ST-039.
- **R3 fixed:** `triaged-when-reporting.integration.test.ts`.
- **R5 not changed:** the section „Defekt“ is the story's, the legend „Offener Defekt“ is ST-022's choice – for the ux-designer.
- **Double submit without JavaScript** creates two problem reports, as on every form of the application – not new with this story.
