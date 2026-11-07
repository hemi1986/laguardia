# Acceptance – ST-124: The AI completes the machine model and finds documents on the web
Date: 2026-11-07 · Tests run: `npx vitest run --project integration write-ai-model-proposal` → 4 passed; `--project unit ai-model-proposal` → 17 passed; `npx playwright test e2e/ai-model-proposal.spec.ts` → 3 passed; `npm run typecheck` green; `npm run lint` 0 errors · Preview: none (local)

check-scenarios: 4/4 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Fields and documents from the web are proposed | `write-ai-model-proposal.integration.test.ts` | Given: a request for "Flipper High Speed Williams" through the scenario helper. When: the real background work (`aiModelProposalWork`) runs against the in-memory OpenRouter with the literal answer from the scenario. Then: all five fields, sources, the manual under „Aus dem Netz laden“ with category manual (Handbuch), and the tick are asserted with literals. Also asserted: web tools on, journal without text. | pass |
| A value that is not valid is left empty | same | The answer has year "ca. 1986" and CRT for Pinball. The stored fields contain only title, manufacturer and category. The page shows year and technology empty, „Nicht gefunden“ appears exactly twice, and the other fields are filled in. | pass |
| No documents found | same | An empty document list, as the "found nothing" result. Asserts „Keine Dokumente gefunden.“, no document checkbox, and the fields still filled in. | pass |
| At most ten documents | same | The answer names twelve. Asserts that 10 are stored and 10 rendered, and that they are the first ten. | pass |

Remark: "the web search found nothing" and "twelve documents" are simulated through the answer's content. This is the right seam, because the web search is a server tool inside OpenRouter. The rules on https only, duplicates and validity are covered in the unit test.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from the message catalogs | yes | New texts are in `src/platform/messages/team/ai-assistance.ts` (`aiModelProposals`); the component uses `texts.*`. The AI prompt in German is not a UI text. | ok |
| Shared page frames / form logic (G2a) | yes | Reuses `MachineModelFields` with a `notFound` option and `machineModelChoices`. | ok |
| Domain language | yes | The story's terms: file category, machine category, technology, AI model proposal. | ok |
| 360 px | yes | e2e asserts `pageWidth <= 360`. Long links use `overflow-wrap:anywhere`. | ok |
| No JavaScript needed | yes | e2e runs with JS disabled. The meta refresh is gone once written. | ok |
| Every command writes its journal entry | yes | `EVT-AiModelProposalWritten` is asserted with chat model and cost. The free text stays out of the journal and logs. | ok |
| Migration | yes | `drizzle/0048` with its snapshot and journal. | ok |
| Untrusted AI answer | yes | Bounded lengths; https-only links; the invariants are enforced in the command. | ok |
| Lists fast / security advisories | n/a | No list change and no new dependency. | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Sources that are not https are dropped silently (the command filters them) | The story says "only `https` links" for documents; for sources the data model says https | none; consistent |
| A document with an unknown file category falls back to "other" instead of being dropped | The rule "not valid is left empty" covers fields, not documents | question (minor); the behaviour is sensible |
| A year that is a number outside 1000–9999, e.g. 86 | "year that is not four digits" | covered by the rule; no extra test, fine |
| A technology valid on its own but not for the category, e.g. CRT for Pinball | the story's scenario 2 | covered |
| The written page has no „Speichern“ or „Verwerfen“ yet | the story's Context names ST-127/128 | out of scope |
| Very long document titles | free text, bounded to 300 characters by the parser | none |
| Helper role opening the proposal page | team area; technicians only per the command | none |

## Verdict
accepted
