---
status: proposed
date: 2026-09-27
---

# 0006 – Hosting verified: Vercel Pro in fra1, Neon PostgreSQL in Frankfurt, private Vercel Blob

## Context and Problem
`docs/adr/0005-hosting-vercel.md` chose Vercel with managed PostgreSQL and object storage in the EU, subject to a walking-skeleton spike. The spike (`docs/stories/ST-001-walking-skeleton-vercel-eu.md`) has run; this ADR records what was verified and the concrete setup. It supersedes ADR 0005 once accepted (ADR 0005 is accepted and cannot be edited).

## Driving Requirements
- Minimal operating effort, one volunteer maintainer; no self-operated servers or backups – `docs/product/vision.md` (Constraints)
- Visitor photos may show people → EU hosting and a GDPR data processing agreement – `docs/adr/0005-hosting-vercel.md`
- Files up to 100 MB, any format (scanned PDF manuals) – `docs/stories/OPEN_QUESTIONS.md` (ST-037)
- Team login with username/password and server-side sessions that end on deactivation – `docs/adr/0004-team-authentication.md`

## Decision
- **Functions in `fra1` (Frankfurt)**, set in `vercel.json` (`"regions": ["fra1"]`). Verified: `vercel inspect` lists every function with `[fra1]`; responses carry `x-vercel-id: fra1::fra1::…`.
- **PostgreSQL: Neon via the Vercel Marketplace, region Frankfurt (aws-eu-central-1).** Preview deployments get their own Neon branch per Git branch (integration setting "create database branch for deployment"), so previews never touch production data. Migrations (Drizzle, `drizzle/`) run in the Vercel build: `buildCommand` = `npm run db:migrate && npm run build`. Verified: the build log shows "migrations applied successfully" before `next build`; a preview branch exists in the Neon dashboard.
- **Object storage: Vercel Blob, private store, region `fra1`.** Uploads go from the browser directly to Blob via presigned URLs (`handleUploadPresigned` / `uploadPresigned`, multipart above 20 MB); the server only issues a short-lived, size-limited permission after its own authorization check. Downloads use presigned GET URLs valid for 5 minutes, so large files never stream through a function. Blob credentials are OIDC (rotating), no long-lived token in code.
  Verified on the preview: a signed link returns 200; the same URL without a signature returns 403; the store root is not listable (400); a 100 MB PDF was uploaded from the browser (Chrome on Windows) and downloaded again byte-identical (SHA-256 match, ~10.6 s); the same signed link returns 403 after 5½ minutes (expired).
- **Plan: Vercel Pro is required** for production, for two independent reasons:
  1. Vercel's data processing agreement (https://vercel.com/legal/dpa) applies only to Pro and Enterprise customers – "This Addendum applies to … Customers who are on Enterprise and Pro plans". Hobby has no DPA, so visitor photos must not be stored there.
  2. Hobby includes only 1 GB of Blob storage and blocks Blob for 30 days when exceeded; ~200 scanned manuals need several GB.
  (Commercial use is a third, open question: Hobby is "non-commercial personal use only"; the museum's project owner confirms, but Pro makes it moot.)
- **Auth library for ST-004: Better Auth** with the `username` and `admin` plugins, sessions stored in PostgreSQL. `admin` covers the technician flows of ADR 0004: create user, set role, set password, and ban (= deactivate), which "revokes all of their existing sessions". Its user table requires an e-mail column; we store a non-deliverable placeholder (`<username>@users.invalid`, reserved TLD) that is never shown or used – no team member enters an e-mail address, and no e-mail is sent (ADR 0004 holds).

## Considered Options
- **Auth.js (NextAuth) credentials provider**: rejected – the credentials provider does not support database sessions, so deactivation could not end sessions.
- **Lucia**: rejected – deprecated by its author (2025); it is now a guide for hand-written sessions, against ADR 0004's "no hand-written password handling".
- **Serving private files through a function (`get()` streaming)**: kept for small files if needed, but Vercel does not recommend it above 100 MB; presigned GET URLs avoid function time and transfer.
- **S3-compatible storage from an EU provider (fallback in ADR 0005)**: not needed – Vercel Blob offers private stores in `fra1`.

## Consequences
- **Cost (USD, excl. VAT, estimate for ~60 machines, a few hundred photos/year, ~200 PDFs):**
  | Item | Monthly |
  |---|---|
  | Vercel Pro platform fee (1 deploying seat, includes $20 usage credit) | $20 |
  | Functions, CDN, Blob storage (~6 GB × ~$0.023/GB) and operations | within the $20 credit |
  | Neon Launch (pay-as-you-go: $0.106/CU-hour, $0.35/GB-month; scale-to-zero; ~15 CU-hours, <1 GB) | ~$2–5 |
  | **Total** | **~$22–25** |
  More deploying seats cost $20/month each; viewer seats are free.
- **Backups (ST-062):** Neon Free keeps 6 hours of history (1 manual snapshot); **Neon Launch keeps up to 7 days** of point-in-time restore (instant restore, $0.20/GB-month), 100 manual snapshots and optional scheduled snapshots ($0.09/GB-month). Restore works only on root branches. Recommendation: Neon Launch with 7 days of history plus a scheduled snapshot. Blob content is stored on S3 (11 nines durability); deleted blobs are not recoverable – file removal (ST-038) must be deliberate.
- **Data processing agreements:** Vercel – https://vercel.com/legal/dpa (Pro/Enterprise, EU SCCs included). Neon – belongs to Databricks; the platform terms (https://neon.com/platform-terms) reference the Databricks DPA (https://www.databricks.com/legal/dpa); Neon states GDPR alignment (https://neon.com/docs/security/security-overview, trust center https://trust.neon.com/). The project owner confirms the Neon DPA covers the museum's account.
- **Separate environments:** preview and production use separate Neon branches and separate secrets (`SPIKE_PASSWORD` has its own value per environment). The spike's Blob store is shared between preview and production – a second private store for previews is recommended before real files are stored (ST-061).
- **Secrets are write-only in Vercel** ("Secret" variables cannot be read back or pulled). Set them from the CLI (`printf '%s' '…' | vercel env add NAME <env> --force`) and redeploy after every change – a mistyped value in the dashboard is otherwise invisible (happened in the spike).
- **Move to production:** create a Pro team, transfer the project, the Neon database and the Blob store to it, and sign the DPAs before any real visitor data is stored. The spike ran on a personal Hobby account with test data only.
- The Neon integration also enabled Neon Auth (`NEON_AUTH_BASE_URL`); it is not used and can be disabled.
- `drizzle-kit` pulls an old `esbuild` with a moderate advisory (dev-time only, not deployed) – watched by the dependency routine (ST-063).
