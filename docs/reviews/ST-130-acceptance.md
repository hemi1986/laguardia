# Acceptance – ST-130: Retry a proposed document that failed to load
Date: 2026-11-08 · Tests run: `npm test -- -t "ST-130"` → 3 passed, 0 failed (2 scenario tests + 1 extra rejection test) · Preview: none (local testing)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A failed link is retried and loaded | `ST-130: A failed link is retried and loaded` (`src/app/(team)/team/machine-models/ki-vorschlag/[proposalId]/retry-proposed-document.integration.test.ts`) | Given: a real saved proposal, link failed as "not-reachable" through the background work with a stand-in web. When: `retryProposedDocumentCommand` through `executeCommand` at the version the page shows, then the loading run with a web that now answers. Then: the file "High Speed Manual" exists (title, category, size), it is attached to the machine model, the link is `loaded`. Also checked: the retry link is offered beside the failed link, the link is waiting again without a reason, the event makes AI work, and the journal holds only the index. | OK |
| A link that is not failed cannot be retried | `ST-130: A link that is not failed cannot be retried` (same file) | Given: link loaded (1 file). When: retry. Then: rejected with `ai-model-proposal-document-not-failed` (literal), message exists in the catalog, file count still 1, link still loaded. "Nochmal versuchen" not offered for a loaded link (G11). | OK |

Traceability: `check-scenarios.ts ST-130` → 2/2 covered.
Remark: the tests call the command (the project's seam), not the Server Action/form. The action, form and definition are thin and follow the pattern of the neighbouring accept and discard actions. The clicking itself is not covered by a test.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Journal entry for the command | yes | `EVT-ProposedDocumentLoadingRetried` in the catalogue; asserted actor = technician, data = `{documentIndex: 0}` (no title or address) | OK |
| Texts from the message catalogs | yes | `teamMessages.aiModelProposals.retry` and the error `ai-model-proposal-document-not-failed` in `src/platform/messages/team/ai-assistance.ts` | OK |
| No personal data in logs | yes | Journal event holds only the index | OK |
| Works while AI is off | yes | The command reads no setting. The load test turns AI on in `beforeEach`, so "AI off" is not tested. | OK (remark) |
| Version / concurrency (HS-16) | yes | Change at the seen version; the page now exposes `version` for an accepted proposal | OK |
| UX (G11 only for failed, G8 rejection at the button, G3 page shows waiting) | yes | Button only for `loading === "failed"`; `Rejection` in the form; redirect to the proposal page. The page refreshes while a link is waiting (from ST-129). | OK |
| Lists fast / design size / security advisories | not specific | at most 10 documents; no new dependency | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / question |
|---|---|---|
| Waiting link, place that is none (5, -1) | yes: "Only a failed link" – covered by the extra test | none |
| Two technicians retry the same link at once | HS-16 version check, the second is stale-rejected | none |
| Retrying a link that failed for an unchangeable reason (too large, no PDF) | Context: allowed, the same reason follows; not tested | question (low risk, nothing unusual in the code: the reason is dropped and the load runs again) |
| Retry while AI is off | Context: works | question – not tested with AI off, the code reads no setting |
| A page with a stale version after the loading finished | HS-16 stale rejection with the generic stale message | none |
| Proposal that is discarded or not accepted | invariant: only accepted ones have chosen links; `failedLink` refuses them | none |

## Verdict
**accepted with remarks** – both scenarios have real, green tests that assert every Then line with literals. The remarks are that the click path (Server Action/form) is untested and that "AI off" and "unchangeable reason" are untested. Neither contradicts a rule.
