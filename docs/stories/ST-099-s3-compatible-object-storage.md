---
id: ST-099
title: S3-compatible object storage everywhere
type: tech-task
context: BC-Collection
priority: must
size: L
risk: high
events: []
depends_on: [ST-085]
labels: [files, foundation, feature:s3-object-storage]
status: done
---

## Task
Builds what `docs/adr/0012-s3-compatible-object-storage.md` decides (`proposed`, `/feature` session with the user,
2026-10-31): photos and files move from the private Vercel Blob store to S3-compatible object storage – SeaweedFS in
Docker locally, AWS S3 in `eu-central-1` (Frankfurt) for previews and production. Trigger: the Development Blob store
reached its Hobby usage limit on 2026-10-28, and since then every local browser upload fails (18 browser tests). The
application stays on Vercel; ADR 0006 holds except for the store, ADR 0009 holds unchanged. Revised after the story
review `docs/reviews/2026-10-31-story-review.md`; the three open questions were answered by the user on 2026-10-31.

**0. First step: a SeaweedFS probe.** Before building the rest, run the adapter's test file against SeaweedFS for the
signed `Content-Length`, `response-content-disposition`, expiry, the CORS preflight and `If-None-Match: *`, and note
every difference from AWS. SeaweedFS runs with S3 identities configured, so unsigned and wrongly signed requests are
refused. Anything SeaweedFS handles differently from AWS is verified on the preview instead and recorded in the pull
request – never skipped silently.

**1. One S3 adapter behind the storage seam.** It replaces the Vercel Blob adapter behind `ContentStorage`
(`src/platform/storage/`) with the same operations – `write`, `delete`, `viewAddresses`, `uploadAddress`, `details` –
but not the same interface: `uploadAddress` additionally takes the declared size of the content, and the address it
returns changes shape (today it is Blob's `presignedUrlPayload`; now a presigned PUT address with the headers the
browser must send). The upload-address route (`/api/uploads`) takes the declared size in its request, and the pending
upload records it. The in-memory adapter for integration tests stays. `@vercel/blob` leaves the project. The S3 adapter
is the only file that may import the S3 SDK packages (`@aws-sdk/*`; a lint rule, as today for `@vercel/blob`), the
browser half imports no SDK, and the adapter is configured only from environment variables: endpoint, region, bucket,
credentials. On AWS it uses the regional endpoint (`s3.eu-central-1.amazonaws.com`), never the global one. The same
adapter that builds the addresses also derives the store host for the content security policy – addressing style
(path-style locally, virtual-hosted on AWS), the local port and `http` included – so no second setting can drift.

