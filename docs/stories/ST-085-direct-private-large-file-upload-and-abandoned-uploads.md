---
id: ST-085
title: Direct private large-file upload and abandoned uploads
type: tech-task
context: BC-Collection
priority: should
size: null
risk: null
events: []
depends_on: [ST-001, ST-016]
labels: [files, foundation]
status: draft
---

## Task
Split off ST-037 in the backlog grooming of 2026-10-17 (`docs/reviews/2026-10-17-backlog-grooming.md`, sections 4, 6 and 9 item 2; lead dev). ST-037 ("attach and find files by file category") builds on this task.

**1. Direct upload from the browser to the private Blob store.** Files go up to 100 MB (`OPEN_QUESTIONS.md`, ST-037) – far above the function body limit – so they go from the browser directly to the private Vercel Blob store, as ST-001 proved (a 100 MB PDF uploaded without passing through a server function, with a short-lived permission issued by the server) and as ADR 0006 decided: presigned upload addresses (`handleUploadPresigned` / `uploadPresigned`, multipart above 20 MB), the server issues a short-lived, size-limited permission only after its own authorization check, downloads through presigned GET addresses valid for 5 minutes. It goes through the one **storage seam** of ADR 0007 (`src/platform/storage/`, built with the photos of ST-016), which gets an upload address next to write, delete and view addresses – in both adapters (Vercel Blob, in memory). ADR 0007 already decides that the attaching command deletes uploaded content when it is rejected.

**2. Abandoned uploads – the decision this task needs first.** ADR 0007 has **no cleanup job** (ADR 0002: no scheduler) and accepts only one leftover: content written just before a server crash between upload and command. A direct upload is a second, much more common case it does not cover: a team member uploads a 60 MB manual and closes the page before attaching it – no command runs, so nothing deletes the content. Direction decided (user, backlog grooming 2026-10-17): option (b), abandoned uploads are cleaned up on a later request, without a scheduler; the ADR that supersedes ADR 0007 is written first in this task. Options (the grooming names the question but lists no options; these are derived from ADR 0002, ADR 0007 and the grooming's ST-062 note):
- (a) **Accept them** like ADR 0007's crash leftover: unreferenced, private, unreachable without a signed address; a one-off manual sweep remains possible. Cheapest; storage grows with every abandoned form.
- (b) **Clean up on a later request, without a scheduler**: uploads are written under a prefix that marks them as not attached yet; attaching moves or marks them; the next attach (or another regular team request) deletes not-attached content older than a fixed age (e.g. 24 hours). Works within ADR 0002, at the cost of a little work in an unrelated request.
- (c) **An external scheduler** (e.g. a scheduled GitHub Actions workflow or Vercel Cron) that sweeps not-attached content – the same ADR question as ST-062's weekly Blob backup (grooming section 4); it needs a new ADR that supersedes part of ADR 0002.
Recommendation (requirements-engineer, to be confirmed by the architect): (b) – it keeps "no scheduler" and bounds the leftovers. The decision becomes an ADR (`proposed`; the user accepts it) before this task is built; the checklist item on abandoned uploads below is worded after that decision.

## Acceptance Criteria
- [ ] An ADR decides how abandoned direct uploads are handled (options above), and the user has accepted it.
- [ ] The storage seam offers a short-lived, size-limited upload address for one owner (machine or machine model), issued only after the server's own authorization check (team members only); both adapters implement it, the in-memory one for integration tests.
- [ ] A PDF of 100 MB is uploaded from a phone browser directly to the private Blob store without passing through a server function, and a file above 100 MB is refused by the permission itself, not only by the form.
- [ ] Someone who is not logged in gets no upload address (asserted with a request without a session).
- [ ] Uploaded content is reachable only through a presigned address valid for 5 minutes; its plain store address does not deliver it.
- [ ] When the attaching command is rejected, the uploaded content is deleted through the seam (ADR 0007); asserted with the in-memory adapter.
- [ ] Abandoned uploads are handled as the ADR decides, and the mechanism is documented in `.claude/skills/engineering-conventions/SKILL.md` (user approves).
- [ ] The upload works under the current security headers on the preview; ST-070's script policy, which comes after this task, allows only the Blob store's host for it.

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
