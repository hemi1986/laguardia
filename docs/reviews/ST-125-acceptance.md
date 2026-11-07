# Acceptance – ST-125: The proposal offers files the museum already has
Date: 2026-11-07 · Tests run: `npm test -- -t "ST-125"` → 6 passed, 0 failed (3 scenario tests + 3 unit tests); `npm run typecheck` green; `npm run lint` 0 errors · Preview: none

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A file the museum already has is offered | `ki-vorschlag/[proposalId]/existing-files.integration.test.ts` | Given: indexed file "Pinball wiki – System 11" attached to a machine model (a generic registered machine's model, not "Funhouse"; PDF content type, not Markdown – cosmetic). When: real run of `aiModelProposalWork` against the in-memory OpenRouter, page from `aiModelProposalPage`. Then: asserts the search text, group above "Aus dem Netz laden", title, category, checked `existingFile` input and the `/team/dateien/<id>/details` href. | pass |
| A file attached to nothing is found too | same file | Given: file attached to nothing, indexed. Then: the document is kind `file` and first before the link, and the page contains the group and the title. | pass |
| Nothing found in the museum | same file | Given: a file without an AI index entry (the AI index finds nothing). Then: only link documents and no group on the page, "Aus dem Netz laden" is still there. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from the message catalog | yes | `alreadyInTheMuseum`, `details`, `fileDetails`, `attachTick` in `src/platform/messages/team/ai-assistance.ts` | yes |
| Journal entry per command | yes | The existing `writeAiModelProposalCommand` writes it. The embedding model is now passed on, and the documents carry the file ID. | yes |
| Existing files count within the 10, first | yes | unit test "offers existing files first, within the 10 documents" | yes |
| Only files that are not removed, with an entry of the current embedding model | yes | `filesForAiModelProposal` filters `removedAt IS NULL`; the search is scoped to `embedded.model`. No test with a removed file (see below). | yes, with remark |
| Hit count fixed, not a setting | yes | `searchAiIndex` | yes |
| Design size and performance | yes (small UI) | One extra list group, same layout components. No realistic-data check was possible without a preview. | not verified |
| No personal data in logs | yes | No new logging | yes |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| A removed file that has an index entry | yes ("not removed") – no test | question: add a test (the code is correct) |
| An index entry of an older embedding model | yes ("current embedding model") – no test | question |
| A file of category Photo is found | the code drops it (invariant: only Manual, Schematic or Other); the story does not say so | question: confirm with the story text |
| Failed embedding | ST-126 (out of scope); code already fails via `giveUp` | out of scope |
| Many hits | fixed limit, capped at 10 together with links | fine |
| Same file found as text passage and as page | counted once (set by file ID) | fine |
| The file's title changed after the proposal was written | the page shows the title as it was then | question |
| Diff contains unrelated formatting changes (`ai-index-entry.ts`, `ai-settings.ts`, `ai-assessment-writing.integration.test.ts`, `ai-scenario.test-support.ts`) | no | remark only; harmless |

Verdict: **accepted with remarks** – all three scenarios have real tests that check every Then; the remarks are the missing tests for a removed file and for an old embedding model, and the unrelated formatting changes in the diff.