**2. Browser upload: one presigned PUT, held to the size limit by its signature** (user, 2026-10-31). The browser
declares `file.size` when it asks for the upload address. The route, after its own access check as today (ST-085),
refuses a declared size above the caller's size limit (100 MB for files, `FILE_SIZE_LIMIT`; the browser tests ask for a
stricter one) **before** it records a pending upload and before it signs; the browser then reports `too-large`.
Otherwise the server issues one presigned PUT for exactly the name it chose, valid for 30 minutes, whose signature binds
the exact `Content-Length` and the `Content-Type`. Where SeaweedFS accepts it, the signature also binds
`If-None-Match: *`, so a name is written once (as Blob's `allowOverwrite: false` did); otherwise the remaining
30-minute window in which the address could replace its own content is noted in the `/security-review`. No upload in
parts. ADR 0009 is unchanged: the pending upload is recorded when the name is given, abandoned ones are cleaned up after
a later request, and attaching keeps the final check of the stored size and media type through `details()`. Signing
without a length, relying on the attaching check alone, is rejected (user, 2026-10-31).

The browser half (`uploadFile`, `src/upload/upload-file.ts`) changes its transport to one with upload progress (e.g.
`XMLHttpRequest`; `fetch` reports none). It keeps its behaviour: progress in percent, resolves with the content's name,
reports `too-large` or `not-uploaded` to the form, which shows the texts it shows today. `too-large` comes only from the
route refusing the declared size or from the early `file.size` check – never from the store's answer, which a browser
cannot tell apart from any other refusal; the Blob message sniffing (`refusedAsTooLarge`) goes.

**3. Viewing and downloading.** Presigned GET addresses valid for 5 minutes, signed on the server after the page's
access check. A download asks the store to send the content to be saved, not opened (`response-content-disposition:
attachment`), for everything `opensInBrowser` does not open (ST-037); an address to view inline carries no such
disposition. The expiry is tested with an injectable signing date in the adapter, not by sleeping.

**4. Content security policy.** `img-src` and `connect-src` allow exactly the host of the deployment's bucket, as they
do today for the Blob store – no wildcard. The host comes from the adapter (item 1). The Blob store's host and Blob's
upload API leave the policy.

**5. Local operation without a cloud store.** `npm run db:up` (`docker-compose.yml`) starts PostgreSQL and SeaweedFS
(pinned image tag); a one-off init step creates the buckets `laguardia-dev` (dev server) and `laguardia-e2e` (local
browser tests), each with a CORS rule for its local origin, and fails loudly if it cannot. SeaweedFS gets one fixed
development identity in `docker-compose.yml`, which means nothing outside this machine. Local development and the
local browser tests need no Vercel login and no cloud store. `scripts/e2e-server.ts` deletes the previous run's uploads
by their recorded names through the storage seam at the start of a run, as it does today with the Blob store – the seam
gets no list operation. The 18 local browser tests with uploads (`attach-file`, `attach-photo`, `file-upload`,
`log-work-photos`, `remove-file`, `report-photo`) run against SeaweedFS and no longer skip for a missing S3 environment.

**6. CI runs the adapter tests against SeaweedFS** (user, 2026-10-31). `.github/workflows/ci.yml` starts the
repository's `docker-compose.yml` (PostgreSQL and SeaweedFS, with the bucket init step), waits for both to be healthy
and sets the S3 environment variables for the test step. The SeaweedFS adapter tests always run in CI and never skip;
locally they need `npm run db:up` like the database tests and fail with a clear message when the store is unreachable.

**7. Previews and production on AWS S3 `eu-central-1`.** One bucket for production, one shared by all previews. Both
private, public access blocked. CORS (user, 2026-10-31): the production bucket allows exactly the production origin;
the shared preview bucket allows one origin pattern `https://<project>-*-<team>.vercel.app`, which covers the
per-deployment and the branch addresses. The content security policy is not affected – it names the bucket's fixed
host. The functions assume an IAM role through Vercel's OIDC federation – no long-lived access key exists; each role
may only read, write and delete objects in its own environment's bucket. **The user sets AWS up once by hand**; this
task writes the guide for it in `docs/operations/` and points to it from `README.md` and `.env.example`. The guide names
the project and team in the preview pattern and includes a preflight check from a preview. The agent never creates
cloud resources and never stores tokens or keys in a file.

**8. No data migration.** La Guardia is not live; the existing Blob content and the references to it are test data and
are discarded.

**9. Documentation.** `.env.example`, `README.md`, `docs/architecture/photos.md` and the storage parts of
`.claude/skills/engineering-conventions/SKILL.md` (the storage seam, files uploaded from the browser – including the
"Blob holds only an upload in one piece to the size limit" paragraph –, the local setup, the content security policy
and the seam catalog row for code that stores content; the user approves the conventions) say S3 instead of Blob.
ADR 0012 is the decision; this task edits no ADR.

## Acceptance Criteria

### Scenarios
Tested at the seams: the S3 adapter against SeaweedFS (integration tests, always run in CI), the upload-address route
as an integration test, the content security policy as a unit. Where the probe (Task item 0) shows that SeaweedFS
does not enforce what a scenario asserts, that scenario is verified on the preview against AWS and recorded in the pull
request, not skipped silently.

Scenario: Stored content is described and removed through the S3 adapter
  Given the S3 adapter is configured for a bucket on SeaweedFS
  When content of 1234 bytes with media type "application/pdf" is written under a name
  Then details of that name give 1234 bytes and "application/pdf"
  And after the name is deleted, details of that name give nothing

Scenario: A browser upload stores the content under the name the server chose
  Given an upload address for a name, valid for 30 minutes, declared for 500 KB of "image/jpeg"
  When those 500 KB are sent with that address
  Then details of that name give 500 KB and "image/jpeg"

Scenario: An upload address does not store content under another name
  Given an upload address for one name
  When content is sent with that address to another name
  Then the store refuses it
  And details of the other name give nothing

Scenario: An expired upload address stores nothing
  Given an upload address for a name, signed with a signing date more than 30 minutes ago
  When content is sent with that address
  Then the store refuses it
  And details of that name give nothing

Scenario: A declared size above the limit gets no upload address
  Given the size limit is 1 MB
  When a team member's browser asks for an upload address declaring 2 MB
  Then the request is refused
  And the browser upload reports "too-large"
  And no pending upload exists for it

Scenario: Content longer than the declared size is refused by the store
  Given an upload address signed for 500 KB
  When 2 MB of content is sent with that address
  Then the store refuses it
  And details of that name give nothing

Scenario: Stored content is not delivered without a signed address
  Given content stored under a name
  When it is requested at its plain store address
  Then the store refuses to deliver it

Scenario: A view address delivers the content until it expires
  Given content stored under a name
  When a view address for it is issued with a validity of 5 minutes
  Then the address delivers the content
  And the same address signed with a signing date more than 5 minutes ago delivers nothing

Scenario: A download address sends the content to be saved, a view address to be opened
  Given a ZIP archive and a PDF stored under two names
  When a view address is issued for the ZIP archive as a download and for the PDF to be opened
  Then the store sends the ZIP archive with `Content-Disposition: attachment`
  And the store sends the PDF without an attachment disposition

Scenario: The content security policy names exactly the bucket's host
  Given the deployment's bucket is configured with its endpoint
  When a page's content security policy is built
  Then `img-src` and `connect-src` name the store host the S3 adapter derives for that bucket and no other store host
  And neither contains a wildcard host or a Vercel Blob address

### Checklist
- [x] SeaweedFS probe done first (Task item 0); every difference from AWS (signed `Content-Length`,
      `response-content-disposition`, CORS preflight, `If-None-Match: *`) is recorded in the pull request with where it
      is verified instead.
- [x] `ContentStorage` has one S3 adapter for previews, production and local development; the in-memory adapter stays
      for integration tests; `@vercel/blob` is no longer a dependency and no file imports it.
- [x] `uploadAddress`, the upload-address route's request and the pending upload carry the declared size; the returned
      address shape is the presigned PUT address with the headers to send.
- [x] The lint rule in `eslint.config.mjs` moves from `@vercel/blob` to the S3 SDK packages (`@aws-sdk/*`): only the S3
      adapter imports them, the browser half imports no SDK. The adapter reads endpoint, region, bucket and
      credentials only from environment variables and uses the regional AWS endpoint.
- [x] The store host in the content security policy is derived by the S3 adapter (addressing style, local port and
      `http` included), not from a separate setting.
- [x] `uploadFile` uploads with one presigned PUT, valid for 30 minutes, without parts, through a transport with upload
      progress; `too-large` comes only from the route's refusal or the early `file.size` check; the Blob message
      sniffing is gone; the form texts are unchanged. The existing browser test for the upload form shows progress up
      to 100 percent.
- [x] The signature binds `Content-Length` and `Content-Type`, and `If-None-Match: *` where SeaweedFS accepts it;
      otherwise the remaining 30-minute overwrite window is noted in the `/security-review`.
- [x] The adapter's expiry tests use an injectable signing date, not sleeping.
- [x] `docker-compose.yml` starts PostgreSQL and SeaweedFS (pinned image tag) with `npm run db:up`; a one-off init step
      creates `laguardia-dev` and `laguardia-e2e` with their CORS rules and fails loudly if it cannot.
- [x] SeaweedFS runs with one fixed development S3 identity in `docker-compose.yml`, so unsigned, wrongly signed and
      expired requests are refused.
- [x] `scripts/e2e-server.ts` deletes the previous run's uploads by their recorded names through the storage seam at
      the start of every local run (no list operation on the seam).
- [x] On a machine where only `npm run db:up` was run, with no Vercel login and no Blob token, the 18 local browser
      tests with uploads pass against SeaweedFS and none of them is skipped for a missing store.
- [x] `.github/workflows/ci.yml` starts the repository's `docker-compose.yml` with the init step, waits for health and
      sets the S3 environment variables; the SeaweedFS adapter tests run there and never skip; locally they fail with
      a clear message when the store is unreachable.
- [x] The guide in `docs/operations/` walks the user through the one-time AWS setup: the two buckets in `eu-central-1`
      (private, public access blocked; CORS exactly the production origin for production, the pattern
      `https://<project>-*-<team>.vercel.app` with project and team named for previews), the Vercel OIDC identity
      provider, one IAM role per environment limited to its bucket, the environment variables to set on Vercel, and a
      preflight check from a preview. `README.md` and `.env.example` point to it.
- [x] `.env.example`, `README.md`, `docs/architecture/photos.md` and the storage parts of
      `.claude/skills/engineering-conventions/SKILL.md` (incl. the seam catalog row) describe S3 instead of Blob; the
      user approves the conventions change.
- [x] `/security-review` has run on the diff (it touches uploads, signed addresses and the security headers) and its
      findings are fixed or answered in the pull request.
- [x] The browser tests run against the preview, with the preview bucket on AWS S3, and pass – including the upload
      tests and no request blocked by the content security policy (recorded in the pull request).

## Out of Scope
- Upload in parts or resumable browser uploads (ADR 0012: one PUT, accepted for good Wi-Fi)
- A presigned POST policy (`content-length-range`) – only a fallback if the signed length fails on the preview, then a
  question to the user
- Bucket backups and versioning – go-live planning (ADR 0012)
- Self-hosting production (ADR 0012, option 3 rejected)
- Any change to a screen or a UI text – the error texts stay as they are (user, 2026-10-31)
- Migrating existing Blob content – it is test data and is discarded (ADR 0012)
- Creating AWS resources, the IAM roles or the Vercel environment variables – the user does that by hand, following the
  guide
- Deleting the old Vercel Blob stores – the user does it by hand after the merge (see Notes)

## Open Questions
None. The three questions of 2026-10-31 (size limit of one presigned PUT, CORS origins of the preview bucket, the
SeaweedFS adapter tests in CI) were answered by the user on 2026-10-31 and are written into the Task; see
`docs/stories/OPEN_QUESTIONS.md`.

## Notes
- Source of the decisions: ADR 0012 (proposed 2026-10-31; the user accepts it before or with this task). ADR 0006 is
  accepted and is not edited; ADR 0012 supersedes its object-storage part once accepted. ADR 0009 holds unchanged.
- Story review: `docs/reviews/2026-10-31-story-review.md`. Its ADR inputs (regional endpoint and addressing style,
  temporary-credential lifetime, overwrite protection) can be added to ADR 0012 by the domain-architect while it is
  `proposed`; this task edits no ADR.
- Implementation risks:
  - SeaweedFS is not AWS: a difference in presigned addresses, signed length, disposition or CORS shows up only on the
    preview – hence the probe first and the preview run as a checklist item (ADR 0012, consequences).
  - OIDC temporary-credential lifetime vs the 30-minute upload address: an address signed with the assumed role's
    temporary credentials is invalid once they expire, whatever its validity says, so an upload address can be cut
    short near the end of a credential session. Verify on the preview how much lifetime the SDK's web-identity
    provider leaves at signing time; record it in the pull request.
  - Size: the upper end of L (review); if it runs over, pull the documentation work last.
- After the merge the user deletes the old Vercel Blob stores (development and the one used by previews and
  production) by hand, and removes the Blob environment variables (`BLOB_STORE_ID`, `BLOB_READ_WRITE_TOKEN`,
  `BLOB_WEBHOOK_PUBLIC_KEY`) from Vercel and from `.env.development.local`.
- The AWS DPA (AWS Service Terms) is to be confirmed before real visitor data is stored (ADR 0012) – go-live planning,
  not this task.
- Size L and risk high (as asked by the user's session, 2026-10-31); `priority: must` because every local upload is
  broken until this task is done.
- Glossary: "pending upload" is in `CONTEXT.md` (technical, ST-085). "Upload address" is used as in ADR 0009/ST-085
  and is not a glossary entry – reported to the main session, not added here.
