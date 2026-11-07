# Acceptance – ST-126: An AI model proposal that fails or breaks off says why
Date: 2026-11-08 · Tests run: `npx vitest run "src/app/(team)/team/machine-models" src/modules/ai-assistance` → 24 files, 225 passed, 0 failed (lint 0 errors, typecheck green) · Preview: none

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A device that is not recognised | failed-ai-model-proposal.integration.test.ts | Given: real request "asdf". When: one real run of `aiModelProposalWork`. Then: state failed, reason device-not-recognised, German text rendered, journal entry without the description, no embedding paid. Remark: "the page shows the description" is asserted on the page model, but `FailedAiModelProposal` does not render it – the description comes from `page.tsx` (covered only by structure, not by a rendering assertion). | pass (remark) |
| Try again keeps the description | same | Real failed proposal, link parsed from the rendered button, `descriptionToTryAgain` reads on the server, form rendered with the value "Flipper High Speed Williams"; failed proposal stays; foreign/unknown/duplicate parameter types nothing in. The page `mit-ki-erstellen/page.tsx` wiring is not executed, only its parts. | pass |
| A write that breaks off | same | Hold really runs out (stepping clock), a late run is held open, next run records "Abgebrochen", nothing sent by that run, late result afterwards records nothing (journal: Requested, Failed only), no later run writes again. Complete. | pass |
| AI is turned off while a proposal is written | same | Key removed before the run, no request and no chat request reach OpenRouter, reason ai-off, text "Die KI ist ausgeschaltet.". Complete. | pass |

Traceability: `check-scenarios.ts ST-126` → 4/4 covered. Unit tests in `ai-model-proposal.test.ts` add the device-recognition rule (no title and no manufacturer; category/year alone) and "fails once, written/failed records nothing".

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Reasons and German texts per story | yes | `teamMessages.aiModelProposals.failureReasons`: all nine reasons, the four story texts literal, assessment texts identical to ST-108 (lines 117–122 vs 202–205) | yes |
| No automatic retry | yes | `failAiModelProposal` only from `requested`; test asserts later run does not write; retry is a link to a form that requests a new proposal | yes |
| Late result records nothing | yes | version/state check in command; tested | yes |
| AI off sends nothing | yes | `aiState` checked before the chat call; tested | yes |
| Every command writes its journal entry | yes | EVT-AiModelProposalFailed via `executeCommand`, asserted | yes |
| Texts from message catalogs | yes | all new texts in the catalog | yes |
| No personal data in logs/journal | yes | description kept out of the journal, asserted | yes |
| Break-off recorded without page-load storms | yes | page starts a run only when `aiModelProposalLeftUnfinished` is true | yes |
| Usable at design size / lists fast | partly | simple text and one button (G7); no list change; not browser-checked (no preview) | n/a |
| Migration and data model | yes | drizzle 0050 plus data-model.md updated | yes |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Cost of a "device not recognised" answer is not stored on the failed proposal (the run was paid) | no rule in the story | question (is the cost of failed runs to be visible somewhere?) |
| Other roles / non-technician opening a failed proposal's page or the retry link with someone else's id | the retry offers only the description of a failed proposal, no ownership check; same visibility as the page itself | question |
| "Nochmal versuchen" clicked twice / old failed proposal and a new one coexist | stays until discarded (story) | none |
| Answer with only a year/category counts as not recognised (design decision beyond Gherkin) | derived rule, documented in code and unit test | remark – confirm with the user |
| Page refresh while requested after hold expiry starts a run per refresh until the failure is recorded | idempotent by state check | none |

## Verdict
**accepted with remarks.** All four scenarios have real tests that pass and the context rules hold. Remarks: the description display in scenario 1 is asserted on the page model, not on rendered HTML of the page (the failed component alone does not contain it); the cost of a failed "device not recognised" run is dropped (question).
