# Story review 2026-10-31 – ST-099

Story from the `/feature` session `feature:s3-object-storage`. Tech task, no `ui` label (no screen change), so no UX
lens beyond checking that no UI text changes. Decisions of ADR 0012 (proposed) are taken as settled.

## Summary

| Story | Testable | size | risk | priority | Split/recommendation |
|---|---|---|---|---|---|
| ST-099 S3-compatible object storage everywhere | mostly; 3 scenarios need a rewrite (see below) | L (unchanged; the upper end of L, watch for XL) | high (unchanged) | must (unchanged) | No split (user's decision). Rewrite the size-limit scenario, replace the scenario "Local development uploads end to end" by a checklist item, add SeaweedFS-auth and CI checklist items. |

Frontmatter: no change needed. `size: L`, `risk: high`, `depends_on: [ST-085]`, `priority: must` stay.
`depends_on` is complete: the foundation stories are done, ST-037 (download behaviour) and ST-085 (uploads) are done.

## Value (PO lens)
Real need and in the vision's constraint "minimal operating effort": local development is blocked (18 browser tests),
and the user wants a Docker-only local run. No non-goal touched. `must` is right while local uploads are broken. The
story carries the ADR 0012 decisions: S3 everywhere, one presigned PUT, ADR 0009 unchanged, no migration, no UI text
change, hand-made AWS setup with a guide. It does not edit an ADR. Fine.

## Build (lead-dev lens)

### What the story gets wrong or leaves open
1. **"Same interface" is not true for `uploadAddress`.** To bind a size to a plain presigned PUT the call needs the
   declared size (see [OPEN] 1). `uploadAddress(name, { maximumSize, validUntil })` gains the size, the route
   `/api/uploads` and the pending-upload record take it in the request, and the returned address shape changes (today
   it is Blob's `presignedUrlPayload`). Say so in item 1 or 2, otherwise the size is hidden.
2. **`uploadFile` must change its transport.** `fetch` has no upload progress, so a progress report in percent needs
   `XMLHttpRequest` (or equivalent) in `src/upload/upload-file.ts`. Name this in item 2. Also the current mapping
   `!started.ok -> not-uploaded` must become: a refusal of the declared size by the route -> `too-large`. A browser
   cannot tell a store's 403 for a wrong length from any other 403, so `too-large` can only come from the route (or
   from the early `file.size > limit` check), never from the store's answer. The `refusedAsTooLarge` message sniffing
   goes away.
3. **Scenario 5 mixes two things** ("a browser sends 2 MB for an address with a 1 MB limit -> reports too-large").
   With the recommended answer to [OPEN] 1 the browser never gets an address for 2 MB. Rewrite (see below).
4. **Scenario 2 mixes seams**: "stored under the name" is an adapter integration test, "progress reported up to 100
   percent" is a browser-side test. Split the assertion or state the seam per Then. Suggest: the progress assertion
   lives in the browser (e2e) test that exists for the upload form; the adapter scenario only checks stored size.
5. **Scenario 10 is not a scenario.** "The 18 browser tests pass and none is skipped" has no test titled
   `ST-099: ...` that carries meaning (the 18 tests exist already and are titled by other stories). Make it a checklist
   item (it already is partly: the last checklist item runs the preview). That frees one of the 10 scenario slots for
   the declared-length mismatch (below). Scenario count is now exactly 10 (the maximum).
6. **SeaweedFS must enforce signatures.** Scenarios 3, 4, 6 ("refuses") only mean something if SeaweedFS runs with S3
   identities configured. Without identity configuration SeaweedFS's S3 gateway is open to anonymous requests (my
   understanding; verify in the implementation). Add a checklist item: the compose file configures the fixed
   development identity so that unsigned, wrongly signed and expired requests are refused, and the init step fails
   loudly if it cannot.
7. **Path-style versus virtual-hosted addresses decide the CSP host.** SeaweedFS locally needs path-style
   (`http://localhost:<port>/<bucket>/...`); AWS uses `<bucket>.s3.eu-central-1.amazonaws.com`. Scenario 9 says "names
   the bucket's host": the host must be derived by the same code that builds the addresses (the adapter), not from a
   second env variable that can drift. Also locally the host has a port and is `http`. Input for ADR 0012: use the
   regional endpoint on AWS (the global endpoint can answer a fresh bucket with a redirect, which breaks the CORS
   preflight of a browser PUT; known S3 behaviour, verify against the real bucket).
8. **Emptying `laguardia-e2e`.** `scripts/e2e-server.ts` today deletes the previous run's uploads by their recorded
   names through the storage seam (no listing). `ContentStorage` has no list operation, and the lint rule allows the SDK
   only in the adapter. Keep the "delete the previous run's uploads by recorded name" behaviour and say so instead of
   "empties the bucket", otherwise the task needs a `list`/`empty` on the seam. Rename the checklist item
   accordingly. The condition "without a Blob token" becomes "without the S3 environment".
