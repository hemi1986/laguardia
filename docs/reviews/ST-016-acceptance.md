# Acceptance – ST-016: Add a photo to a problem report and show it to the team
Date: 2026-10-04 · Tests run: `npx vitest run` → 66 files, 397 passed, 0 failed; `npx playwright test e2e/report-photo.spec.ts e2e/report-problem.spec.ts` → 10 passed (photo tests ran against the Development Blob store); `check-scenarios.ts ST-016` → 11/11 · Preview: none (no machines before ST-068)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Visitor adds a photo taken with the phone camera | e2e/report-photo.spec.ts (real browser, 360 px, real private Blob store) | Given: fresh machine, 4000x3000 sideways JPEG with GPS. When: via the real form. Then: stored file fetched from the technician's view address; asserts jpeg, longest edge <= 2048, upright, <= 1 MB, `exif` and `orientation` undefined. Fully asserted. Skips without the Blob token. | pass |
| Team member adds a photo | team `melden/report-problem.integration.test.ts` | Helper actor, runner with in-memory storage, gallery JPEG; asserts reporter and the stored photo reference. The "choose existing photo" is simulated as a posted file, not a picker. | pass |
| Photo is optional | `report-problem-command.integration.test.ts` | Command-level only (no form post without photo through the new runner; `post()` helper in the form tests adds an empty file field, and the "Failed photo" test resubmits without a photo successfully). Asserts description and photo undefined. Adequate. | pass |
| Non-image content is rejected | visitor `melden/report-problem.integration.test.ts` | PDF bytes named .jpg through the real action; asserts `not-an-image`, values kept, no problem report, nothing stored, German and English text "choose a photo or leave it out". Complete. | pass |
| Photo above the size limit is rejected | e2e/report-photo.spec.ts (+ `accept-photo.test.ts`) | 20,000,001-byte file in the browser: asserts "höchstens 20 MB" text, no photo attached, description kept. Server side >2 MB showing the 20 MB text is covered only by the accept-photo unit test (code `too-large`) and the shared catalog text, not by a form-level test. Acceptable per the user decision. | pass |
| Failed photo keeps the description | visitor `melden/report-problem.integration.test.ts` | Storage write fails; asserts `not-stored`, values contain "Right flipper dead", German text offers retry or send without photo, and resubmission without photo is recorded. Action level, not browser. | pass |
| Technician sees the photo in the triage list | `triage-list.integration.test.ts` | Report with photo and one without; asserts literal view address (clock + 5 min), alt text, exactly one `<img>`, placed with the right entry. | pass |
| Photo is shown in the defect details | `defect-details.integration.test.ts` | Defect from report with photo, a second linked report without; asserts originating report has literal address, linked one none. | pass |
| Visitor sees the privacy notice | e2e/report-photo.spec.ts | en-GB visitor; asserts English notice text inside the "Photo (optional)" group, link to /datenschutz, no horizontal scroll at 360 px. Text is the marked placeholder (user decision). | pass |
| Photo is kept with its problem report | `defect-details.integration.test.ts` | Fixed clock one year later; asserts photo still shown with a fresh address. Time-based rule via clock, good. | pass |
| Only team members can see the photo | `visitor-machine-page.integration.test.ts` | Report with photo exists; asserts page data and HTML contain neither the photo ID nor `<img`. "Cannot be opened": the blob is private and no address is issued on visitor pages; there is no public photo route. Reasonable; there is no HTTP-level check that the blob URL is not publicly readable (the real-store check in e2e fetches only via the issued address). | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e runs the visitor phone at 360 px, asserts no horizontal overflow on the report form (photo group); team triage/defect views not checked at 360 px in this story | OK |
| List pages fast with realistic data | partly (triage list issues one view address per photo) | `photoViewAddresses` signs sequentially (`for ... await`); in-memory trivial, real Blob is a local signing call? Not measured | question |
| Every command writes its journal entry | yes | ReportProblem unchanged; `executeCommand` still used for the command | OK |
| Texts from catalogs | yes | photo error codes in team.de, visitor.de, visitor.en with a test in messages.test.ts; photo-field texts passed in from catalog | OK |
| No personal data in logs | yes | no logging added; photo content not logged | OK |
| Foundation checklist | yes | all ticked items found: storage seam + Blob/memory adapters, lint rule + boundary test, photo `index.ts`, `store-photo.integration.test.ts` (accepted/rejected/throws/not-authorized), runner test in `form-runner.integration.test.ts`, no `randomUUID`/`Date.now` use in photo module (new IDs injected), `photos.md` updated. Last item (engineering conventions) pending user approval – not counted as missing. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| JavaScript disabled | Context: "Without JavaScript no photo is sent – the report still is" (photo-field doc comment). The hidden file input is unreachable; report is still recorded (ST-013 no-JS e2e passes). The story does not say whether a photo is required without JS. | question: accept as documented; add one line to the story Notes |
| Second photo replaces the first | "One photo per problem report" | Handled: `attach` replaces the files list and the preview; remove button clears it. No test (unit/browser). Low risk; remark |
| Rejected report after choosing a photo (e.g. description empty) | Not specified | Form is reset by `key`, the photo must be chosen again (documented in the form). Visitor sees the description kept but the photo lost without a message. Question: acceptable? Recommend note, not a story |
| Retired / not-on-display machine with a photo | CMD-ReportProblem rules (retired: nobody; not on display: visitors refused) | Command is rejected, then withStoredPhoto deletes the photo (covered at module level by the "rejected command" test, not for this specific rejection). No orphan. OK |
| Hand-crafted post > 3 MB | ADR / next.config bodySizeLimit 3mb | The framework rejects before the action runs, so no friendly message and no kept values; only reachable without the browser preparation. Does not meet the hurdle (not security/data loss). Question |
| Real-store behavior of "cannot be opened" for visitors | HS-1 | Blob is private; only issued addresses work (valid 5 min). A team member's address copied to a visitor works for 5 minutes by design. Question for ST-061/ADR 0007, not this story |
| Sequential view-address signing in lists with many photos | DoD: lists fast | Measure when ST-068 data exists; recommend `Promise.all`. fix-now candidate, small |
| Long description plus photo preview at 360 px; German/English photo labels | none | Only the privacy-notice page was checked at 360 px; team pages uncovered. Question |
| Photo notice is a placeholder | user decision 2026-10-04, ST-042 go-live item | Tracked; not a gap |

## Follow-up hurdle
No finding meets the hurdle (none is a security or data-loss risk that cannot be fixed within about an hour). No new story is needed.

## Verdict: accepted with remarks
Remarks: (1) the server-side 20 MB text for a >2 MB post has no form-level test; (2) "second photo replaces first" and the lost photo after a rejection have no test; (3) the sequential `await` in `photoViewAddresses` could be parallelised; (4) no-JS behavior should be written into the story notes.
