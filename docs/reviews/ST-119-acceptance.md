# Acceptance – ST-119: Add a file from the file overview, attached to something or to nothing yet
Date: 2026-11-06 · Tests run: `npx vitest run -t "ST-119"` → 6 files, 28 passed, 0 failed (a first run during the parallel e2e gate showed 2 failures, "relation team_member does not exist" = shared-database collision with the background run; the rerun was green). `npm run typecheck` clean. `check-scenarios.ts ST-119` → 9/9 covered. Browser tests (`e2e/add-file.spec.ts`) were NOT run by me (a gate run was using port 3100); read only. · Preview: none (local testing)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A helper adds the first file, attached to nothing | `add-file-from-overview.integration.test.ts` | Yes. Empty overview shows "Noch keine Dateien." with the button below it and a link to the form. The form goes through `formRunner` with the real definition and a helper actor. Landing address, confirmation, "Angehängt an Nirgends angehängt" and the original name are asserted. The confirmation is read from the address plus the person, so another member sees none. "Dateien" lists the file. | OK |
| Adding and attaching happen in one step | same file | Yes. The retired machine is offered last in its group ("LG-041 · Ausgemustert"). The machine records of LG-042, LG-041 and LG-050 show the file. The journal shows one command with FileAdded plus three FileAttached, and the target ids are compared with literals. | OK |
| The title is filled in from the file name | `e2e/add-file.spec.ts` (+ unit `title-from-file-name.test.ts`) | Yes, in a real browser: the prefill, the typed title kept, and an empty title with JS disabled. It also checks that a prefilled title is replaced by the next file (extra beyond the story). Not run by me. | OK (read only) |
| The original file name is kept and is the name of a download | `[fileId]/details/original-file-name.integration.test.ts` | Yes. A title correction goes through the real command. Details show "Ursprünglicher Dateiname: medieval_manual-v2.pdf". The view address carries `filename="…"; filename*=UTF-8''…`. The old file shows no line and has no disposition (as today). Hostile names, zip as attachment and the 200-character cut are covered by extra tests. | OK |
| A file attached to nothing is indexed but not found by an AI assessment until attached | `ai-assistance/file-added-to-nothing.integration.test.ts` | Mostly. It asserts waiting 1 → indexed 1, cost > 0, not found by the first assessment, found by the second after `attachFileCommand`, and indexed count and cost unchanged. Two deviations: the file is `text/plain` instead of a PDF, and it is added via the `scenario.attachFile(… to:"nothing")` helper rather than the form runner. | OK (see minor M1) |
| Files above 100 MB are rejected | `e2e/add-file.spec.ts` | Partly. A real 120 MB file shows the exact text alone, and no file is listed afterwards. But the title and file category are typed AFTER the rejection, so "what was typed is still filled in" is only shown for the second rejection ("Bitte eine Datei auswählen."), not for the 100 MB message itself. Not run by me. | OK with remark (R1) |
| A rejected form says what happened to the chosen file (outline, 2 rows) | `add-file-from-overview.integration.test.ts` | Yes. Both rows go through the runner. Asserted: exact reason + "Die gewählte Datei ist noch angehängt: manual.pdf", filled-in values and the chooser kept, no landing, content still in storage, overview still empty. Extra cases: no file and a gone upload ("Die Datei muss erneut ausgewählt werden."). | OK |
| The machine record keeps adding through the same command | `machines/[museumNumber]/add-file-on-machine-record.integration.test.ts` | Yes. Confirmation on the record, details with "Ursprünglicher Dateiname: wiring.pdf" and "LG-042 · Medieval Madness", and the overview lists it. | OK |
| Someone not logged in cannot add a file | `e2e/add-file.spec.ts` | Yes. GET goes to /login with no form. A forged POST also ends at /login. It needs no account, so it also runs on CI. Not run by me. | OK (read only) |

