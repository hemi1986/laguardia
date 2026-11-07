# Acceptance – ST-128: Save an AI model proposal as a machine model with its files
Date: 2026-11-07 · Tests run: `npx vitest run -t "ST-128"` → 4 passed, 0 failed; whole file `accept-ai-model-proposal.integration` → 7 passed; `npx playwright test e2e/ai-model-proposal.spec.ts --project=ai-settings` → 4 passed; `npm run typecheck` green; `npm run lint` 0 errors · Preview: none

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Saving creates the machine model and attaches the chosen files | `ki-vorschlag/[proposalId]/accept-ai-model-proposal.integration.test.ts` | Given: written proposal "High Speed" (1986), indexed file "Pinball wiki – System 11" attached to another model, ticked. When: real form runner with the posted form, year changed to 1987. Then: model exists with year 1987 (literal), file attached to the new model, landing address, saved page contains „Gespeichert“, model link and file title, journal has EVT-AiModelProposalAccepted and EVT-MachineModelCreated. The EVT-FileAttached entry is not asserted (remark). | pass |
| A rejected form keeps what was typed | same | Given: proposal without manufacturer, file and link ticked. When: save. Then: error `manufacturer-required` with catalog text literal, values and ticks kept, no model, file still attached once, proposal still `written`. | pass |
| A proposal that was saved already | same | Given: a stale form opened before the first save; the first save succeeds. When: stale form posted. Then: error `ai-model-proposal-already-accepted` with the catalog literal, one model only. | pass |
| A machine model with the same title and manufacturer exists | same | Given: model "High Speed"/"Williams" created through the command. When: the written page is rendered. Then: hint text literal and link to the existing model; saving still works (two models). | pass |

Extra tests (not scenarios, good): removed ticked file rejects, names the file and stores nothing; forged index rejected, link title and category changeable, proposal stays in „KI-Vorschläge“; saving works while AI is off. The e2e spec (no JavaScript) covers rejection keeping the form, „Gespeichert“, model link, „Wird geladen …“, meta refresh and 360 px width.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from the message catalogs | yes | New texts in `src/platform/messages/team/ai-assistance.ts`. Exception: the sentence for a removed file is built inline in `accept-form.tsx` ("… wurde/wurden inzwischen entfernt. Es wurde nichts gespeichert."), a German literal outside the catalog. The catalog entry `ai-model-proposal-document-removed` exists but is only the fallback. | remark |
| Button text | yes | „Modell speichern“ instead of „Speichern“: judged acceptable. ST-091 forbids a bare „Speichern“, and the button says what is saved (G14). Please add the deviation to the story's UI wording at the next occasion. | yes |
| Journal entry per command | yes | `journal: aiAssistanceEvents.journal`; test asserts EVT-AiModelProposalAccepted and EVT-MachineModelCreated. Attach entries are written by `attachFileCommand` via `runs`, but not asserted. | yes, with remark |
| All or nothing (ADR 0019) | yes | `runs` in one transaction; removed-file test shows nothing stored. | yes |
| Usable at 360 px | yes | e2e asserts `pageWidth <= 360` on the saved page. The form page is checked by the ST-124 e2e. | yes |
| Saving works while AI is off | yes | test "saving works while AI is off" | yes |
| Lists fast with realistic data | little | at most 10 documents; one query for removed files | yes |
| No personal data in logs | yes | no logging added | yes |
| Security advisories | n/a | no dependency changes | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Removed file sentence outside the catalog | yes (DoD: texts from catalogs) | fix now (small): move to a catalog function taking the titles |
| Attach journal entries not asserted | story Context "CMD-AttachFile" | question: add one assertion for EVT-FileAttached in scenario 1 |
| Saving a proposal in state requested/failed (`not-written`) | rule in code, no test | question: fine, the form is only shown when written |
| Saved page shows only „Wird geladen …“ for waiting links; failed/loaded links come later | ST-129/ST-130 out of scope | fine |
| Same-title hint is computed when the page opens; a model created afterwards is not hinted | HS-39 says hint, not rejection | fine |
| Two technicians saving at once | covered by version check (scenario 3) | fine |
| Long title or document title | no max length decision | not raised (project decision) |

## Verdict
accepted with remarks. All four scenarios have a real test titled exactly `ST-128: <scenario title>`; tests, typecheck and lint are green. Remarks: the inline German sentence for a removed file should move into the message catalog, the attach journal entries are not asserted, and the button deviation „Modell speichern“ is accepted.
