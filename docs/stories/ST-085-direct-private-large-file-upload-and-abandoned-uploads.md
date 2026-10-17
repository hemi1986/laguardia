---
id: ST-085
title: Direct private large-file upload and abandoned uploads
type: tech-task
context: BC-Collection
priority: should
size: L
risk: high
events: []
depends_on: [ST-001, ST-016]
labels: [files, foundation]
status: ready
---

## Task
Split off ST-037 in the backlog grooming of 2026-10-17 (`docs/reviews/2026-10-17-backlog-grooming.md`, sections 4, 6 and 9 item 2; lead dev). ST-037 ("attach and find files by file category") builds on this task.

**1. Direct upload from the browser to the private Blob store.** A file is at most 100 MB (`OPEN_QUESTIONS.md`, row ST-037 of 2026-09-26: "up to 100 MB, any format", accepted by the user and confirmed by ST-001) – far above the function body limit – so files go from the browser directly to the private Vercel Blob store, as ST-001 proved and ADR 0006 decided: presigned upload addresses (`handleUploadPresigned` / `uploadPresigned`, multipart above 20 MB); the server issues a short-lived, size-limited permission only after its own authorization check; downloads go through presigned GET addresses valid for 5 minutes. It goes through the one **storage seam** of ADR 0007 (`src/platform/storage/`, built with the photos of ST-016), which gets an upload address next to write, delete and view addresses – in both adapters (Vercel Blob, in memory). ADR 0007 already decides that the attaching command deletes uploaded content when it is rejected.

**2. Abandoned uploads – decided: cleaned up on a later request, without a scheduler** (option (b); user, backlog grooming 2026-10-17). A direct upload whose form is never sent – a team member uploads a 60 MB manual and closes the page – runs no command, so nothing deletes its content; ADR 0007 covers only the crash leftover. This task first writes the ADR that supersedes ADR 0007 (architect skill, `proposed`; the user accepts). Input for that ADR (lead dev, story review 2026-10-17):
- A pending upload is recorded in the database when its upload address is issued; attaching the file ends that record.
- Pending uploads older than a fixed age are deleted after the response of a later request (so the person making that request does not wait for it), within ADR 0002's "no scheduler".
- Attaching after the uploaded content is gone is rejected and says what to do; that behaviour is ST-037's scenario "Attaching after the uploaded content is gone".

Rejected alternatives:
- (a) **Accept abandoned uploads** like ADR 0007's crash leftover (private, unreachable without a signed address) – storage grows with every abandoned form.
- (c) **An external scheduler** (scheduled GitHub Actions workflow or Vercel Cron) – it would supersede part of ADR 0002; the same question stays open for ST-062's weekly Blob backup.

## Acceptance Criteria
- [ ] An ADR that supersedes ADR 0007 decides how abandoned direct uploads are cleaned up on a later request (pending uploads recorded in the database, stale ones deleted after the response of a later request), and the user has accepted it.
- [ ] The storage seam offers a short-lived, size-limited upload address for one owner (machine or machine model), issued only after the server's own authorization check (team members only); both adapters implement it, the in-memory one for integration tests. The size limit is a parameter of the seam, not a constant inside it.
- [ ] The route that issues upload addresses verifies the request's Origin and a team session itself, independent of any page: a request without a session gets no upload address, and a request from another Origin gets none (both asserted).
- [ ] A file above the size limit is refused by the permission itself, not only by the form – tested at small scale with a small limit: once with the in-memory adapter and once in a browser test against the Development Blob store.
- [ ] A browser-side upload function, the counterpart of `src/photo/browser.ts`, uploads a file with the upload address, reports progress while it runs and reports a failed upload to the form, so the form can say so instead of attaching nothing.
- [ ] A file of about 25 MB is uploaded as a multipart upload (above 20 MB) from the browser directly to the Development Blob store without passing through a server function (browser test).
- [ ] A PDF of 100 MB is uploaded once from a phone browser on the preview, directly to the private Blob store (manual check, recorded in the pull request).
- [ ] Uploaded content is reachable only through a presigned address valid for 5 minutes; its plain store address does not deliver it.
- [ ] When the attaching command is rejected, the uploaded content is deleted through the seam (ADR 0007); asserted with the in-memory adapter.
- [ ] Abandoned uploads are cleaned up as the ADR decides: a pending upload older than the fixed age is deleted after a later request and a younger one is kept (integration test with the injected clock and the in-memory adapter).
- [ ] The upload works under the current security headers: a browser test on the preview uploads a file and finds no blocked request. ST-070's script policy, which comes after this task, allows only the Blob store's host for it.
- [ ] `.claude/skills/engineering-conventions/SKILL.md` (user approves): the seam catalog row for code that stores content is extended with the upload address and the browser-side upload function, and the cleanup of abandoned uploads is documented.

## Out of Scope
- The form, the file categories, the machine record's files section and `CMD-AttachFile` itself (ST-037)
- Removing files (ST-038)
- Photos – they go through the server (ST-016, ST-032, ST-054; ADR 0007)
- Separate Blob stores for preview and production (ST-061)

## Open Questions
- none – direction decided (user, backlog grooming 2026-10-17): option (b), abandoned uploads are cleaned up on a later request, without a scheduler. The ADR that supersedes ADR 0007 is written at the start of this task (architect skill, `proposed`; the user accepts).

## Notes
- Order (user, 2026-10-17, section 9 item 2): this task and ST-037 come after the defect lifecycle (ST-029, ST-030, ST-053, ST-031) – a planning order, not a dependency; start it by name, `/implement ST-085`.
- ST-070 (full script policy) depends on this task, because its criterion "a file upload works under the policy" needs this upload.
- One task (user, story review 2026-10-17, decision 3 – conflict 2 decided for the lead dev): the PO proposed splitting the ADR and cleanup from the upload; it stays one task as the grooming decided. If it grows during implementation, it may be split into two tasks – ADR and cleanup, and the upload ("085a/085b" in the review) – each a story file with its own next free ID; that split is a backlog change, not a decision for the code.
- Size L and risk high (lead dev, story review 2026-10-17).
