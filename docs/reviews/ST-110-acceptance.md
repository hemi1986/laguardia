# Acceptance – ST-110: Replace the AI key and change the models, with a cost warning for the embedding model
Date: 2026-11-01 · Tests run: `npm test -- -t "ST-110"` → 9 passed, 0 failed (2 files) · `check-scenarios.ts` 9/9 covered · Preview: none (local)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A technician replaces the key | museum-settings/ai-settings-change.integration.test.ts | Given: AI on via the command, one indexed file. When: "Ersetzen" link and field "Neuer API-Schlüssel" rendered, the form posted through formRunner as Tom. Then: "…c3d4", AI on, entries unchanged and 0 waiting, journal names Tom with changedParts key-saved and last four c3d4, neither key prefix in page, journal or stored row. Literals used. | pass |
| A replacement key OpenRouter refuses keeps the saved key | same | Error ai-key-refused, German reason text, empty key field (no value=), aria-invalid, saved "…a1b2" and AI on, journal unchanged. | pass |
| A saved key that can no longer be read turns AI off | same | Different encryption key; "KI ist aus", message text asked-again, key field offered, no "Ersetzen"; the real defect query shows mayRequest false. | pass |
| A new chat model applies to the next AI assessments only | ai-assistance/ai-settings-change.integration.test.ts | Real background run: earlier assessment keeps Gemini Flash, next uses Claude Sonnet (chat request model checked), entry timestamp and journal show no re-indexing, overview 1 indexed / 0 waiting. | pass |
| Changing the embedding model warns what indexing again will cost | page test | 40 files x 30 pages = 1.200, 2.500 tokens injected, price 0,20: complete warning text with "etwa 0,60 $", button, "Zurück", no "Endgültig", no red; model not changed, journal and index unchanged. | pass |
| Going back from the warning changes nothing | page test | "Zurück" is a link; the form opened from it preselects the chosen embedding model; saved model, journal and index unchanged. | pass |
| A confirmed embedding model indexes every file again | module test | Both files waiting after confirm; an assessment meanwhile finds only the one re-indexed file; afterwards both with new model. (The "meanwhile" re-index is set up by a test helper, acceptable.) | pass |
| An indexing with the earlier embedding model that ends after the change still counts as waiting | module test | The change is confirmed inside the running embed call; the entry of the earlier model is stored, counts waiting, the assessment does not find it (prompt lacks "J4"), later indexed with the new model. | pass |
| Saving without a change records nothing | page test | Form posted unchanged: "KI gespeichert.", same settings, no journal entry, index unchanged, 0 waiting. | pass |

Extra tests (rejection without confirmation, key typed with model change, confirmation lands like a save) are present and pass.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from message catalog, German | yes | `src/platform/messages/team/ai-assistance.ts`; tests assert the story's literal texts | yes |
| Works without JavaScript, no red, no "Endgültig" (G10b, G30) | yes | warning is a page of its own, "Zurück" a link, confirmation a form; asserted | yes |
| Secret not in logs/journal/page/address (G36) | yes | key stripped from the warning address, asserted; journal and stored row checked | yes |
| Journal entry per command | yes | EVT-AiSettingsChanged asserted; none on no-change | yes |
| Technician-only | yes | `requireTechnician()` on the new page | yes |
| Gate | yes | verify.ts without e2e green per caller; 9 tests re-run green | yes |
| `/security-review` (story DoD) | yes | not part of this check; the diff replaces a saved secret, so it must be done before merge | remark |
| Lists fast, design size | n/a | no list added; not exercised in a browser here | n/a |

## Judgement of the implementer's decisions
- Key typed together with a model change is rejected with a new text: fits G36 (never put a key into an address) and the story; the text is clear. Accepted.
- Constant 530 tokens per page or image: matches the ST-105 note (PDF page about 530, image 258); images are over-estimated, which is the safe side. Accepted.
- Pages and images = sum of imagesIndexed of the indexed entries of the current model: matches the story's formula; failed and not-yet-indexed files are not counted although a failed file is also re-indexed on a model change (HS-32). Minor under-statement; accepted.
- Singular wording for one file, "Ersetzen" as link to `?replace=key#ki`: no conflict with the story. Accepted.

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Failed files are indexed again on a model change but are not in the warning's count/cost | HS-32 vs. estimate formula "current AI index entries" | remark; question |
| A stale warning page (settings changed meanwhile) is confirmed | version check of CMD-ChangeAiSettings (rejects) | covered by the rule; no action |
| Warning opened by address for an unknown model or OpenRouter down | NoEmbeddingModelChange states exist in the code; not scenario-tested | remark |
| Chat model and embedding model changed in one save | confirmation carries both | question, works by design |
| Warning when no files are indexed yet (0 files, 0,00 $) | not specified | question |

None of these meets the follow-up hurdle for a new story.

## Verdict
accepted with remarks – remarks: run `/security-review` before merge (story DoD); failed files are missing from the warning's estimate.
