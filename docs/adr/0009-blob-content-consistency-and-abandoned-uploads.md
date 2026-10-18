---
status: accepted
date: 2026-10-18
---

# 0009 – Blob content is stored before the command and deleted when it fails; abandoned direct uploads are cleaned up on a later request

Supersedes `docs/adr/0007-photo-and-file-storage-consistency.md` once accepted (ADR 0007 is accepted and cannot be edited). Everything ADR 0007 decided stays; what changes is its "no cleanup job" for content uploaded directly from the browser.

## Context and Problem
Files go from the browser directly to the private Blob store, because a file may be 100 MB and a function body only 4.5 MB (`docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`, `docs/stories/OPEN_QUESTIONS.md` row ST-037). The upload therefore happens *before* the attaching command, in a separate step of the form. ADR 0007 covers the case where that command is rejected, and accepts one leftover: content written just before a crash. It does not cover the common case found in the backlog grooming of 2026-10-17 (`docs/reviews/2026-10-17-backlog-grooming.md`, sections 4 and 6): a team member chooses a 60 MB manual – it is uploaded at once – and then closes the page. No command runs, so nothing deletes the content, and the store grows with every abandoned form. The user chose to clean such content up on a later request, without a scheduler (option (b), backlog grooming 2026-10-17; `docs/stories/ST-085-direct-private-large-file-upload-and-abandoned-uploads.md`).

## Driving Requirements
- Files up to 100 MB, any format, uploaded from a phone – `docs/stories/OPEN_QUESTIONS.md` (ST-037), `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`
- Files are visible to team members only – rule on `CMD-AttachFile`, `docs/domain/events.yaml`
- Content belongs to exactly one aggregate – `docs/architecture/data-model.md`
- No scheduler, cron job or background worker – `docs/adr/0002-modular-monolith-state-based-persistence.md`
- Blob has no restore; deleting content is irreversible – `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`

## Considered Options
1. **Accept abandoned uploads** like ADR 0007's crash leftover (private, unreachable without a signed address) – rejected: storage grows with every abandoned form, and nothing tells which content is referenced.
2. **Record pending uploads in the database and clean up stale ones after the response of a later request** – chosen.
3. **An external scheduler** (scheduled GitHub Actions workflow or Vercel Cron) – rejected: it would supersede part of ADR 0002; the same question stays open for ST-062's weekly Blob backup.

## Decision
ADR 0007's decisions hold unchanged: one **storage seam** (`src/platform/storage/`, a Vercel Blob and an in-memory adapter, injected like the clock and the ID generator); photos go through the server with "store → run the command → delete the content if it fails"; deliberate removal deletes content as part of the owning command's flow; content is never deleted as a compensation after a committed command. In addition, for content uploaded directly from the browser:

- **The server names the content and records it as a pending upload.** A team member asks for an upload address for one owner (a machine or a machine model). The server checks the request itself (its Origin and a team session – the route is not behind the page proxy), names the content from the injected ID generator, and records a **pending upload** in PostgreSQL in the same step: the name, the owner, the team member it was issued to and the time from the injected clock. Only then does it sign the upload permission – for exactly that name, for that team member, limited in size (100 MB for files) and valid for 30 minutes. The browser cannot choose a name or raise the limit.
- **Attaching ends the pending upload.** The attaching command (`CMD-AttachFile`, ST-037) first takes the pending upload – it must exist, belong to the same owner and be younger than the fixed age – and removes the record; then it runs. No pending upload means the content is gone or was never issued: the attaching is rejected and says that the file must be chosen again (ST-037). When the command is rejected or throws, the content is deleted through the seam (ADR 0007).
- **Stale pending uploads are cleaned up after the response of a later request.** A pending upload older than the **fixed age of 24 hours** is abandoned. After the response of every upload address request (Next.js `after()`, so the person asking does not wait), the server removes a bounded number of abandoned pending uploads, one at a time: it deletes the record and its content in one database transaction, so a failed content deletion keeps the record for the next attempt. Storage grows only through uploads, and every upload triggers a cleanup, so abandoned content stays bounded without a scheduler.
- **The fixed age separates the two sides.** Attaching accepts only pending uploads younger than the fixed age; the cleanup touches only older ones. Both remove the record with a row-level delete, so a pending upload is either attached or cleaned up, never both.

## Consequences
- A form left open for more than 24 hours points at content that may be gone; ST-037's scenario "Attaching after the uploaded content is gone" covers it. 24 hours is far longer than a team member fills a form, and short enough that abandoned manuals do not pile up.
- If nobody uploads for a long time, abandoned content of the last upload stays until the next one – at most the content of one day's abandoned forms.
- The crash leftover of ADR 0007 shrinks to one case: the record was taken by the attaching step and the server crashed before the command committed. That content is unreferenced and private; a one-off manual sweep remains possible.
- The upload address route is a route handler, not a Server Action, because the Blob client library calls it. It checks the Origin and the session itself (`src/proxy.ts` does not match `/api/`) and gives no address without both.
- Photos are unchanged: they go through the server and never leave a pending upload.
- Follow-up: ST-085 builds the pending uploads, the cleanup and the upload address (seam, both adapters, route, browser-side upload function); ST-037 uses them in `CMD-AttachFile`; ST-070's script policy allows the Blob store's host for the upload.
