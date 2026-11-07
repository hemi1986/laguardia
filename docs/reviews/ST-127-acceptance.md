# Acceptance – ST-127: Discard an AI model proposal
Date: 2026-11-08 · Tests run: `npx vitest run -t "ST-127"` → 3 passed, 0 failed · Preview: none (browser test in e2e/ai-model-proposal.spec.ts read, not run)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A written AI model proposal is discarded | discard-ai-model-proposal.integration.test.ts | Given: real written proposal via the work queue. When: the form runner (Server Action path) with the posted version. Then: not listed, state discarded, no "High Speed" model, journal entry, button gone afterwards. Literals used. | pass |
| A failed AI model proposal is discarded | same | Given: real failed proposal. Button shown, discarded, no longer listed, a second discard is rejected. | pass |
| An AI model proposal that was saved meanwhile cannot be discarded | same | Given: stale form, then the proposal is really saved by the accept command. Then: error `ai-model-proposal-already-accepted` with the German text, no discard event, saved page renders the link to the created model. | pass (remark 1) |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Journal entry per command | yes | Journal asserted (event, actor, no description in data) | OK |
| Texts from message catalog | yes | `ai-assistance.ts`: Verwerfen, "KI-Vorschlag verworfen.", error text | OK |
| No personal data in logs/journal | yes | Event carries only the ID | OK |
| Works without JS / G3 confirmation / G11 button absent | yes | Plain form; page shows confirmation only if the viewer's last command was the discard (e2e checks a foreign ID shows none) | OK |
| Works while AI is off | yes | Command reads no setting; no test with AI off | OK (remark 2) |
| Performance, design size | marginal | One button, no list change | OK |
| Security advisories | n/a | no dependency change | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Discarding a proposal still being written | yes (CMD rule: rejected; button absent) | Command path implemented (`not-discardable`); only the second discard of a discarded one is tested. Fine. |
| Two technicians discard at once / stale version | HS-16 version check | Covered by the generic runner |
| Page shows saved model after the redirect (`?schonGespeichert=1`) in the action | story Then 2 | The redirect in `discardAiModelProposalAction` is not unit-tested (same code as accept; page rendering is tested). Question, low risk |
| Discard with AI off | story Context | Not tested explicitly; question, low risk |

Remarks: (1) the redirect to the saved page lives in the action and is only covered indirectly; (2) AI-off is not tested explicitly. Neither contradicts a rule.

## Verdict
accepted with remarks
