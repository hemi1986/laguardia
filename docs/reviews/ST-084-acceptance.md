# Acceptance – ST-084: Report forms say that the photo must be chosen again after a rejection
Date: 2026-10-23 · Tests run: `npm test -- -t "ST-084"` → 5 passed, 0 failed (2 files); `npx playwright test e2e/report-photo.spec.ts -g "ST-084"` → 1 passed · Preview: none (checked locally; verify and --e2e were reported green on 98686e6)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Team report form says the photo must be chosen again | `e2e/report-photo.spec.ts` (browser); plus an unnamed integration test in the team `report-problem.integration.test.ts` | Given: logged-in helper, real machine, photo chosen in the browser. When: submit via the form with no description. Then: literal text asserted, "Foto entfernen" count 0, machine record shows no problem report awaiting triage. The integration twin checks no report and no stored photo. Yes | pass |
| Visitor report form says the photo must be chosen again | visitor `report-problem.integration.test.ts` | Given: photo, empty description, German. When: through the real runner with the form's fields and input. Then: no report, no stored photo, literal DE text through `reportRejectionText`, the function the form renders. Yes (the form's markup is not rendered, which the approved plan accepts) | pass |
| Visitor report form in English … | same file | Same set-up; the literal EN text is asserted. Also checks no-photo and a rejected photo in English | pass |
| No photo sentence without a photo | team `report-problem.integration.test.ts` | No photo, empty description. Literal „Bitte das Problem beschreiben.“, and no "Foto" in the text. Yes | pass |
| A rejected photo gets no extra sentence … | same file | Given: a PDF as the photo, description "Left flipper weak". Then: no report, nothing stored, ST-016 text as a literal, no "erneut ausgewählt", description kept. Yes | pass |

Traceability: `check-scenarios.ts ST-084` → 5/5 covered.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | The e2e test asserts scrollWidth ≤ 360 on the team form after the rejection. The visitor form only gets a longer message | OK |
| Fast list pages | no | – | n/a |
| Journal entry | no | No command is changed | n/a |
| Texts from the message catalogs | yes | `teamMessages.forms.photoAgain`, `visitor.de/en reportForm.photoAgain`, and `description-required` in the team catalog | OK |
| No personal data in logs | yes | No logging added | OK |
| Advisories | not part of this story | – | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| The visitor's `not-stored` case (photo fine, storage down) now says "…ohne Foto. Das Foto muss erneut ausgewählt werden." Test `ST-016: Failed photo keeps the description` asserts `photoAgain: true`. | Story Context: the sentence follows every rejection except the photo's own three (too-large, not-an-image, unsupported-format). So correct. The wording reads slightly redundantly next to "Versuche es noch einmal". | question (optional wording, no fix needed) |
| The other team photo forms (`direkt-behoben`, `mit-defekt-verknuepfen`, `defekt-erfassen`) now share `photoRejectionText` and show „Bitte das Problem beschreiben.“. I checked direkt-behoben, which uses the shared text. | Story Context: ST-023's form shows the new wording too. Existing e2e and integration assertions were updated. | none |
| Team `not-stored` on the team form: handled the same way via the shared runner. | Same rule | none |
| Non-photo rejections of the other team forms (no photo step) never get the sentence. | Yes: no photo, no sentence | none |
| Photo attached but the description is only whitespace or too long: `description-too-long` also gets the sentence. | Context: "every other rejection" | none |
| Screen readers: the rejection is one alert, so the sentence is read together with the reason. | – | none |
| No test renders the visitor form (client component) in a browser, so the wiring `reportRejectionText(state, messages)` is covered by the e2e test of the pre-existing visitor test. That test, which checks the DE sentence after a rejection, was updated and passes in the same spec file. | Approved test plan | none |
| Concurrency, a retired machine, the machine status "Not on display": the rejection text for those errors is unchanged, and the sentence is appended when a photo was attached. | – | none |

## Verdict
accepted. All five scenarios have a real test that asserts the literal texts from the story, and all pass. No rule is violated and no finding reaches the follow-up hurdle. One optional remark: the `not-stored` message plus the sentence reads a little redundant. That is a wording question, not a defect.
