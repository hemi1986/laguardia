---
id: ST-016
title: Add a photo to a problem report and show it to the team
type: story
context: BC-Repair
priority: must
size: L
risk: medium
events: [EVT-ProblemReported]
depends_on: [ST-002, ST-015, ST-017, ST-021, ST-064, ST-073]
labels: [mvp, visitor, triage, ui]
status: in-progress
---

## Story
As a visitor, I want to add a photo from my phone camera to my problem report, so that the technician understands the problem without having to reproduce it.

## Context
`EVT-ProblemReported` has an optional photo; `CMD-ReportProblem`: photo is optional. Applies to visitors and team members alike.
- The photo belongs to the problem report; it is not a file (`CONTEXT.md`).
- Photo handling from spike ST-002: rotated, downscaled, re-encoded, EXIF (incl. GPS location) removed, image type as documented by ST-002. Size limit (user decision 2026-09-27): photos up to 20 MB are accepted; they are stored downscaled to a longest edge of 2048 px and at most 1 MB. Spike ST-002 may correct these numbers.
- Visitor photos may show people and are personal data (`docs/adr/0005-hosting-vercel.md`); only team members can see them. Visitors never see photos of problem reports (HS-1).
- One photo per problem report ("Photo (optional)").
- This story owns showing the photo to team members: in the triage list (ST-017) and in the defect details with the originating and linked problem reports (ST-021).
- The visitor report form shows a short privacy notice about the photo in German and English, linking to the full privacy notice (ST-064); the notice text is provided by the museum.
- A photo is kept as long as its problem report; it is only removed when the problem report is dismissed as spam (ST-020).
- If sending the photo fails, the typed description is kept so the visitor does not have to type it again.

**Foundation (moved from ST-072 on 2026-09-27).** This is the first story that stores a photo for an aggregate, so it builds the photo module with its storage seam: the photo and storage decisions of the architecture review 2026-09-27 (decisions Q1–Q22, grilling session with `/improve-codebase-architecture`) **Q7, Q8, Q16, Q17, Q22**, plus the review's findings on photo IDs and times, deletion, error vocabulary and the public interface. The decision record is `docs/adr/0007-photo-and-file-storage-consistency.md` (ADR 0007, accepted). ST-020 (spam dismissal), ST-032 and ST-054 use the same module. It builds on the command shape of ST-071 ("run this command" wraps `executeCommand`) and on the Server Action runner of ST-073 (the photo form goes through the runner). Today (`src/photo/*`, `docs/architecture/photos.md`) the caller sequences `acceptPhoto` → `storePhoto` → command itself, `storePhoto` names the photo with `randomUUID()` and calls Vercel Blob directly, `photoAddresses` computes validity with `Date.now()`, a photo can never be deleted, and a rejected command leaves an orphaned photo ("accepted for now; decided in ST-016"). The review decided:
- **Q7/Q17 – store first, delete on failure, once.** The photo module offers one operation: "store this upload for this owner, run this command with the photo reference, delete the photo if the command is rejected or throws". Server Actions use it; no caller sequences store → command → cleanup by hand. No cleanup job (`docs/adr/0002-modular-monolith-state-based-persistence.md`). The only possible leftover – a photo written just before a server crash – is an unreachable private blob (ADR 0007, Consequences).
- **Q8 – one storage seam** in `src/platform/`, used by photos and by files (`AGG-File`, manuals and schematics). The photo rules – downscaling, limits, metadata removal (ST-002, `src/photo/limits.ts`) – stay in the photo module. For files, ADR 0007 applies the same rule to direct browser uploads: the content is uploaded before the attaching command, and that command deletes the uploaded content through the same seam when it is rejected; ST-037 and ST-038 build that on this seam.
- **Q16 – injected adapter.** The storage adapter is injected like the clock and the ID generator: a Vercel Blob adapter in production, an in-memory adapter in integration tests. Browser tests on the preview use the real Blob store.
- **Review findings:** photo IDs and times come from the injected ID generator and clock; the seam has a delete operation (needed by ST-020 to remove the photo of a spam report); one error vocabulary for photos (`too-large`, `not-an-image`, `unsupported-format`, …) mapped to catalogue texts; the photo module gets an `index.ts` as its public interface.
- **Q22 – conversion.** Converts `src/photo/*`. The spike photo page (`src/app/spike/photos/`) stays its only other user until ST-066 removes it.
- **Forms with a photo (moved from ST-073).** A form with a photo runs its command through the photo module's "store, run, delete on failure", so a rejected form leaves no stored photo.

## Acceptance Criteria

Scenario: Visitor adds a photo taken with the phone camera
  Given a visitor is reporting a problem for "LG-042"
  When the visitor takes a photo with the phone camera and submits the problem report
  Then the problem report has the photo, downscaled to a longest edge of at most 2048 px and at most 1 MB
  And the stored photo contains no location or other EXIF metadata

Scenario: Team member adds a photo
  Given a helper is reporting a problem for "LG-042" from its machine record
  When the helper chooses an existing photo from the phone and submits the problem report
  Then the problem report has the photo

