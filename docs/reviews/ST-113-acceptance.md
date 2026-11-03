# Acceptance – ST-113: A file is attached to machines and machine models instead of belonging to one
Date: 2026-11-03 · Tests run: `node .claude/skills/implement/scripts/verify.ts` → passed; `npx vitest run -t "ST-113"` → 5 passed (1588 skipped); `npm run test:e2e -- e2e/attach-file.spec.ts e2e/attach-photo.spec.ts e2e/file-upload.spec.ts e2e/remove-file.spec.ts` → 15 passed (the attach-photo failure under load did not reproduce in one run) · Preview: none (local testing)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Existing files stay where they were and nothing is indexed again | `src/platform/migrations.integration.test.ts` (isolated DB reset to `0042_yellow_bushwacker`, then `.migrate()`) | Yes. Data is inserted in the old shape, including a removed file, a retired machine, a failed entry, an entry of an old embedding model, a file not indexed yet and a pending upload. Then: machine records of LG-042/LG-043 show literal titles through the real `machineRecord`; "Old manual" is shown nowhere; the AI index entries and items are compared before and after (unchanged); the journal count is unchanged; added_by/added_at carry the old values; original_file_name is null; the pending upload keeps its team member; the old columns are gone. "No request to OpenRouter" is shown by the migration being SQL only, with no AI seam in the test. | pass |
| A file attached to the machine and its machine model shows once | `src/modules/collection/add-file-command.integration.test.ts` | Mostly. Given: CMD-AddFile with "both". Then: both machine records show exactly one entry, category `manual`, `ofMachineModel: true`. The word "Manual" and the mark „Modell“ are checked as data (category, flag), not as rendered text. The grouping and the mark come from the existing view (ST-054) and the e2e tests did not fail. | pass (remark 1) |
| Adding on the machine record adds and attaches in one step (Outline, both forms) | `src/app/(team)/team/machines/[museumNumber]/add-file-on-machine-record.integration.test.ts` | Yes. Both forms go through `formRunner` and `addFileCommand` with the form's `attachTo: machine`. Literals: names `medieval_manual-v2.pdf` and `IMG_2041.jpg`, and LG-043 shows nothing. Checked: the machine record, the confirmation `file-attached`, the journal `EVT-FileAdded` + `EVT-FileAttached` in one step (`lastCommandBy`) with the machine on the attached event, `original_file_name` in the database, and `makesAiWork` on the committed events plus `filesForIndexing`. The actual indexing run is not performed here (see remark 2). | pass |
| Content uploaded by another team member is not added | `.../datei-anhaengen/attach-file.integration.test.ts` | Yes. Anna's pending upload, Tom sends the form. Asserts error `content-gone`, the German text "…Die Datei muss erneut ausgewählt werden.", the title and category kept, no file added, and Anna's upload still usable. | pass |
| A file added on the machine record is searched by an AI assessment as before | `src/modules/ai-assistance/ai-assessment-writing.integration.test.ts` | Yes. The files are added through CMD-AddFile (helper `aFileAdded`), the entries indexed, and the defect belongs to LG-043. Asserts the chat text contains the model manual and not the LG-042 wiring text, and `filesSearched` equals `[manual]`. | pass |

Traceability: `check-scenarios.ts ST-113` → 5/5 covered.

Notes of the story:
- ST-106 / ST-107 tests keep their titles; only their set-up changed (`attach` helper in `ai-scenario.test-support.ts` now calls `aFileAdded`). OK.
- `ai-work-events.test.ts` asserts `EVT-FileAdded` makes AI work, and new rows check that `EVT-FileAttached` does not (stronger than before, not weaker).
- No test was weakened. Changed expectations in the diff:
  - Set-up from `attachFileCommand` to `addFileCommand` / `aFileAdded` (equal assertions).
  - `machineRecord` gets `machineModelId`.
  - The journal expects `EVT-FileAdded` followed by `EVT-FileAttached`.
  - The resets in the e2e database test and the AI tests also clear `file_attachment`.
  - Removed tests that tested the owner concept, which is gone (ADR 0018): "unknown owner" on the upload address, "owner machine-model" upload, "machine that is no machine ID". The remaining rejection (`unknown-machine` for a forged ID) is still tested in `attach-file`, and "refuses a request it does not know" replaces the owner check in the upload route.
  - The "another owner's content" test is converted to "issued to another team member", the same behaviour in the new key.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Gate (lint, typecheck, tests, boundaries, traceability) | yes | `verify.ts` passed; 151 glossary warnings (new ones: "attachment" in `add-file.ts`, `files.ts`, `schema.ts`) | yes (remark 3) |
| Every command writes its journal entry | yes | The add-file test and the command test check `EVT-FileAdded` + `EVT-FileAttached` in one step; the case "attached to nothing" journals only `EVT-FileAdded` | yes |
| No personal data in the journal | yes | The `add-file-command` test "never the title or the original file name" | yes |
| Migration proven before production | yes (risk high) | The migration test above; SQL is hand-checked: the one-target CHECK constraint, NOT NULL on added_by/added_at, the unique indexes | yes (remark 4) |
| UI usable at design size / texts from the catalog | yes (forms unchanged) | The forms keep their texts and landing, only `shared.ts` +1 text; the e2e tests pass | yes |
| Lists fast with realistic data | yes, lightly | Indexes on file_attachment (file, machine, machine model); the record query joins through them | yes |
| Security advisories | not touched | no dependency change | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| A file attached to the model of a machine and also to a second machine of the same model: record of that machine shows it once | Partly (scenario 2 covers machine + its own model) | covered by the same query; question for ST-115 |
| A removed file keeps its attachment but shows nowhere and is not searched | Story context (removed files migrated too) | tested for the record; fine |
| Migration run on a production file with both machine_id and machine_model_id set, or neither | Old schema had an owner of exactly one kind (ST-085) | the new CHECK constraint would fail the whole migration loudly; question: check production data before deploy |
| Migration file 0043 has no `--> statement-breakpoint` between the INSERT and the following ALTER, so both run as one multi-statement query | none | works (the test passes), only a style remark |
| A pending upload of a team member removed or stale form (24 h) | ADR 0009 | covered by existing tests (`uploaded-content`) |
| A long original file name, or one with special characters | none; "no max-length question" memory applies | not raised |
| Visitor or helper role adding a file | ST-037 (team only) | e2e "Files are team-only" passes |
| Two team members adding at the same time | none | new attachments are independent rows; no concern |
| Original file name stored but not shown (ST-119) | Story context | by design |

## Remarks
1. Scenario 2 and the Outline check the shown record as data (flag `ofMachineModel`, category), not as rendered German text. The view itself did not change, and e2e passes. Acceptable.
2. The Outline's "the run … indexes the file" is shown by `makesAiWork` plus the file being in `filesForIndexing`; the indexing itself is proven by the ST-106 tests, whose set-up now uses CMD-AddFile. Together this is enough.
3. The glossary warns about "attachment" in new identifiers (`fileAttachment`, `Attachment`); the glossary term is "File … Attach/Detach". It is a language warning only.
4. The one-run-under-load attach-photo failure did not reproduce (one full run, 15 passed).

Verdict: **accepted with remarks**
