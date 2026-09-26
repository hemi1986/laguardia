---
id: ST-002
title: Take photos with a phone camera and upload them safely
type: spike
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-ProblemReported, EVT-WorkLogged, EVT-FileAttached]
depends_on: [ST-001]
labels: [mvp, foundation]
status: review
---

## Question
How do visitors and team members take a photo with their phone camera in the browser and attach it to a problem report, a work log entry or (as a file with the file category *Photo*) to a machine – downscaled, without EXIF metadata (especially GPS location), within size and image format limits, stored in the EU object storage from ST-001 and shown quickly on a phone?

Background: server actions have a small default request body limit (1 MB) while phone photos are several MB; visitor photos may show people and are personal data (`docs/adr/0001-tech-stack.md`, `docs/adr/0005-hosting-vercel.md`).

## Timebox
1 day (proposal – lead-dev confirms).

## Acceptance Criteria
- [ ] Taking a new photo with the camera and choosing an existing photo both work in current iOS Safari and current Android Chrome.
- [ ] iPhone HEIC photos are handled (converted or rejected with a clear message) – decision documented.
- [ ] Photos are downscaled in the browser before they are uploaded; the target is decided and documented (proposal: long edge at most 2048 px, JPEG or WebP, at most 1 MB).
- [ ] The server re-encodes every received photo and removes all EXIF metadata; a stored photo is inspected and contains no GPS location.
- [ ] The server rejects content that is not an image and photos above the decided maximum size; the limit is documented as a number.
- [ ] Photos of problem reports and work log entries are only accessible to logged-in team members – their storage addresses cannot be guessed or listed by visitors.
- [ ] A downscaled photo uploads in under 5 seconds on a phone over normal Wi-Fi (measured on at least one phone).
- [ ] The result is a reusable building block for taking and uploading photos plus server-side check, documented for ST-016 (problem reports), ST-032 (work log entries) and ST-037 (files).

## Out of Scope
- Uploading large PDF files (ST-001)
- Spam protection beyond image checks (ST-014)

## Open Questions
- none
