---
status: accepted
date: 2026-10-31
---

# 0012 – S3-compatible object storage everywhere: AWS S3 in Frankfurt for previews and production, SeaweedFS in Docker locally

Supersedes the object-storage part of `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md` once accepted (ADR 0006 is accepted and cannot be edited). Everything else ADR 0006 decided holds: Vercel Pro in `fra1`, Neon PostgreSQL in Frankfurt, Better Auth. ADR 0009 (pending uploads, store → command → delete on failure, cleanup after a later request) holds unchanged; only the store behind the storage seam changes.

## Context and Problem
Photos and files live in a private Vercel Blob store (ADR 0006). The `@vercel/blob` SDK does not speak S3, so a local S3 container was ruled out on 2026-09-27: it would have needed a second adapter and a second browser upload path, and local development would have tested something else than production. Local development and the local browser tests therefore used a Development Blob store on the Hobby plan. On 2026-10-28 that store reached its usage limit until 2026-11-27, and since then every local upload has failed (18 browser tests). The user wants to run the whole application locally in Docker – PostgreSQL and SeaweedFS – without a Vercel account or a cloud store (user, `/feature` 2026-10-31).

## Driving Requirements
- Minimal operating effort, one volunteer maintainer – `docs/product/vision.md` (Constraints)
- Visitor photos may show people → EU storage and a GDPR data processing agreement – `docs/adr/0005-hosting-vercel.md`, `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`
- Files up to 100 MB, uploaded from the browser straight to the store, never through a function (4.5 MB body limit) – `docs/stories/OPEN_QUESTIONS.md` (ST-037), ADR 0009
- Private content, shown only through short-lived signed addresses after the server's own access check – ADR 0006, ADR 0009
- Local behaviour equal to production (the reason of the 2026-09-27 decision) – user, 2026-09-27

## Considered Options
1. **S3 everywhere**: one S3 adapter; SeaweedFS locally, an EU S3 provider for previews and production; the application stays on Vercel – chosen.
2. **S3 locally, Vercel Blob in production**: two adapters and two browser upload paths; local tests something else than production – rejected (the 2026-09-27 reason).
3. **Self-host everything in Docker, production included**: no Vercel, no Neon; backups, updates and uptime become the volunteer's job – rejected against "minimal operating effort".

Provider for previews and production:
- **AWS S3, `eu-central-1` (Frankfurt)** – chosen: Vercel's OIDC federation to an IAM role, so no long-lived key exists (as with Blob's OIDC today); the GDPR DPA is part of the AWS Service Terms; a few cents per month at ~6 GB.
- **Hetzner Object Storage, Scaleway** – rejected: static access keys as secrets, and a monthly minimum fee (Hetzner ~€6).

## Decision
- **One S3 adapter behind the storage seam** (`src/platform/storage/`, ADR 0007/0009) replaces the Vercel Blob adapter; the in-memory adapter for integration tests stays. `@vercel/blob` leaves the project. The adapter is configured only from the environment (endpoint, region, bucket, credentials) and is the only file that may import the S3 SDK.
- **Buckets per environment:** one for production, one shared by all previews (ADR 0006 already recommended a store of its own for previews), and locally `laguardia-dev` for the dev server and `laguardia-e2e` for the local browser tests, which empty it at the start of a run as today. All buckets are private; public access is blocked; CORS allows only the application's origin – exactly the production origin for production, and one pattern `https://<project>-*-<team>.vercel.app` for the shared preview bucket, because every preview has its own address (user, story review 2026-10-31). Addresses use the regional endpoint (`s3.eu-central-1.amazonaws.com`): the global one can redirect requests to a new bucket, which breaks the browser's CORS preflight.
- **Credentials:** on Vercel the functions assume an IAM role through Vercel's OIDC token – the role may only read, write and delete objects in its environment's bucket. Locally SeaweedFS gets fixed development credentials in `docker-compose.yml`, which mean nothing outside this machine.
- **Browser upload: one presigned PUT** for exactly the name the server chose, valid for 30 minutes. No upload in parts: the exhibition has good Wi-Fi everywhere (`docs/product/vision.md`), and parts would need a server-signed address per part. The browser declares the file's size when it asks for the upload address; the server refuses a size above the caller's limit (100 MB for files) before it records a pending upload or signs, and the signature binds that exact `Content-Length` and the `Content-Type` – a plain presigned PUT has no size range (user, story review 2026-10-31). Where the store accepts it, `If-None-Match: *` is signed too, so a name is written once (Blob's `allowOverwrite: false`). Attaching still checks the stored size through `details()` (ADR 0009, ST-085).
- **Viewing and downloading:** presigned GET addresses valid for 5 minutes, signed on the server without a request to the store; a download asks the store to send the content as an attachment.
- **Local operation:** `docker compose up` starts PostgreSQL and SeaweedFS; a one-off init step creates the two local buckets with their CORS rule. Local development and the local browser tests need no Vercel login and no cloud store.
- **The content security policy** allows exactly the host of the deployment's bucket for images, uploads and downloads – no wildcard.

## Consequences
- Positive: local behaviour equals production again, through one adapter; the 18 local upload browser tests run against SeaweedFS instead of a quota-limited cloud store; Hobby usage limits no longer touch development.
- Negative / cost: an AWS account next to Vercel and Neon, with its own DPA (AWS Service Terms) to confirm before real visitor data is stored; the buckets and the IAM role are set up once by hand, following `docs/operations/`. SeaweedFS is not AWS: a difference in presigned addresses or CORS shows up only in the preview's browser tests.
- An address signed with temporary OIDC credentials stops working when those credentials expire, whatever its own validity says – the role's session must outlast the 30-minute upload address (checked in ST-099).
- CI starts the repository's `docker-compose.yml` (PostgreSQL and SeaweedFS), so the S3 adapter's tests run against SeaweedFS on every pull request (user, story review 2026-10-31).
- One PUT for up to 100 MB has no resumption: a dropped connection restarts the upload. Accepted for good Wi-Fi; revisit with parts if it becomes a problem.
- No migration: La Guardia is not live; the existing Blob content and the references to it are test data and are discarded. The old Vercel Blob stores are deleted by hand after the switch.
- Blob's "no restore" (ADR 0006) holds for the S3 buckets too, unless versioning is turned on – deletion stays deliberate (ADR 0007/0009). Backups of the buckets belong to the go-live planning.
- Follow-up: ST-099 builds the S3 adapter, the browser upload, the CSP, the local Docker setup, the operations guide and removes `@vercel/blob`.
