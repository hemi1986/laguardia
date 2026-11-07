# Acceptance – ST-129: The chosen links of a saved proposal are loaded as files
Date: 2026-11-07 · Tests run: `npx vitest run -t "ST-129"` → 4 passed, 0 failed (plus the story's extra tests in the same file and the unit tests in `src/platform/web-fetch/` and `proposed-document-content.test.ts`: 64 passed; `typecheck` green, `lint` 0 errors) · Preview: none (local PostgreSQL)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A link becomes a file of the machine model | `load-proposed-documents.integration.test.ts` | Given: real proposal through the AI scenario and `acceptAiModelProposalCommand`, literal link/title/category. When: the background kind `proposedDocumentWork(web)` with a 3 MB PDF. Then: title "High Speed Manual", category manual, attached to the machine model (id compared), size 3 MB, stored content, page shows loaded plus link to the file; journal entries and actors asserted. | pass |
| A link that cannot be reached fails alone | same | Two links, one "unreachable". Reason `not-reachable` and text „nicht erreichbar“ asserted, the other is a file with title/category, proposal still accepted, machine model kept. | pass |
| An address that is not allowed | same | Both asserted: reason `address-not-allowed`, `web.served()` empty, nothing stored, page shows "Adresse nicht erlaubt". Given is `https://192.168.0.5/...` rewritten to `http://` by SQL (see remarks). | pass |
| Content that is too large or not a PDF or text | same | 150 MB PDF (declared size) -> `too-large`, ZIP -> `not-pdf-or-text`, nothing stored, both texts on the page. | pass |

Traceability: `check-scenarios.ts` 4/4 covered. Extra tests cover web page as text, Markdown, octet-stream PDF, AI off, and "broken off" with late result.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from the message catalog | yes | `teamMessages.aiModelProposals.loaded` / `documentFailures`, used in `saved-proposal.tsx` | ok |
| Journal entry per command | yes | `EVT-ProposedDocumentLoaded` with `{documentIndex, fileId}`, actor system; `EVT-FileAdded/Attached` with the technician as actor | ok |
| Domain language / events.yaml | yes | event and command names match; reasons match the five words of the story | ok |
| Wired in production | yes | `ai-work-dependencies.ts` registers `proposedDocumentWork(webFetcher({ ownHosts }))` | ok |
| Security (SSRF, size, no execution) | yes | address policy and redirect/resolve handling covered by unit tests (`address-policy.test.ts`, `https-web-fetch.test.ts`); HTML reduced to text | ok |
| No personal data in logs | yes | journal holds references only | ok |
| Usable at design size / list speed | partly | status line per link only, max 10 links; no browser check without a preview | not checked, low risk |
| conventions.md updated | yes | seam and kind documented, test-seam table extended | ok |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| DNS name resolving to a private IP, redirect to private network | yes (events.yaml rule "a redirect is followed only to such an address") | covered by unit tests of the adapter, not by the integration test; fine |
| 100 MB limit when the server does not declare a size (streamed) | yes (at most 100 MB) | covered at adapter level (`https-web-fetch.test.ts`); fine |
| Two runs at once on one link | rule "only a link still waiting" | hold plus `FOR UPDATE`; fine |
| Technician who requested the proposal is later removed or deactivated; file is added "on behalf" of them | none found | question |
| Web page that is an empty or scripts-only page (empty text file) | none | question |
| Same-name `original file name` from a URL with odd characters | none | question (low) |

## Minors (conventions / diff)
1. Scenario 3 literally says `http://192.168.0.5/manual.pdf`; the test saves an https link (the write path keeps https only) and rewrites it to http via SQL. This is a justified and commented workaround, but the *Given* is not set up through the real entry point. Acceptable.
2. `AddFileInput.id` was added to `add-file.ts` for a caller that names the ID itself; it is documented as "no form posts one". Check that the form/Server Action input parsing cannot carry an `id` from the client (the field is optional and typed, but worth a glance).
3. `load-proposed-document.ts`: `as { fileId: string }` cast in the event builder; cosmetic.
4. Browser/e2e not run (no preview, no e2e for this story); the UI part is only covered by `renderToStaticMarkup`.
5. Pre-existing lint warnings (19), none from this diff except possibly none; no new errors.

## Verdict
accepted with remarks