**Superseded ST-117 scenario "No file yet says what to do":** handled per conventions. The entry `"ST-117": {"No file yet says what to do": "ST-119"}` is in `superseded-scenarios.json`, the test is removed in the same change (`file-overview.integration.test.ts`), and the empty overview is covered by scenario 1. `check-scenarios.ts` accepts it. The PR description must list scenario and test with the reason (not checkable here).

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from the message catalogs | yes | New texts are in `messages/team/collection.ts` (`addFileToOverview`, `added`, `originalFileName`, `fileOverview.add`). Wording matches the story exactly. | OK |
| Page frames, back link (G2a, G17) | yes | `Page` + `BackLink` "Zurück zu den Dateien", heading "Datei hinzufügen", button "Datei hinzufügen" (G14). | OK |
| Entry point G2 / empty state G7 | yes | Button directly under the heading, also in the filter-empty state. Empty: sentence, then button. | OK |
| G3 landing | yes | Details with confirmation, tied to the person (not the address alone). | OK |
| G8 / G8a rejections | yes | Field marked (`aria-invalid`, `aria-describedby`), file kept or reset by the exact wording. The 100 MB text stands alone. | OK |
| G20 nothing preselected, order of categories | yes | `["manual","schematic","photo","other"]`, empty "Bitte wählen" option. | OK |
| G27 attachment choice, retired machines last | yes | Test on labels and order. | OK |
| Journal entry per command | yes | One command, FileAdded + FileAttached×n. The original file name is not in the event data (read in `add-file.ts`). No test explicitly forbids it (M2). | OK |
| No personal data in logs | yes | No new logging. | OK |
| Hostile names (security note of the story) | yes | `safeFileName` + RFC 6266/5987 header, React escaping, tests for CR/LF, quotes, path parts and tags. `/security-review` itself is a separate step and not evidenced here. | OK, see R2 |
| 360 px | yes | e2e asserts `scrollWidth <= 360` on the form; the original-name line has `break-all`. Not run by me. | OK (read only) |
| Lists fast / realistic data | n/a | The form lists all machines and models, as in ST-115 (existing behaviour). | n/a |
| Critical advisories | n/a | No dependency change. | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Typed title is kept after a 100 MB rejection | Scenario "Files above 100 MB…" ("what was typed is still filled in") | Fix now if cheap (R1): the browser test should type before choosing the large file, or an integration check should cover it. Unchecked: whether the form re-keys and loses typed values after the client-side too-large rejection. |
| A very long title or file name (200+ characters) | No max-length question (memory). A file name is cut at 200 characters for header and page. | Question: fine as is. |
| A file name that is only dots or empty ("…", ".pdf") | The story says a name is made safe. Code: no name, so no line and the download name as today. | OK, covered by the code (partly tested). |
| Title prefill for "archive.tar.gz" gives "archive.tar" | Story: "without its last ending" | OK, as specified. |
| The same content twice | Rule in the story: two files | OK. |
| Two team members: a machine is retired while the form is open | Story 2026-11-03: never refused | OK. |
| Helper vs technician | Story: all team members; the test uses a helper for the first scenario | OK. |
| Many machines and models (hundreds) in the form | Existing ST-115 fold pattern | Question: check the form's size with realistic data later. |
| English-language UI | Not planned (UI is German) | n/a |
| Upload interrupted or 'Hochgeladen' not shown, button disabled (`uploading`) | ST-085/ST-037 behaviour | OK. |

## Remarks and minors
- **R1** (see above) The 100 MB scenario test types the title after the rejection. It proves the rejection text but not "what was typed is still filled in" for that rejection. Non-blocking: the same mechanism (client-side check and form values) is covered in the integration test for the other rejections.
- **R2** `/security-review` (story Notes, DoD) is not evidenced in the repository; its running is a hand-off step of the implementer, not a blocker for the tests.
- **M1** The AI test uses `text/plain` and the `attachFile(to: "nothing")` helper, not a PDF through the form runner. The behaviour is the same (CMD-AddFile), but the Given is not literally the story's.
- **M2** There is no test that asserts the original file name is absent from the journal events (the code does not write it).
- **M3** `src/modules/collection/files.ts` and `file-details.ts` import `@/platform/storage/content-disposition` by deep path, not through `@/platform/storage` (the index was extended by 6 lines, so it could be imported from there). Style only.
- **M4** Added e2e "adds a file from the file overview, attached to a machine…" has no `ST-119:` prefix. Harmless (the extra test is not a scenario), but inconsistent.
- **M5** `fileHint` ("Höchstens 100 MB, jedes Format. PDFs und Bilder…") is text not named in the story; it is the ST-037 wording and in the catalog.
- No follow-up story is needed: nothing found is a security or data-loss risk.

## Verdict
**accepted with remarks.** All 9 scenarios have a test with the exact title, the integration tests (28) pass, typecheck is clean, the superseded ST-117 scenario is handled as the conventions require. Condition for the remark: the e2e specs `add-file.spec.ts` must be green in the background gate run (I did not run them). R1 is a weakness in the test of one Then line, not a violated rule.

## After the remarks (implementer)

Full gate with e2e: all ST-119 specs pass. Failures elsewhere were not caused by this story: `ST-090: Every fold looks the same`
fails on `main` too; two navigation specs (ST-100, ST-104) still expected the order before ST-117 put „Dateien“ into „Mehr“ and
`file-overview.spec.ts` expected no empty `attachedTo=` – the expectations were corrected to what is true (nothing weakened).
