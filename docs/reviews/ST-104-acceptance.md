# Acceptance – ST-104: AI settings – the OpenRouter key and the two models on „Einstellungen“
Date: 2026-11-01 · Tests run: `npx vitest run --project integration "src/app/(team)/team/museum-settings/"` → 4 files, 40 passed, 0 failed; `npx vitest run src/modules/ai-assistance` → 40 passed; `npx playwright test e2e/settings.spec.ts e2e/museum-settings.spec.ts` → 4 passed (ECONNRESET noise from the dev server on closing pages, no failure) · Preview: none

Traceability: `check-scenarios.ts ST-104` → 10/10 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technicians reach „Einstellungen“ under „Mehr“ | `e2e/settings.spec.ts` | Real login, real „Mehr“ menu; position 4 = „Einstellungen“, no „Museumseinstellungen“ link, h1 and h2 order asserted with literals. | pass |
| With nothing saved AI is off, and a missing part can still be added | `ai-settings.integration.test.ts` | Empty settings (`withoutAiSettings`), form runner as Tom. Off text with all three missing, no key, key-only save, „…a1b2“ without „Ersetzen“, both selects present, second save turns AI on with the key kept. All Then lines asserted. | pass |
| A technician turns AI on with a key and two models from OpenRouter's list | same | Option texts compared with the literal labels (context size, prices). Page shows on-state, models, „…a1b2“, empty key field, both reminders. Journal entry names the technician. Neither page nor journal nor stored row contains the key. | pass |
| A key OpenRouter refuses is rejected | same | Refused key in the in-memory seam. Error at the key, key field empty, models still selected, AI off, no journal entry. | pass |
| Models that do not fit are offered in the list but cannot be chosen | same | Five models. Disabled and „· passt nicht“ on the two text-only ones. The three others are enabled and unmarked. Small Embedding is rejected on saving at the embedding model with the literal reason. A forged form with Text Chat is rejected at the chat model. | pass |
| Outline: typed model that does not fit (3 examples) | same (loop over the examples) | List unavailable. Each example asserts the field marked invalid, the literal reason, both typed IDs kept, the key field empty, AI off. | pass |
| Without OpenRouter's model list the models are typed by hand | same | The hint text is asserted, both fields are inputs, the typed save turns AI on. | pass |
| Removing the key turns AI off | same | Removal goes through the real runner form. Texts „Schlüssel entfernt. KI ist aus.“ and „Es fehlen: API-Schlüssel.“, both models kept, journal names the technician. | pass |
| AI settings changed by someone else meanwhile are not overwritten | same | Stale version taken before Eva's save. Tom's save is rejected with `version-conflict`. Literal text, his models still selected, key empty, stored state is Eva's. | pass |
| Helpers do not get the AI settings | `e2e/settings.spec.ts` + integration "refuses a helper's form" | Helper menu has no link. Direct address redirects to `/team`. A forged form with the helper session changes nothing (browser). The command refuses with `not-authorized` and writes no journal entry (integration). | pass |

Extra tests beyond the scenarios (undecryptable key counts as none, embedding model needs a key, chat model alone, OpenRouter unreachable) cover the story's Context rules. Unit tests cover the adapter (fake HTTP server), key encryption and the events.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 1. ADR 0014 accepted before building | yes | User set it to accepted on 2026-10-31 (project memory). | OK |
| 2. Operations step for `AI_SETTINGS_ENCRYPTION_KEY` | yes | `docs/operations/ai-settings-encryption-key.md`: creation with `openssl rand -base64 32`, a table for local, e2e, preview and production, behaviour when the key is missing, changed or lost, and rotation. | OK |
| 3. `/security-review` | yes | Runs separately, as the task says. | n/a here |
| 4. Seam catalog gets the AI seam, adapter test and encryption test | yes | `docs/engineering/conventions.md` lines 899-901 (AI seam with `memoryAi`, OpenRouter adapter against a fake HTTP server, pure encrypt/decrypt). The module is listed in the layout at line 16. | OK |
| Usable at design size (phone) | yes | The e2e test asserts `scrollWidth <= 360`. | OK |
| Texts from the message catalogs, German | yes | `src/platform/messages/team/ai-assistance.ts`. The tests assert the literal German texts from the story. | OK |
| Every command writes its journal entry, no secrets in it | yes | `EVT-AiSettingsChanged` with the last four characters only. The tests assert the key is not in the journal or the stored row. No `console`/logger calls in the module. | OK |
| Key never shown again, empty after every save and rejection | yes | Asserted in several tests (`field(html,"key")` has no `value=`). | OK |
| Lists fast with realistic data | no | One model list per form opening. No list of entities. | n/a |
| Ratchets: renamed ST-100 tests keep their titles | yes | The diff of `e2e/museum-settings.spec.ts` changes only the label and the last-section assertion, as the story allows. The titles are unchanged. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| `AI_SETTINGS_ENCRYPTION_KEY` missing: the save fails with a server error | The operations doc says so; the story has no rule for it. | question – a friendlier message would be nice, but the doc states the behaviour. Not a gap for a new story. |
| Two technicians saving at once | Version check rule. | covered |
| Saved model no longer in OpenRouter's list when the form is opened | None. | question for ST-110 (the saved model is shown from the stored value) |
| Key field filled while a key is saved and decryptable | Story: a saved part is shown without a change until ST-110. | covered by Out of Scope |
| Very long model ID typed by hand | None. | question, and per project memory not to be raised |
| English UI | The team area is German only (`languages`). | n/a |
| Removing a key when none is saved | None. | question – the button is probably hidden without a key. Not tested. |

No existing rule is violated. None of the open items meets the hurdle for a new story.

## Verdict
**accepted** – all 10 scenarios have real tests that assert every Then line with literal values, and the tests run green (unit, integration, browser). Definition-of-done items 2 and 4 are met. Item 3 (`/security-review`) is still to run separately.
