---
id: ST-072
title: Photo module with a storage seam – store, run the command, delete on failure
type: tech-task
context: BC-Repair
priority: must
size: M
risk: medium
events: []
depends_on: [ST-071]
labels: [foundation, architecture]
status: ready
---

## Task
Implements the photo and storage decisions of the architecture review 2026-09-27 (decisions Q1–Q22, grilling session with `/improve-codebase-architecture`): **Q7, Q8, Q16, Q17, Q22**, plus the review's findings on photo IDs and times, deletion, error vocabulary and the public interface. The decision record is `docs/adr/0007-photo-and-file-storage-consistency.md` (accepted). Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

**Ordering.** Before ST-016 (photo on a problem report), the first story that stores a photo for an aggregate; ST-020 (spam dismissal), ST-032 and ST-054 use the same module (their files are not changed by this task). It depends on ST-071 because "run this command" wraps `executeCommand`, whose command shape, result types and injected dependencies ST-071 reworks – building the photo flow on the old `run` shape would have to be redone. It does not depend on ST-074: the operation only wraps `executeCommand` and its result type, and is tested with a test stand-in command – it needs neither the event catalogue, the typed acting person nor `context.run`.

Today (`src/photo/*`, `docs/architecture/photos.md`) the caller sequences `acceptPhoto` → `storePhoto` → command itself, `storePhoto` names the photo with `randomUUID()` and calls Vercel Blob directly, `photoAddresses` computes validity with `Date.now()`, a photo can never be deleted, and a rejected command leaves an orphaned photo ("accepted for now; decided in ST-016"). The review decided:

- **Q7/Q17 – store first, delete on failure, once.** The photo module offers one operation: "store this upload for this owner, run this command with the photo reference, delete the photo if the command is rejected or throws". Server Actions use it; no caller sequences store → command → cleanup by hand. No cleanup job (`docs/adr/0002-modular-monolith-state-based-persistence.md`). The only possible leftover – a photo written just before a server crash – is an unreachable private blob (ADR 0007, Consequences).
- **Q8 – one storage seam** in `src/platform/`, used by photos and by files (`AGG-File`, manuals and schematics). The photo rules – downscaling, limits, metadata removal (ST-002, `src/photo/limits.ts`) – stay in the photo module. For files, ADR 0007 applies the same rule to direct browser uploads: the content is uploaded before the attaching command, and that command deletes the uploaded content through the same seam when it is rejected; ST-037 and ST-038 build that on this seam.
- **Q16 – injected adapter.** The storage adapter is injected like the clock and the ID generator: a Vercel Blob adapter in production, an in-memory adapter in integration tests. Browser tests on the preview use the real Blob store.
- **Review findings:** photo IDs and times come from the injected ID generator and clock; the seam has a delete operation (needed by ST-020 to remove the photo of a spam report); one error vocabulary for photos (`too-large`, `not-an-image`, `unsupported-format`, …) mapped to catalogue texts; the photo module gets an `index.ts` as its public interface.
- **Q22 – conversion.** Converts `src/photo/*`. The spike photo page (`src/app/spike/photos/`) stays its only user until ST-066 removes it.

## Acceptance Criteria
- [ ] A storage seam in `src/platform/` offers write, delete and a short-lived view address; it has a Vercel Blob adapter and an in-memory adapter, and domain code reaches Blob only through it.
- [ ] `@vercel/blob` may be imported only by the Blob adapter: a deliberate import of `@vercel/blob` from any other file under `src/` makes `npm run verify` fail (lint rule in `eslint.config.mjs`, shown by a case in `src/platform/module-boundaries.test.ts`).
- [ ] The storage adapter is injected like the clock and the ID generator; integration tests use the in-memory adapter and never reach Vercel Blob.
- [ ] The photo module has an `index.ts`; other code imports only it (module boundary rule in `eslint.config.mjs`, shown by a case in `src/platform/module-boundaries.test.ts`).
- [ ] The photo module's "store, run, delete on failure": with an accepted command the photo is stored and the command received exactly its reference (integration test with a test stand-in command, in-memory adapter – the problem report gets its photo reference only with ST-016).
- [ ] A rejected command leaves no stored photo (integration test, in-memory adapter).
- [ ] A command that throws leaves no stored photo, and the error still reaches the caller (integration test, in-memory adapter).
- [ ] A command rejected with `not-authorized` leaves no stored photo (integration test, in-memory adapter).
- [ ] A photo's ID and the validity of its view address come from the injected ID generator and clock: with a fixed ID and `fixedClock(…)` the stored name and the expiry (5 minutes after the clock's time) are exactly as expected (test with the in-memory adapter); no `randomUUID()` or `Date.now()` is left in `src/photo/`.
- [ ] Deleting a stored photo through the seam makes it unreadable (integration test, in-memory adapter).
- [ ] Every photo error code has a text in `team.de`, `visitor.de` and `visitor.en` (extends `src/platform/messages/messages.test.ts`); the error codes are defined once in the photo module.
- [ ] The photo rules are unchanged: `src/photo/accept-photo.test.ts` and `src/photo/prepare-photo.test.ts` stay green without changed assertions.
- [ ] The spike photo page still stores a photo in the private Blob store on the commit's preview through the Blob adapter (manual check on the preview, noted in the pull request; the first browser test with a photo comes with ST-016).
- [ ] `docs/architecture/photos.md` describes the module's public interface and the store → run → delete-on-failure order instead of "orphaned, accepted for now", referring to ADR 0007.
- [ ] Converts the existing code (no test weakened); `npm run verify` is green.
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): module layout (photo module, storage seam), "a photo is stored only through the photo module's store-run-delete operation", the injected storage adapter, and the seam catalog row for code that stores content.

## Out of Scope
- Storing a photo with a problem report, showing it to the team (ST-016)
- Deleting the photo of a spam report (ST-020 – uses the delete operation)
- Direct browser uploads of files and their upload addresses, attaching and removing files (ST-037, ST-038 – build on this seam)
- The Server Action runner that photo forms go through (ST-073)
- Removing the spike pages (ST-066); the separate Blob store for previews (ST-061)

## Open Questions
- none
