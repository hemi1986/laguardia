# Acceptance – ST-002: Take photos with a phone camera and upload them safely
Date: 2026-09-27 · Tests run: `npm test` → 18 passed, 0 failed (also `npx vitest run src/photo` → 14 passed) · `node .claude/skills/implement/scripts/verify.ts` → lint, typecheck, tests, `events.yaml`, story validation, scenario/domain traceability and glossary language all OK · Preview: https://laguardia-git-st-002-photo-upload-phone-camera-hemi6.vercel.app/spike/photos (behind Vercel Authentication and the stub login; not reachable by this review, per instructions no credentials were requested – evidence below is code inspection, the automated test suite, and the manual verification already recorded in `docs/architecture/photos.md` / relayed in the task)

ST-002 is a spike: there are no Gherkin scenarios, so each ticked checklist item is checked for evidence instead.

## Acceptance checklist

| # | Item | Evidence | Verified how | OK? |
|---|---|---|---|---|
| 1 | Camera and gallery both work in iOS Safari and Android Chrome | `photos.md` "Two inputs" and "Measured" sections: portrait/landscape from camera and gallery stored upright on both phones | Manual device test (recorded in `photos.md`, relayed in task) | Yes |
| 2 | HEIC handled, decision documented | `photos.md` "Decisions → HEIC": iOS hands HEIC to `accept="image/*"` as `image/jpeg`; server's `sharp` has no HEIC decoder → `unsupported-format`; unreadable-photo message documented | Manual device test + code (`accept-photo.ts:23-25`); no automated test exercises an actual HEIC byte stream (see Edge cases) | Yes, with a note |
| 3 | Rotated by EXIF orientation before metadata is stripped | `accept-photo.ts:33` (`.rotate()` before `.jpeg()`); browser `prepare-photo.ts:29` (`createImageBitmap(..., { imageOrientation: "from-image" })`) | `accept-photo.test.ts` "re-encodes as JPEG, rotated by its EXIF orientation, without any metadata" – asserts pixel dimensions swapped (200×400 from a 400×200 source with orientation 6) and no orientation tag; browser half only testable on a real phone (documented) | Yes |
| 4 | Browser downscales before upload; target decided (≤2048 px, JPEG/WebP, ≤1 MB) and documented | `limits.ts`, `prepare-photo.ts`; `photos.md` "Limits" table | `prepare-photo.test.ts` (`scaledSize` unit tests, `PhotoTooLargeError` for >20 MB) plus device measurement (633 KB / 463 KB prepared sizes, both ≤1 MB) – canvas encoding itself is not unit-testable (documented) | Yes |
| 5 | Server re-encodes every photo within limits and strips EXIF; a stored photo inspected has no GPS | `accept-photo.ts` | `accept-photo.test.ts` (no EXIF/GPS/ICC/XMP/orientation after re-encoding) plus manual inspection of 6 downloaded preview photos with `sharp` (task) | Yes |
| 6 | Server rejects non-images and oversize; limit documented as a number and used by ST-016/032/054 | `limits.ts` (`maxUploadBytes = 2_000_000`), `accept-photo.ts` | `accept-photo.test.ts` ("not-an-image", "unsupported-format", "too-large" cases); ST-016 restates the same 20 MB / 2048 px / 1 MB numbers verbatim | Yes, with a note (see Edge cases – the 20 MB vs. 2 MB messaging gap) |
| 7 | Photos only accessible to logged-in team members (stub login); addresses unguessable/unlistable | `store-photo.ts` (private access, presigned 5-minute URLs), `src/app/spike/photos/page.tsx` (gated by `hasSpikeAccess`), `src/spike/access.ts` | Manual check reported in task: signed address 200, unsigned 403; `photos.md` states "unsigned address → 403" | Yes |
| 8 | Downscaled photo uploads in <5 s on a phone over Wi-Fi (≥1 phone) | `photos.md` "Measured" table | Measured on 2 phones: 1.8 s (iPhone), 2.1 s (Android) | Yes |
| 9 | Reusable building block, documented for ST-016/032/054 | `docs/architecture/photos.md` (flow diagram, table of parts, "Notes for the stories that use it") | `src/photo/{prepare-photo,accept-photo,store-photo,limits}.ts` have no dependency on the spike UI or a specific aggregate; the demo consumer is `src/app/spike/photos/*` only | Yes |

## Definition of done (`ST-059`)

| Item | Applies to ST-002 | Evidence | OK? |
|---|---|---|---|
| Phone-first layout, usable at 360 px | Only for the throwaway `/spike/photos` demo page, not a product page | Simple flex/stack layout (`page.tsx`, `photo-picker.tsx`); not pixel-checked at 360 px, but low risk (single column, no fixed widths) | Acceptable for a spike |
| List pages respond <1 s with realistic data | No – the spike page lists a handful of test blobs, not a product list page | – | N/A |
| Every command writes its journal entry | No – ST-002 has no command/aggregate of its own; `acceptPhoto`/`storePhoto` are called by future commands (ST-016/032/054), which own the journal entry | `photos.md` "the caller authorizes... never here" | N/A, correctly deferred |
| German team UI texts from the message catalog; visitor pages from catalogs | No – message catalogs don't exist yet (deferred to later stories per the ST-001 review); the spike page has hard-coded German strings by design, as a throwaway demo | `photo-picker.tsx:9-15` | Acceptable, consistent with the ST-001 precedent |
| No personal data in logs | Yes – any code path that could log | No `console.*`/logging calls in `src/photo/*`, `src/app/spike/photos/*`, `src/spike/access.ts`; errors are typed result objects, not exceptions with photo bytes | Yes |
| Critical security advisories patched within 48 h | Not this story's concern (ST-063) | – | N/A |