9. **Overwrite.** Blob uploads used `allowOverwrite: false`. A plain presigned PUT overwrites an existing name, so
   within its 30 minutes the address can be reused to replace the content (same name, length bound). AWS S3 supports
   conditional writes (`If-None-Match: *`) as a signed header; I am not sure SeaweedFS honours it. Risk for the
   implementation and for `/security-review`; low impact (only the team member holding the address, content still
   limited by length, ADR 0009 attach check). Decide in the test plan whether to sign it.
10. **Media type.** Today the browser sends `contentType`. If `Content-Type` is part of the signature the browser must
    send exactly it; if it is not, the attaching check on `details().contentType` is the guard. State which. Preferred:
    sign it (the stored media type then equals what the route accepted).
11. **Credentials lifetime.** A URL signed with the OIDC-assumed role's temporary credentials is invalid once those
    credentials expire, whatever its `X-Amz-Expires`. A 30-minute upload address can therefore be cut short if the
    session is nearly over. Risk to test on the preview (long upload close to 30 minutes is unlikely to be tested);
    the SDK's web-identity provider refreshes credentials, so signing at request time should usually have at least
    some minutes left. Verify.
12. **Expiry tests are time-dependent.** `X-Amz-Expires` has a minimum of 1 second, so "an address whose validity has
    passed" is either signed with a past signing date (the SDK accepts `signingDate`) or needs a real wait of one to
    two seconds. Prefer an injectable clock/signing date in the adapter over `sleep`, to keep the test deterministic.
    Same for scenario 7 ("validity of a few seconds").
13. **SeaweedFS fidelity risks to name** (could make scenario 8 and 5 differ from AWS): `response-content-disposition`
    on presigned GET (scenario 8 relies on the store, not on a header the server adds), signed `Content-Length`
    enforcement on PUT, and CORS rule support including preflight. If SeaweedFS does not honour one of them, the
    scenario is tested on the preview only; the story already says so in Notes, but the scenarios claim adapter
    integration tests. Add: "if SeaweedFS does not enforce X, the scenario is recorded as verified on the preview only,
    in the pull request, not skipped silently".
14. **`opensInBrowser`/download:** scenario 8 should use an address that also proves the inline case does not carry
    `attachment` (one assertion); otherwise a constant `attachment` would pass.

### Edits proposed to scenarios (recommendation, not applied)
- Replace scenario 5 by two:
  - `Scenario: A declared size above the limit gets no upload address` Given the size limit is 1 MB / When a team
    member's browser asks for an upload address declaring 2 MB / Then the request is refused / And the browser upload
    reports "too-large" / And no pending upload exists for it.
  - `Scenario: Content longer than the declared size is refused by the store` Given an upload address signed for 500 KB
    / When 2 MB is sent with it / Then the store refuses it / And details of that name give nothing. (Adapter
    integration test; if SeaweedFS does not enforce the signed length, see 13 – attaching still refuses via `details()`.)
- Drop scenario 10 into the checklist.
- Scenario 3: keep, SigV4 binds the path so it is deterministic on AWS; on SeaweedFS expected too.
- Checklist additions: SeaweedFS identities configured (6); CI starts SeaweedFS (see [OPEN] 3); `uploadFile` uses a
  transport with upload progress and maps the route's size refusal to `too-large` (2); the `list`-free e2e cleanup (8);
  `eslint.config.mjs` restriction moves from `@vercel/blob` to the S3 SDK packages (`@aws-sdk/*`), the browser half
  imports no SDK.
- Context/Task wording: Task item 1 "same interface" -> "the same operations; `uploadAddress` additionally takes the
  declared size".

### Size, risk
L stays. Many small parts (adapter, upload transport, CSP, compose + init, CI, ops guide, five documents, security
review, preview run) and the user refuses splits. Honest note: if the implementation runs over, it is the first story
that is XL in effect; pull the doc work last. Risk high stays: new integration (SDK, SigV4), CORS and cloud
setup that only the preview proves, a security-relevant path (signed addresses, uploads), AWS setup by hand.

### Spikes / tech tasks / ADR input
- No spike story (the user wants no more stories). Inside the task, do a **first step "SeaweedFS probe"**: run the
  adapter test file against SeaweedFS for signed length, `response-content-disposition`, expiry, CORS preflight, and
  note differences before building the rest. Result goes in the pull request.
- ADR 0012 input (not decisions): addressing style and regional endpoint (7); temporary-credential lifetime vs
  30-minute address (11); overwrite protection of a reused PUT address (9). The ADR is `proposed`, so these can still be
  added to it by the domain-architect.
