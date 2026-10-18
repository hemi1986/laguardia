# Acceptance – ST-085: Direct private large-file upload and abandoned uploads
Date: 2026-10-18 · Tests run: `npx vitest run src/upload src/platform/storage src/app/api/uploads` → 5 files, 31 passed, 0 failed (browser tests not rerun, as instructed; read side by side) · Preview: none yet

Tech task: the checklist is the acceptance criteria. `check-scenarios` has no Gherkin to trace; the evidence per checklist item is below.

## Checklist items
| Item | Evidence | Really checked? | Result |
|---|---|---|---|
| 1 ADR superseding 0007, accepted | `docs/adr/0009-...` `status: accepted` (user 2026-10-18); ADR 0007 marked superseded | The decision matches the story: pending record at issue, stale ones deleted after the response, no scheduler | OK |
| 2 Seam: short-lived, size-limited upload address, both adapters, limit is a parameter | `storage.test.ts` "an upload address" (size ok, above limit refused, expired refused); `upload-address.integration.test.ts`; blob adapter signs name, size, time into the token | Memory adapter: yes. Blob adapter: only through the browser tests. `maximumSize` is a seam parameter (`FILE_SIZE_LIMIT` lives in `src/upload`). Team-only is enforced by the route, not the seam | OK |
| 3 Route checks Origin and session itself | `upload-route.integration.test.ts`: no session gives 401 and no name or address in the body; foreign or missing Origin gives 403 (both steps, with a valid session); a name issued to someone else gives 403; unknown owner/type gives 400. Real requests, real login, real PostgreSQL | Given, When and Then are real (the route function, real session cookie). `teamMember` also covers deactivated accounts per its doc comment, but there is no test for a deactivated account (see edge cases) | OK |
| 4 Above the limit refused by the permission itself, once in-memory, once in a browser test | In-memory: `upload-address...` "refuses content above the size limit by the permission itself", plus storage.test. Browser: `e2e/file-upload.spec.ts` "a file above the size limit is refused by the upload permission itself" (limit 1024, file 2048, expects "Die Datei ist zu groß.") | Met as written, **only for uploads in one piece (up to 20 MB)**. Not true for multipart (see "Finding" below) | OK with remark |
| 5 Browser-side upload function with progress and failure | `src/upload/upload-file.ts`/`browser.ts`; e2e "the progress of an upload is shown while it runs" (25 MB); failure shown: `too-large` via e2e; `not-uploaded` text exists | The `not-uploaded` branch (a failed route call or network error) has no test. The criterion says "reports a failed upload to the form", and only the too-large failure is shown | OK with remark |
| 6 About 25 MB multipart, directly to Blob | e2e "a file of about 25 MB goes as a multipart upload straight to the Blob store, never through a function" – asserts every request to our own origin has a body under 10 000 bytes and more than one `/mpu` part request goes to the store | Real. Asserts the right things | OK |
| 7 100 MB PDF from a phone on the preview | none yet | open by design (manual, user) | open |
| 8 Reachable only through a 5-minute presigned address; plain address does not deliver | e2e "uploaded content has its size in the store and opens only through its presigned address..." – plain store address gives 403, presigned gives 200 with `%PDF-1.4`, signature param present. `viewAddressOf` uses 5 minutes | The 5 minutes are not asserted anywhere (no unit test of `viewAddressOf` with a fixed clock, and the e2e does not check the expiry parameter). Small gap | OK with remark |
| 9 Rejected command deletes the content | `uploaded-content.integration.test.ts`: rejected, throwing, too-large, other owner, older than 24 h, replayed attach, nothing uploaded | Real, with literals, memory adapter | OK |
| 10 Abandoned uploads cleaned up, injected clock | `abandoned-uploads.integration.test.ts`: 24 h boundary (11:59:59 deleted, 12:00:01 kept, and the kept one can still be attached), failure keeps the record for the next time, `atMost` and oldest first. Route test: cleanup is scheduled after the response of each name | "After a later request" is split in two tests: the route schedules the cleanup (callback only), the cleanup deletes. No test runs the two together, but each half is real | OK |
| 11 Works under the security headers (preview) | e2e "the upload works under the security headers: no request is blocked" exists; runs only on the preview with a technician account | open by design | open |
| 12 Conventions updated (user approves) | `SKILL.md`: seam row, "Files uploaded from the browser" section, cleanup documented, route-handler rule changed | Content matches the implementation | waiting for user approval |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | The check page only (technicians, unlinked) | Single-column flex form, no fixed widths; no explicit 360 px test. The 100 MB phone check covers it | OK (remark) |
| List pages fast | No | no list page | n/a |
| Every command writes its journal entry | No. No command, `events: []`; `CMD-AttachFile` is ST-037 | n/a | n/a |
| Texts from the message catalogs | Yes | `team.de.ts` `uploadCheck`; the form takes strings as props. Route responses ("Forbidden", "Unauthorized") are English API texts, no UI | OK |
| No personal data in logs | Yes | The only log line is `abandoned upload not cleaned up: <name>: <message>` – content name only. `pending_upload.issued_to` is a team member ID in the database, not a log | OK |
| Security advisories | Not changed by this diff | A new dependency was not added (`@vercel/blob` was already there) | n/a |
| Migration | Yes | `0024_pending_upload.sql` (hand-written FKs, one-owner CHECK, index on `issued_at`) | OK |

