# Acceptance – ST-099: S3-compatible object storage everywhere
Date: 2026-10-31 · Tests run: `npm test -- -t "ST-099"` → 11 passed, 0 failed (4 files; the 11th is the early-size scenario's twin in the adapter file set); `check-scenarios.ts ST-099` → 10/10 covered · Preview: none (no bucket yet, not judged)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Stored content is described and removed | s3-storage.integration.test.ts | Real SeaweedFS; write 1234 B pdf, details literals, delete, details undefined | pass |
| Browser upload stores under the chosen name | s3-storage.integration.test.ts | 30 min address, 500 KB jpeg sent with the address's headers via fetch; details literals | pass |
| Address does not store under another name | same | Name swapped in URL, 403, other name has no details | pass |
| Expired address stores nothing | same | Signed with a past clock (injectable), 403, nothing stored | pass |
| Declared size above limit gets no address | upload-route.integration.test.ts | Real `uploadFile` through the real route with session, limit 1 MB, 2 MB file; asserts `too-large` and empty `pending_upload` for the member | pass |
| Content longer than declared refused | s3-storage.integration.test.ts | 500 KB signed, 2000 KB sent, 403, nothing stored | pass |
| Not delivered without a signed address | same | Plain URL without query, 403 | pass |
| View address until expiry | same | Valid address 200 + bytes; address signed 6 min ago refused | pass |
| Download vs view disposition | same | zip as download has `attachment`; pdf has no attachment | pass |
| CSP names exactly the bucket's host | content-security-policy.test.ts | Both AWS and local settings; origin equals the adapter's address origin; literal hosts asserted in a second test; no wildcard/Vercel | pass |

Extra tests (media type bound, write once via 412, CORS preflight, batch signing) strengthen the signature claims. Minor remark: the "too-large" scenario's "Then the request is refused" is covered by `uploadFile` result plus a separate 413 test, not by an assertion on the response in the same test; acceptable.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | no UI change (story out of scope) | e2e upload specs pass per task statement | OK |
| Journal entries | no new commands | n/a | OK |
| Message catalogs / texts | texts unchanged | `uploadFile` keeps the two error kinds; progress e2e asserts "Wird hochgeladen … 100 %" | OK |
| No personal data in logs | applies | not found in the adapter by reading; `/security-review` runs separately | OK, pending security review |
| Blob gone | applies | no `@vercel/blob` in package.json, src, scripts, docs/architecture, conventions; ESLint restricts `@aws-sdk/*`; `refusedAsTooLarge` removed | OK |
| Local setup and CI | applies | README, `.env.example`, CI starts compose with health wait and test S3 env | OK |
| AWS guide | applies | `docs/operations/aws-s3-setup.md`, linked from README and `.env.example` | OK (content to be exercised by the user) |

## Open checklist items (cannot be judged now)
- Browser tests against the preview with the preview bucket on AWS, no CSP block: open until the user's one-time AWS setup.
- User approval of the conventions change (SKILL.md text is updated).
- `/security-review` findings (running in parallel).
- OIDC temporary-credential lifetime vs 30-minute address and the probe's recorded differences "verified on the preview": to be recorded in the PR once the preview works. The probe found no difference from AWS, so no scenario is deferred.
- Checked-off state of the checklist in the story file is the implementer's to tick at `done`.

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Browser declares `file.size` smaller than the real file | Signed length binds it, store refuses (tested: longer content 403) | none |
| Upload address used after 30 min on AWS when OIDC credentials expire sooner | Story Notes name the risk | verify on preview, record in PR |
| Abandoned uploads left in bucket (pending upload cleanup) | ADR 0009 unchanged | none |
| Slow phone connection, one PUT without resume | Out of Scope (ADR 0012) | question at go-live |
| Shared preview bucket: previews can read each other's objects | Story decides one shared bucket | question for security review |
| Deleting old Blob stores/env vars | Notes: by user after merge | user action |

## Verdict
**accepted with remarks.** All ten scenarios have real, passing tests at the right seams against a real store; no rule is violated. The remarks are the open checklist items above, which depend on the user (AWS setup, preview run, conventions approval) and the parallel security review. Do not set `done` for the checklist items until those are closed or the user accepts them as deferred.
