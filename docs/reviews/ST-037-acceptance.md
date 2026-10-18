# Acceptance – ST-037: Attach files to a machine or machine model and find them by file category
Date: 2026-10-18 · Tests run: `npx vitest run src/modules/collection src/upload "src/app/(team)/team/machines"` → 30 files, 161 tests passed, 0 failed; `check-scenarios.ts ST-037` → 12/12 covered. Browser tests not rerun (verify.ts --e2e already green, per the task); read only. · Preview: none yet

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Helper attaches a manual to a machine model | `attach-file-command.integration.test.ts` | Real command and DB; the machine record of both machines is read, title shown under Manual. | OK |
| Team member attaches a file to a single machine | same file | Only the single machine's record shows it; the other does not. | OK |
| Large manual is attached | `e2e/attach-file.spec.ts` | Real 60 MB file through the form; confirmation text; link opened, status 200, PDF inline, 60 MB body (literals). | OK |
| Files above 100 MB are rejected | `e2e/attach-file.spec.ts` | 120 MB chosen; "Dateien dürfen höchstens 100 MB groß sein."; the submit then says a file is missing; record shows no files. Server-side size check is covered by the `too-large` integration test. | OK |
| Other formats are only downloaded | `e2e/attach-file.spec.ts` (+ `open-file.test.ts`) | `.rom` file attached through the form; opened through `/team/dateien/<id>`; `content-disposition` contains `attachment`. | OK |
| Files are team-only | `e2e/attach-file.spec.ts` | Fresh browser context without a session, no redirect followed: 3xx to `/login`, no `%PDF` in the body. | OK |
| File category is required | `attach-file.integration.test.ts` | Through the upload form runner; error code, file kept, not on the record. | OK |
| Title is required | same file | Blank title (spaces) rejected; same content is attached on resend. | OK |
| Machine or machine model must be chosen | same file | Empty `attachTo`; not attached. | OK |
| A rejection says what happened to the chosen file | `e2e/attach-file.spec.ts` | Exact text "Bitte einen Titel angeben. Die gewählte Datei ist noch angehängt: manual.pdf", chooser shows "Hochgeladen: manual.pdf", category kept, resend attaches. The "must be chosen again" branch is in the content-gone test. | OK |
| Attaching after the uploaded content is gone | `attach-file.integration.test.ts` | Clock set past the cleanup; error `content-gone`; values kept with `content`/`fileName` empty (chooser empty); exact text "...Die Datei muss erneut ausgewählt werden." | OK |
| No files yet says so | `machine-record.integration.test.ts` | Exact text and the "Datei anhängen" link href. | OK |

All titles match exactly. Not checked in a browser at the DOM level: that the chooser really renders empty after `content-gone` (covered through state values only, with a render-free assertion). Acceptable.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | e2e project runs at 360x800; form uses single-column fields, native selects, `break-all` / `overflow-wrap:anywhere` for long names and titles. No explicit overflow assertion. | OK (remark: long unbroken title/file name is only CSS-covered) |
| List pages fast | n/a | Files are a section of the record, one query. | OK |
| Journal entry per command | yes | `journals the file, its owner and its file category – never the title`. | OK |
| Texts from catalogs | yes | All in `team.de.ts` (`attachFile`, `machineRecord`); wording matches the story (G7, G18, G20, G8a), choices unselected with "Bitte wählen", categories in glossary order. Visitor pages untouched. | OK |
| No personal data in logs | yes | Title is not journaled; file name is only held in the form. | OK |
| Next.js advisories | n/a | No dependency added in this diff. | OK |
| Team-only | yes | `/team/dateien/<id>` calls `requireTeamMember`, 303 to a 5-minute address with `no-store`; SVG is downloaded, not opened. | OK |
| ST-085 check page removed | yes | `upload-pruefen` and its texts deleted. | OK |
| User decisions 1a, 2a, 3a | yes | 1a: texts and kept/delete logic in `rejectionWithFile` plus tests. 2a: route above. 3a: page and link do not check for retirement. | OK; 3a has no test |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Attaching to a retired machine (user decision 3a) | Yes, user 2026-10-18 – offered on retired machines | Nothing is wrong in the code; no test pins the decision. Optional: one small test that the link is on a retired record. Fix now if cheap |
| Zero-byte file | No rule | Question |
| Two files with the same title in one category | No rule; they sort by title and both are listed | Question (probably fine) |
| Whose file name is shown after rejection: user's own file name echoed in an alert (HTML-escaped by React) | No rule | None |
| Media type comes from what the store kept; a mislabelled upload (e.g. HTML sent as `application/pdf`) would open inline from the Blob domain | Story: "PDFs and images can be opened in the browser" | Question; low risk because the store is a different origin and team-only |
| Opening a file whose content was deleted by cleanup after being attached | Not reachable: attached content is kept | None |
| Opening a link on the record after the 5-minute address expired | Handled: link goes through `/team/dateien/<id>` | None |
| Submit while upload runs | Submit button disabled while uploading; a failed upload shows a rejection | OK |
| Unknown or forged file ID at `/team/dateien/<id>` | Returns 404 | OK |
| Machine model files can only be attached from one of its machines' pages; a model with no machine cannot get a file | Story entry is the machine record | None |
| Removing a wrongly attached file | Out of scope (ST-038) | Existing story |
| Other language | Team pages are German only | None |
| Helper vs technician | Both may attach (CMD-AttachFile: any team member); `attachingActors` has both | OK |

## Verdict
accepted with remarks

Remarks (none blocks, none passes the follow-up hurdle): no test for attaching on a retired machine (decision 3a); the 360 px layout of very long titles is only covered by CSS, not by an assertion; the open questions above (zero-byte file, duplicate titles, mislabelled media type) can go to OPEN_QUESTIONS.md if the user wants a rule.
