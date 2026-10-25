# Acceptance – ST-038: Remove a file
Date: 2026-10-25 · Tests run: `npx vitest run -t "ST-038"` → 5 passed (4 files); `npx vitest run src/modules/collection "src/app/(team)/team/machines"` → 196 passed; `npx playwright test e2e/remove-file.spec.ts` → 2 passed (not skipped) · Preview: none (checked locally)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician removes a file | `datei-entfernen/[fileId]/remove-file.integration.test.ts` | Given: model file stored in the memory storage (real DB). When: through the form runner with the form definition, as technician, fixed clock. Then: file gone from `machineRecord`, content gone from storage, journal entry EVT-FileRemoved with actor, aggregate and `occurredAt` as literals. Good. | pass |
| Removal needs a confirmation | `e2e/remove-file.spec.ts` | Real attach flow, click "Entfernen", asserts the literal question text, clicks "Zurück", asserts the file is still linked. Good. | pass |
| Helpers cannot remove files | `src/modules/collection/remove-file-command.integration.test.ts` | Given: file exists. When: helper runs the command. Then: `not-authorized` and the file is still in the record. Tested at the command, not the page. | pass |
| A removed file stays removed | same file, plus e2e second test | Removed, then `fileToOpen` is undefined, a second removal gives `file-removed`, record empty. The e2e opens the former address and gets 404. Good. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px usable | yes | Link in the files list, question page with wrapping text (`overflow-wrap:anywhere`), buttons `flex-wrap`; e2e runs on the project's phone viewport | OK |
| List pages fast | no | one extra `isNull` filter | OK |
| Command writes journal entry | yes | EVT-FileRemoved asserted in the form test | OK |
| Texts from catalogs | yes | `collection.ts` messages (`removeFile`, `fileRemoved`, `file-removed`) | OK |
| No personal data in logs | yes | `deleteRemovedContent` logs only the stored content name and the error message | OK |
| Advisories | n/a | no dependency change | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Helper opens the question URL directly | Story: "action is rejected"; page calls `requireTechnician` (sends away), the command refuses anyway. No page-level test found. | remark: add a test of the page guard if cheap; otherwise fine |
| Two technicians remove at once / stale page | Handled: version conflict and `file-removed` text; form test covers the version conflict | none |
| Storage delete fails after commit | ADR 0009: logged, removal stands, content is orphaned (log line to delete by hand) | question: is a manual clean-up acceptable? Not covered by a test |
| Blob content deletion in the e2e run | Not asserted at the e2e level (only with the memory adapter) | none, adapter is the seam |
| File of a retired machine / "Not on display" | Not stated in the story; the link shows wherever the files section shows | question |
| Removed file's title in the confirmation (`?fileRemoved=id`) | Shown only to the actor who ran the last command on it, for a file of this machine | none |
| English UI | Team pages are German only | none |
| Replacing a file | Out of scope in the story | none |

Verdict: **accepted**

## Resolution (main session, 2026-10-25)
- Helper opening the question URL: skipped – `requireTechnician` is the shared page guard (tested with ST-005's pages), and the command refuses helpers (`ST-038: Helpers cannot remove files`).
- Storage delete fails after commit: as ADR 0009 decided – logged by name, removal stands; now tested at `deleteRemovedContent` (`src/platform/storage/delete-removed-content.test.ts`).
- Retired / "Not on display" machine: removal is offered wherever attaching is (ST-037: a retired machine's record too) – the files stay useful, and a wrong one should be removable.
