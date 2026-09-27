---
status: accepted
date: 2026-09-27
---

# 0007 – Blob content is stored before the command and deleted when the command fails; one storage seam, no cleanup job

## Context and Problem
Photos (problem report ST-016, work log entry ST-032, camera photo as a file ST-054) and files (manuals and schematics, ST-037) live in Vercel Blob (`docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`); the aggregates that own them live in PostgreSQL, changed by commands in one transaction (`docs/adr/0002-modular-monolith-state-based-persistence.md`). Blob cannot join that transaction, so a command and its content can drift apart: a rejected command (`description-required`, `not-authorized`, `version-conflict`) leaves content nobody references; a stored aggregate may point to content that was never written. Content must also be removable on purpose – spam dismissal removes the photo (`AGG-ProblemReport` in `docs/architecture/data-model.md`, ST-020), a removed file's content is deleted (ST-038). Decided in the architecture review of 2026-09-27 (Q7, Q8, Q16, Q17).

## Driving Requirements
- Photo and file content belong to exactly one aggregate; a dismissed-as-spam problem report has no photo – `docs/architecture/data-model.md`
- No scheduler, cron job or background worker – `docs/adr/0002-modular-monolith-state-based-persistence.md`
- Visitor photos may show people; they are kept only as long as the problem report – `docs/stories/OPEN_QUESTIONS.md` (ST-016)
- Large files go from the browser directly to Blob; photos go through the server – `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`, `docs/architecture/photos.md`

## Considered Options
1. **Store first, run the command with the content reference, delete the content if the command is rejected or throws.**
2. **Command first, content afterwards** as a second step – a failed upload leaves an aggregate without its content (a problem report that promised a photo has none).
3. **Temporary content plus a cleanup job** that deletes unconfirmed content later – needs a scheduler, which ADR 0002 rules out.

## Decision
Option 1, implemented once:
- A **storage seam** in `src/platform/` is used by photos and by files alike: write, delete, and short-lived view/upload addresses. Two adapters: Vercel Blob in production, in memory in integration tests. It is injected like the clock and the ID generator; content IDs and times come from those.
- The **photo module** (and later the file handling in Collection) offers the one operation "store this content for this owner, run this command with its reference, delete the content if the command fails". Server Actions use it; no caller sequences store → command → cleanup by hand.
- For direct browser uploads (files above the function body limit), the upload happens before the command by nature; the attaching command deletes the uploaded content when it is rejected, through the same seam.
- Deliberate removal (spam dismissal, file removal) deletes content through the seam as part of the owning command's flow.

## Consequences
- The only possible leftover is content written just before a server crash between upload and command – unreferenced, in a private store, unreachable without a signed address. Accepted instead of a cleanup job; a one-off manual sweep remains possible if it ever matters.
- Content deletion is irreversible (Blob has no restore, ADR 0006): deleting after a *committed* command is only allowed for deliberate removal, never as a compensation.
- Follow-up: the tech task for the photo module (architecture review 2026-09-27, package B) builds the seam and both adapters; the file stories (ST-037, ST-038) use it.