## Consistency with ST-016, ST-032, ST-054

- ST-016 restates the ST-002 numbers verbatim ("photos up to 20 MB are accepted; ... downscaled to a longest edge of 2048 px and at most 1 MB") – matches `PHOTO_LIMITS` exactly. ST-016's scenario "Photo above the size limit is rejected" expects "the maximum size of 20 MB shown" – this is the **browser-side** check (`preparePhoto` → `PhotoTooLargeError`, `maxOriginalBytes`), not the server-side 2 MB guard; consistent, but see the messaging gap under Edge cases.
- ST-032 and ST-054 don't restate numbers, just reference "photo handling from spike ST-002" generically – consistent, no contradiction; they will need `PHOTO_LIMITS`/`preparePhoto`/`acceptPhoto`/`storePhoto` to be importable, which they are (no dependency on a specific aggregate or the spike UI).
- All three building-block modules (`prepare-photo.ts`, `accept-photo.ts`, `store-photo.ts`, `limits.ts`) are free of spike-only concerns (no `hasSpikeAccess`, no "spike-photos" prefix hard-coded) – genuinely reusable, matching the "documented for ST-016/032/054" claim.

## Edge cases not covered by the story

| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| A client that bypasses the browser step (no JS, or a direct POST) sends a 5–20 MB original straight to the server. `acceptPhoto` rejects it as generic `"too-large"` at 2 MB, not with the "20 MB" message ST-016's scenario expects | Not contradicted by ST-002 (documented: "only for clients that skip the browser step" / "Shown to people: –") but ST-016 will need to decide what the visitor sees in this case | Question for ST-016: confirm the intended message when the 2 MB server guard (not the 20 MB browser check) fires |
| No automated test sends an actual HEIC byte stream through `acceptPhoto`; the doc's specific claim ("sharp... rejects HEIC as `unsupported-format`", as opposed to `not-an-image` if libvips can't even sniff the container) is asserted, not verified by `accept-photo.test.ts` | Not a contradiction – functionally both outcomes reject the photo | Recommendation: add a HEIC fixture to `accept-photo.test.ts` if one can be generated without a new dependency, or soften the doc's wording to "rejected (as `unsupported-format` or `not-an-image`)" |
| `src/app/spike/photos/*` (the new demo page/action/component from this story) is not listed in ST-066's removal checklist, which predates it (ST-066 lists only `src/spike/*`, `src/app/spike/files/*`, `src/app/api/spike/upload/route.ts`) – it depends on `src/spike/access.ts`, which ST-066 does remove, so it would break silently once ST-066 lands unless also removed, and `src/app/page.tsx`'s new "Fotos (Spike)" link is likewise not mentioned | Same rule ST-001's code review (#18) already applied to the older spike pages | New story / update ST-066: add `src/app/spike/photos/*` and the `page.tsx` link to its checklist before it is implemented |
| Concurrent uploads of many large photos (e.g. several visitors at once) – no load test, only single-request timing | Not required by ST-002 (timebox 2 days, single-phone measurement was the acceptance bar) | Question, not a defect – fine to defer; ST-014 (rate limiting) and production monitoring are the natural place |
| Only JPEG/PNG/WebP source images were used to build the "downscales" and "compresses badly" tests; no test with a still-oversized image after all four quality steps and three edge-shrink rounds (i.e. the loop never returning in `preparePhoto`/`acceptPhoto` for pathological input) | Not contradicted; `acceptPhoto`'s loop has no explicit bound (infinite `for(;;)`) while `preparePhoto`'s loop gives up after 3 rounds and throws `PhotoNotReadableError` | Worth a note for later hardening (a truly adversarial image that never compresses below 1 MB would loop the server indefinitely), not blocking for a 2-day spike |
| The 5-minute presigned photo address and page-level gating were exercised only through the generic `hasSpikeAccess` stub, not through the actual "visitor cannot see, team member can" distinction (HS-1) that ST-016 specifically owns | Explicitly out of scope – ST-016 owns "Only team members can see the photo" | No action needed now; flagged only so ST-016's reviewer knows ST-002 doesn't cover this scenario |

## Verdict

**accepted with remarks.**

All nine checklist items have solid evidence: automated tests pass (`npm test`, `accept-photo.test.ts`, `prepare-photo.test.ts`), `verify.ts` passes cleanly, and the documented manual verification (two real phones, 6 downloaded/inspected photos, signed-vs-unsigned address check) matches what's written in `docs/architecture/photos.md`. The resulting building block (`src/photo/*`) is clean of spike-only concerns and is genuinely reusable by ST-016, ST-032 and ST-054, whose numeric limits already agree with `PHOTO_LIMITS`.

The remarks (none block the spike's own timebox/goal, but should be picked up soon):
1. Update ST-066's checklist to also remove `src/app/spike/photos/*` and the new link in `src/app/page.tsx` – it currently only lists the older spike pages and will silently break once `src/spike/access.ts` is deleted.
2. ST-016 needs an explicit answer for what a visitor sees if the 2 MB server-side guard (not the 20 MB browser check) rejects an upload.
3. Minor: add (or plan to add) a real HEIC fixture to `accept-photo.test.ts` to verify the documented `unsupported-format` outcome rather than assert it from manual reasoning.
