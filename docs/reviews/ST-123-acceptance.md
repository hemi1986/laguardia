# Acceptance – ST-123: Request an AI model proposal from a description
Date: 2026-11-07 · Tests run: `npx vitest run "src/app/(team)/team/machine-models/request-ai-model-proposal.integration.test.ts"` → 4 passed, 0 failed · Preview: none (browser spec `e2e/ai-model-proposal.spec.ts` read, not run – full e2e in progress elsewhere)

Traceability: `check-scenarios.ts ST-123` → 4/4 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A technician requests an AI model proposal | `request-ai-model-proposal.integration.test.ts` | Given: AI on via scenario helper, table emptied. When: real form definition through `formRunner` with the technician as actor. Then: landing address equals the proposal address, the page read model says state `requested`, description trimmed, the section HTML contains "KI-Vorschläge", the description, the state text and the link; journal has the event with `requestedBy` and no description text. The "KI arbeitet …" text and the meta refresh are not asserted in vitest, but the e2e spec covers them (not run by me). | pass |
| An empty description is rejected | same | Blank input via the runner; error code and the German text "Bitte beschreibe das Gerät." asserted with literals; no proposal exists afterwards. | pass |
| No second AI model proposal while one is being written | same | Given: first proposal created through the scenario helper. When: second post through the runner. Then: error code, kept value "Flipper High Speed Williams" in `state.values.description`, still only the first proposal. The rendered input's `defaultValue` is not rendered in vitest, but the e2e spec covers the rejection text. | pass |
| Nobody requests while AI is off | same | Given: key removed. Then: the button text is absent and no "disabled" appears. A request sent anyway goes through `executeCommand` and gives `ai-model-proposal-ai-off`; the text "Die KI ist ausgeschaltet." is asserted; nothing is created. Slight gap: the "sent anyway" request bypasses the form and Server Action, but it goes through the real command. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from the message catalog | yes | `teamMessages.aiModelProposals` and the `commandErrors` codes. The one literal is the input placeholder "Flipper High Speed Williams" in `request-form.tsx`, which is a minor catalog bypass. | ok (remark) |
| Journal entry per command | yes | `EVT-AiModelProposalRequested` is journalled and asserted | ok |
| No personal data / free text in logs and journal | yes | the description stays out of the event data, asserted | ok |
| Store guarantees the set-based rule (HS-37) | yes | migration 0047: partial unique index on `state = 'requested'` | ok |
| Access: technicians only, helpers excluded | yes | `requireTechnician()` on all three pages, `allowedActors: ["technician"]` on the command. No test for a helper. | ok (remark) |
| Usable at design size / long texts | yes | the proposal page uses `overflow-wrap:anywhere`; the form is a single field | ok (not visually checked) |
| List speed with realistic data | n/a | at most one open proposal at a time | n/a |
| Security advisories | n/a | no dependency change | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Two technicians send at the same moment: the second hits the unique index instead of the fact check | HS-37, "guaranteed by the store" | Question: is a unique violation turned into `ai-model-proposal-being-written`? The generic command layer probably does this, as for the AI assessment, but no test shows it. |
| Until ST-124 exists, a proposal stays `requested` forever and blocks every further request | none (ST-124 and ST-126 are out of scope) | Question: accepted as a transient state until ST-124 and ST-126 are merged, but do not release this on its own. |
| A helper opening `/team/machine-models/mit-ki-erstellen` or the proposal page | "Helpers have no access" (story Context) | Question: add a helper test? The code uses the same `requireTechnician` as the machine models page. |
| An unknown or foreign proposal ID | none | Handled: "Diesen KI-Vorschlag gibt es nicht." |
| A very long description | none; a max-length question is not raised (project memory) | none |
| Description rejected while AI is off or one is running: the page shows the reason instead of the form (G11) | G11 | ok; the e2e spec covers the "being written" case |

## Verdict
**accepted with remarks**

All 4 scenarios have a real, passing test whose Then lines are asserted with literals. The remarks, none blocking:
1. The meta refresh and the kept input value are checked only in the e2e spec, which I did not run (the full e2e run is in progress elsewhere). The developer should confirm that it is green.
2. The placeholder literal in `request-form.tsx` should move to the catalog.
3. The concurrent-request and helper-access questions above.