- The `docs/operations/` guide is a hand-made procedure; ask the user to follow it on a clean AWS account, as the
  checklist's final preview run does verify the result.

## UX lens
No `ui` label and none needed: no screen, no text. Checked: "the form texts are unchanged" is testable (existing
browser tests for `too-large` / `not-uploaded` texts stay green). No glossary term is violated: "team member",
"file", "photo" are used as in `CONTEXT.md`. Terms "pending upload" and "upload address" - confirm both are in
`CONTEXT.md`; if not, add before `ready` (I did not check `_Avoid_` for "upload address").

## Recommendations for the [OPEN] items

### 1. How one presigned PUT is held to the size limit
Recommendation: the story's recommendation, with two adjustments.
- Facts: a SigV4 presigned PUT has no size range; a presigned POST policy has `content-length-range`, but ADR 0012
  settled PUT. If `Content-Length` is a signed header, AWS S3 refuses a body of another length with
  `SignatureDoesNotMatch`. A browser sets `Content-Length` itself from the body (it is a forbidden header for scripts),
  so the signed length and the sent length match when the browser sends the file it declared.
- Do it: browser declares `file.size` when asking for the name; the route refuses a declared size above the limit
  (the caller's `maximumSize` or the 100 MB) before recording the pending upload and before signing; the adapter signs
  `Content-Length` (and `Content-Type`); attaching keeps the final check through `details()`. This makes "too-large"
  come from the route, which fits the browser's inability to read the store's 403.
- Adjustment 1: say the declared size is part of the route's request and of `uploadAddress`'s options (see finding 1).
- Adjustment 2: the signed length guards the store only where the store enforces it. AWS does; I am **not sure**
  SeaweedFS does. Treat as an implementation risk: probe first; if SeaweedFS ignores it, the scenario "Content longer
  than the declared size is refused" is verified on the preview, and the attach check remains the guard locally.
- The alternative (sign without a length, rely on attaching) leaves oversized content in the bucket until the
  cleanup and lets a team member store up to the bucket's/plan's limit (5 GB for a single PUT) for up to 30 minutes.
  Do not choose it. A POST policy would enforce it in the store but needs a second browser path (multipart/form-data);
  only a fallback if the signed-length approach fails on the preview.

### 2. CORS origins of the shared preview bucket
Recommendation: accept the story's wildcard. Facts: S3 CORS `AllowedOrigin` allows at most one `*` per origin string,
so `https://<project>-*-<team>.vercel.app` is valid and covers both the per-deployment URLs
(`<project>-<hash>-<team>.vercel.app`) and the branch aliases (`<project>-git-<branch>-<team>.vercel.app`). Production
gets exactly its production origin (and its custom domain if any). Methods `PUT` and `GET`/`HEAD`; allowed headers the
ones the browser sends on the PUT (`Content-Type`; list them rather than `*` where possible, `Content-Length` is not
sent by scripts). Images in `<img>` need no CORS; the PUT and, for `connect-src` fetches, GET do.
Risks: (a) project/team names appear in the pattern, so the guide must state them; (b) the wildcard also matches
deployments whose subdomain happens to fit the pattern, which only the team can create under that team slug (my
understanding of Vercel's naming; verify); (c) a custom preview domain would not match - none is configured; (d) the
CSP is not affected, the bucket host is fixed. Add a checklist line to the guide: "verify CORS with a preflight from a
preview". Low risk of an open hole: the bucket is private and every request still needs a signature.

### 3. SeaweedFS adapter tests in CI
Recommendation: always run them in CI, not skipped. Reasons: the adapter tests are the only automated check of the
signing logic before the preview, a skip-when-unreachable hides a broken setup in exactly the place that is unattended,
and the story already requires the compose setup. Implementation note: a GitHub Actions service container cannot take
a start command (`weed server -s3` etc.), so use a step `docker compose up -d` with the repository's own
`docker-compose.yml` (PostgreSQL stays as the current service or also moves there) plus the init step, then wait for
a health check; this also proves the compose file on every pull request. Set the S3 environment variables for the test
step. Local runs need `npm run db:up`, same as the database tests; the test fails with a clear message (not a skip)
when the store is unreachable. Add as a checklist item. Watch CI time (image pull) and the existing CI-cache egress
hang; pin the SeaweedFS image tag.

## Questions for the user (at most 3)
1. Overwrite: sign `If-None-Match: *` so a name is written once (as with Blob's `allowOverwrite: false`)? Recommended:
   yes if SeaweedFS accepts it, otherwise accept the 30-minute window and note it in the security review.
2. Scenario 10 into the checklist, freeing a scenario for the "longer than declared" case? Recommended: yes.
3. Accept that a SeaweedFS behaviour that differs from AWS (signed length, `attachment` header, CORS) is verified on the
   preview only and recorded in the pull request, instead of being skipped silently? Recommended: yes.
