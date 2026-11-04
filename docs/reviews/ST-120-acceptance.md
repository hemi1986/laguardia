# Acceptance – ST-120: An AI assessment follows what a file is attached to
Date: 2026-11-04 · Tests run: `npx vitest run -t "ST-120"` → 7 passed, 0 failed (4 files); `check-scenarios.ts` 7/7 covered; `verify.ts` passes (reported by caller) · Preview: none

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Searches only what is attached to the machine or its machine model | ai-assessment-writing.integration.test.ts | Machine, model and attachments set up with literals. Run through the AI-assessment work. Asserts files searched, search text (MM, Wiring in; Eight Ball out), files told (titles) and the dropped reference. | pass |
| A file attached to both is searched and offered once | same | "both" attachment. Asserts one entry in "Dateien" and one passage in the request. | pass |
| Files read when the writing begins count | same | Attachments are changed in the fake embed step. Asserts the Wiring reference kept, the Backbox reference dropped, and Backbox neither searched nor told. | pass |
| The AI index stays whole | migrations.integration.test.ts (reset to 0044, then migrate) | Indexed, waiting, failed and an old-model entry are set up. The overview is equal before and after, with exact counts and reason. No OpenRouter requests. A real assessment after the migration finds the manual. | pass |
| The events of the AI index name no machine | file-removal.integration.test.ts | Index then remove. Both events present, machineId null, no machine id or machineModelId in the data, and nothing under the machine's journal. | pass |
| Cost counts entries from before and after | ai-index-overview.integration.test.ts | An old entry with a machine (0.10) is inserted. A new indexing (0.05) is run through the real work. Asserts "0,15 $". | pass |
| Failed files no longer name a machine | same | Attract mode.mp4 fails. Asserts the failed record (no owner), the line text, no "LG-042" and one "Erneut versuchen". | pass |

Superseded ST-109 scenario is listed in `superseded-scenarios.json` and its test is removed. Migration 0045 drops the check constraint and both columns.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Journal entry per command | yes | Events carry no machine. Old entries are still readable (cost scenario). | OK |
| Texts from message catalog | yes | `messages/team/ai-assistance.ts` changed. | OK |
| No personal data in logs | yes | Nothing new is logged. | OK |
| Design size / list speed | marginal | The form drops one text fragment. No new list. | OK |
| Done stories not reopened | yes | The ST-107, ST-106 and ST-109 fixtures follow the new shape, and titles and assertions stay. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| A file attached to nothing is now indexed (`filesForIndexing` no longer joins attachments) | ADR 0018 / story ("counts every file that is not removed") – consistent | none |
| A removed file still attached: stays in the reference list (removed: true) | ST-107/108 rule – kept | none |
| Machine of a defect has no machine model, or the defect is gone: empty file list | not stated | question (low) |
| A file attached to 100+ things or very many files: the whole list is sent to the chat model | not stated | question for ST-115 |

Verdict: **accepted**