Scenario: Photo is optional
  When a visitor submits a problem report with a description and without a photo
  Then the problem report is recorded without a photo

Scenario: Non-image content is rejected
  When a visitor submits a problem report with content that is not an image as photo
  Then the problem report is rejected
  And the visitor is asked to choose a photo or leave it out

Scenario: Photo above the size limit is rejected
  When a visitor submits a photo larger than 20 MB
  Then the problem report is rejected with the maximum size of 20 MB shown

Scenario: Failed photo keeps the description
  Given a visitor has typed the description "Right flipper dead"
  When sending the photo fails
  Then the form still contains "Right flipper dead"
  And the visitor can try again or submit without a photo

Scenario: Technician sees the photo in the triage list
  Given an untriaged problem report for "LG-042" has a photo
  When a technician opens the triage list
  Then the photo is shown with the problem report

Scenario: Photo is shown in the defect details
  Given a defect was recorded from a problem report with a photo
  When a team member opens the defect
  Then the photo of its originating problem report is shown

Scenario: Visitor sees the privacy notice
  Given a visitor with an English browser is reporting a problem for "LG-042"
  When the visitor is about to add a photo
  Then the museum's privacy notice about the photo is shown in English

Scenario: Photo is kept with its problem report
  Given a problem report with a photo was triaged as defect recorded
  When a team member opens the defect's originating problem report a year later
  Then the photo is still shown

Scenario: Only team members can see the photo
  Given a problem report for "LG-042" has a photo
  When a visitor opens the visitor machine page of "LG-042"
  Then the photo is not shown and cannot be opened

### Foundation (moved from ST-072 and ST-073 on 2026-09-27 – architecture review Q7, Q8, Q16, Q17, Q22; ADR 0007)
- [ ] A storage seam in `src/platform/` offers write, delete and a short-lived view address; it has a Vercel Blob adapter and an in-memory adapter, and domain code reaches Blob only through it.
- [ ] `@vercel/blob` may be imported only by the Blob adapter: a deliberate import of `@vercel/blob` from any other file under `src/` makes `npm run verify` fail (lint rule in `eslint.config.mjs`, shown by a case in `src/platform/module-boundaries.test.ts`).
- [ ] The storage adapter is injected like the clock and the ID generator; integration tests use the in-memory adapter and never reach Vercel Blob.
- [ ] The photo module has an `index.ts`; other code imports only it (module boundary rule in `eslint.config.mjs`, shown by a case in `src/platform/module-boundaries.test.ts`).
- [ ] The photo module's "store, run, delete on failure": with an accepted command the photo is stored and the command received exactly its reference (integration test with a test stand-in command, in-memory adapter).
- [ ] A rejected command leaves no stored photo (integration test, in-memory adapter).
- [ ] A command that throws leaves no stored photo, and the error still reaches the caller (integration test, in-memory adapter).
- [ ] A command rejected with `not-authorized` leaves no stored photo (integration test, in-memory adapter).
- [ ] A form with a photo runs through the photo module's store-run-delete via the Server Action runner (ST-073): when its command is rejected, the action returns `{ error, values }` and no photo is stored (integration test with a test stand-in command and the in-memory storage adapter; moved from ST-073).
- [ ] A photo's ID and the validity of its view address come from the injected ID generator and clock: with a fixed ID and `fixedClock(…)` the stored name and the expiry (5 minutes after the clock's time) are exactly as expected (test with the in-memory adapter); no `randomUUID()` or `Date.now()` is left in `src/photo/`.
- [ ] Deleting a stored photo through the seam makes it unreadable (integration test, in-memory adapter).
- [ ] Every photo error code has a text in `team.de`, `visitor.de` and `visitor.en` (extends `src/platform/messages/messages.test.ts`); the error codes are defined once in the photo module.
- [ ] The photo rules are unchanged: `src/photo/accept-photo.test.ts` and `src/photo/prepare-photo.test.ts` stay green without changed assertions.
- [ ] The spike photo page still stores a photo in the private Blob store on the commit's preview through the Blob adapter (manual check on the preview, noted in the pull request).
- [ ] `docs/architecture/photos.md` describes the module's public interface and the store → run → delete-on-failure order instead of "orphaned, accepted for now", referring to ADR 0007.
- [ ] Converts the existing code (no test weakened); `npm run verify` is green.
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): module layout (photo module, storage seam), "a photo is stored only through the photo module's store-run-delete operation", the injected storage adapter, the seam catalog row for code that stores content, and forms with a photo in the Server Action runner.

## Out of Scope
- Several photos per problem report
- Photos on work log entries (ST-032)
- Deleting the photo of a spam report (ST-020 – uses the seam's delete operation)
- Direct browser uploads of files and their upload addresses, attaching and removing files (ST-037, ST-038 – build on the storage seam)
- Removing the spike pages (ST-066); the separate Blob store for previews (ST-061)

## Open Questions
- none