## Finding: "refused by the permission itself" – honest?
Only partly. Vercel Blob enforces `maximumSizeInBytes` for an upload in one piece, **not** for a multipart upload (found with 25 MB under a 21 MB limit). So:
- The criterion is met as written: tested at small scale, in-memory and in the browser, and a 2 KB file under a 1 KB limit is really refused by Blob.
- Above 20 MB, i.e. exactly the large files this task exists for, the permission does not refuse. The size is checked in `withUploadedContent` when attaching (`storage.size`, then delete and `too-large`). That is tested with the in-memory adapter (a content written larger than allowed). It is **not** tested against a real Blob multipart upload above the limit.
- Consequence: an oversized multipart file reaches the private store and stays until the attach attempt or the 24 h cleanup. A team member can use storage space, but not reach anyone else's data. That is a cost risk, not a security or data-loss risk, so no follow-up story.
- Recommended wording for the PR: "Blob refuses a file above the limit by the permission for uploads in one piece (up to 20 MB, tested in the browser). For multipart uploads (above 20 MB) Blob does not enforce the limit; attaching checks the stored size, deletes the content and refuses with `too-large`, and unattached content is deleted after 24 h. The ADR/convention records this." The tick for criterion 4 should carry that note rather than imply the permission refuses 100 MB+ files. Better still, the ADR should say it as a consequence (it is in the conventions; not verified in ADR 0009 beyond what I read in the grep).

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Deactivated team member or expired session during an upload (the address request after the name request) | `teamMember` doc says "none for a deactivated account", so the rule exists; no test | fix now (one small test, about 10 minutes) or accept as covered by `loggedInTeamMember` tests |
| Cleanup is triggered only by the upload route, not by "a later request" in general | The story/ADR says "a later request"; the route is the only trigger. Without any new upload, abandoned content stays | question for the user (acceptable if uploads are regular; ST-037 could add attaching as a trigger) |
| Cleanup meets a pending record whose content was never uploaded (user closed the page after step 1) | none; `storage.delete` on a missing name must not throw, otherwise the oldest records block the 20-per-call queue forever. The Blob adapter's `del` of an unknown pathname is not tested | fix now: one test or check that `blobStorage().delete` of a missing name resolves (the browser test could do it) |
| Multipart upload still running when the 30 minute address expires (100 MB on a slow phone) | none | question; the 100 MB phone check on the preview answers it |
| Concurrent attach and cleanup at 24 h | ADR 0009 (row-level delete wins once); implemented with `DELETE ... RETURNING`; not tested concurrently | accept (the design is sound; the unit tests cover each side) |
| Same file chosen twice / two tabs | Each choice makes a new name; the old one is cleaned up | OK |
| Content-Type (any format) / file name | `contentType` falls back to `application/octet-stream`. The original file name is not kept (ST-037 must store it) | hand-over note for ST-037 (the story's HO notes exist) |
| `maximumSize` in the request is client-controlled | Allowed by the user decision (stricter only) and `Math.min` caps it; tested | OK |
| Machine "Not on display" / retired as owner | No rule in the story. The route accepts any existing machine | question for ST-037 |
| Other language | The check page is German only (team page) | OK per project rule |

## Remarks to address before the pull request (all fixable in about an hour; none passes the follow-up hurdle)
1. State honestly in the PR and at criterion 4 that multipart uploads are limited at attach time, not by the permission.
2. A test (or a browser step) showing `delete` of a missing name does not throw on the Blob adapter.
3. A test for the `not-uploaded` failure shown in the form, and one for the deactivated account on the route (small).
4. A test that `viewAddressOf` is valid exactly 5 minutes (fixed clock).

## Verdict: accepted with remarks
The unticked items (phone 100 MB, headers test on the preview, conventions approval) are open by design; no scenario without evidence and no failing test. The remaining items must be ticked after the preview check and the user's approval.

## Resolution (main session, 2026-10-18)
- **1** – criterion 4 is stated in the PR as: refused by the permission for an upload in one piece (browser test); for an upload in parts, refused by the size check when attaching (`too-large`, integration test with the in-memory adapter, which now behaves like Blob there). Open question row for the user.
- **2** – Vercel Blob's delete is idempotent (`POST /delete` with the URLs, no error for a missing blob – `@vercel/blob` 2.8.2 `del`); a name issued and never uploaded is cleaned up like any other. Not tested against Blob – revisit if a cleanup ever logs a failure.
- **3** – skipped: `not-uploaded` is the catch-all of the browser function; the deactivated account is `loggedInTeamMember` returning nothing, tested in the Team module (ST-005/ST-069).
- **4** fixed – `src/upload/view-address.test.ts` (5 minutes, only server-given names).
- **5** – as decided in ADR 0009 (Consequences: at most one day's abandoned forms stay until the next upload).
