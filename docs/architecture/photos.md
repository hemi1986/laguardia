# Photos – building block from spike ST-002

How La Guardia takes, checks and stores photos. Used by the photo on a problem report (ST-016), photos on a work log entry (ST-032) and a camera photo as a file with the file category *Photo* (ST-054). Photos of problem reports and work log entries are not files (`CONTEXT.md`); they belong to that report or entry.

## Flow

```
phone camera / gallery ──► preparePhoto (browser) ──► server action ──► withStoredPhoto: acceptPhoto ──► storage seam ──► private Blob (fra1)
                                                       (photoFormAction)                 └─► command ──► delete the photo if it fails
                           upright, ≤ 2048 px,          authorization     ≤ 2 MB in,       unguessable
                           JPEG ≤ 1 MB, no EXIF         in the command    re-encoded,      name; shown via
                                                                          no metadata      5-minute links
```

Unlike large PDF files (ST-001, direct browser upload), **photos go through the server**, so every photo is checked and re-encoded by La Guardia before it is stored.

| Part | Where | What it does |
|---|---|---|
| `preparePhoto(file)` | `src/photo/prepare-photo.ts` (browser) | Rejects originals above 20 MB (`PhotoTooLargeError`). Decodes the photo **upright** (the browser applies the EXIF orientation: `createImageBitmap(…, { imageOrientation: "from-image" })`, fallback `<img>`), draws it onto a canvas with the long edge ≤ 2048 px and encodes JPEG on a white background (for transparent images), lowering quality (0.85 → 0.5) and then size until ≤ 1 MB. A canvas carries no metadata, so EXIF (incl. GPS) never leaves the phone. Throws `PhotoNotReadableError` if the browser cannot decode the file, `PhotoTooLargeError` if the original is above 20 MB or cannot be brought under 1 MB. |
| `acceptPhoto(bytes)` | `src/photo/accept-photo.ts` (server, `sharp`) | Rejects more than 2 MB or more than 25 megapixels (`too-large`, both checked before decoding; sharp's `limitInputPixels` enforces the pixel limit again), anything that is not an image or is corrupt (`not-an-image` – never throws for bad input) and formats other than JPEG, PNG, WebP (`unsupported-format`, e.g. HEIC, AVIF, GIF). Rotates by the EXIF orientation **before** anything else, downscales to ≤ 2048 px, puts transparent areas on white, decodes once per size step and re-encodes as JPEG (mozjpeg, quality 82 → 50; at most 4 size steps) until ≤ 1 MB. sharp writes **no metadata** (no EXIF/GPS, no XMP, no ICC, no orientation tag). |
| `withStoredPhoto(upload, owner, { storage, newId }, run)` | `src/photo/store-photo.ts` (server, ST-016) | The **one way to store a photo**: accepts the upload, stores it as `<owner>/<id>.jpg` (ID from the injected generator), runs the command with that reference and **deletes the photo if the command is rejected or throws** (ADR 0007). Without an upload the command runs without a photo. Authorization stays in the command – a `not-authorized` command leaves nothing either. Errors: `too-large`, `not-an-image`, `unsupported-format`, `not-stored` (`photoErrors`). |
| `photoViewAddresses(storage, clock, photos)` | `src/photo/store-photo.ts` (server, ST-016) | Addresses valid for 5 minutes from the injected clock's time – only issued after the page's access check (team pages, HS-1). |
| `photoFormAction` | `src/app/_actions/form-action.ts` (ST-016) | The Server Action runner for a form with a photo: the same runner (ST-073), the command run through `withStoredPhoto`. |
| `PhotoField` | `src/app/photo-field.tsx` (browser, ST-016) | The form's photo: two pickers without a name ("Foto aufnehmen" with `capture`, "Foto auswählen"), `preparePhoto`, then the prepared JPEG goes into the form's file field (`DataTransfer`) – the form still posts natively. |
| Storage seam | `src/platform/storage/` (ST-016) | `ContentStorage`: write, delete, view address. `blobStorage()` (the only importer of `@vercel/blob`, lint) and `memoryStorage()` for integration tests – injected like the clock. |

**Public interface:** `src/photo/index.ts` (server) and `src/photo/browser.ts` (client components); lint refuses any other import of the module.
| Limits | `src/photo/limits.ts` (`PHOTO_LIMITS`) | The numbers below, used by both halves. |

## Limits (decided in ST-002)

| Limit | Value | Checked by | Shown to people |
|---|---|---|---|
| Original photo | **at most 20 MB** | browser | yes – "Das Foto ist größer als 20 MB." (confirms ST-016's user decision) |
| Stored photo | long edge **at most 2048 px**, **at most 1 MB**, JPEG | browser and server | – |
| Upload to the server | at most **2 MB** and **25 megapixels** (technical guards; normal uploads are ≤ 1 MB and ≤ 2048 × 2048) | server | only for clients that skip the browser step |
| Server action body | 3 MB (`next.config.ts`, room for multipart overhead) | Next.js | – |
| Accepted formats | JPEG, PNG, WebP (after the browser step: always JPEG) | server | "Dieses Bildformat wird nicht unterstützt" |

## Decisions

- **HEIC (iPhone):** converted, never stored. iOS Safari hands a HEIC photo to a page with `accept="image/*"` as JPEG (measured: "Original: image/jpeg" for camera and gallery photos); Safari can also decode HEIC on a canvas. The server's `sharp` has no HEIC (HEVC) decoder, so a HEIC file is rejected – as `unsupported-format` (tested with AVIF, the same HEIF container) or as `not-an-image`; a real HEIC fixture cannot be generated with sharp; a browser that cannot decode a photo shows "Dieses Foto kann der Browser nicht lesen (z. B. HEIC). Bitte als JPEG aufnehmen."
- **Two inputs:** "Foto aufnehmen" (`accept="image/*" capture="environment"` – opens the camera directly) and "Foto auswählen" (`accept="image/*"` – camera or gallery). Both work in iOS Safari and Android Chrome.
- **Rotation before stripping:** both halves rotate by the EXIF orientation first; the stored JPEG has the pixels upright and no orientation tag.
- **Access:** photos are in the private store under random UUID names; there is no public listing; reading needs a signature (unsigned address → 403). Team-only visibility is enforced by the page/command that issues the 5-minute addresses (stub login in the spike, team login from ST-004).

## Measured (spike, 2026-09-27, preview deployment in fra1)

| Phone | Original | Prepared in browser | Stored | Upload (server share) | Total |
|---|---|---|---|---|---|
| iPhone, Safari | JPEG 1,695 KB | 633 KB in 111 ms | 2048×1536, 234 KB | 1,683 ms (1,361 ms) | **1.8 s** |
| Android, Chrome | JPEG 394 KB (1600×1200) | 463 KB in 184 ms | 1600×1200, 413 KB | 1,955 ms (1,614 ms) | **2.1 s** |

Portrait and landscape photos from camera and gallery were stored upright on both phones. All six stored photos were downloaded and inspected: JPEG, ≤ 2048 px, no EXIF, no GPS, no XMP, no ICC profile, no orientation tag. Most of the time is the server's Blob write (cold start included); well within the 5-second target.

## Notes for the stories that use it

- **JavaScript is required** for taking photos: the browser half runs in a client component. Without JavaScript a form would send the original (up to 20 MB), which the server action refuses (3 MB body limit, 2 MB check).
- **Order of storing (ST-016, ADR 0007):** store → run the command → delete the photo if the command is rejected or throws – all inside `withStoredPhoto`; no caller sequences it by hand, and there is no cleanup job. The only possible leftover is a photo written just before a server crash: unreferenced, private, unreachable without a signed address.

- The form sends the **prepared** blob (`preparePhoto`), never the original file; its Server Action uses `photoFormAction`, which stores the photo, runs the command with the reference and keeps the reference with the problem report (ST-016) / work log entry (ST-032) / file (ST-054).
- **Local development and browser tests** store photos in a separate Development Blob store (`BLOB_READ_WRITE_TOKEN` in `.env.development.local`, user 2026-10-04); without it the photo browser tests skip. Integration tests use `memoryStorage()` and never reach Blob.
- Visitor photos (ST-016) are uploaded without login, so the visitor page's command must apply its own limits (ST-014 rate limits); the building block itself does not authorize.
- A small original can get slightly larger after re-encoding (measured: 394 KB → 413 KB) – harmless, still within the limits.
- `acceptPhoto` is tested with generated images (EXIF orientation 6 + GPS, badly compressible noise, GIF, PDF bytes) in `src/photo/accept-photo.test.ts`; the canvas half can only be checked on real phones.
