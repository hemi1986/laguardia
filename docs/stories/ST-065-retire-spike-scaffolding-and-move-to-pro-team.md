---
id: ST-065
title: Retire the ST-001 spike scaffolding and move hosting to the museum's Pro team
type: tech-task
context: BC-Repair
priority: should
size: null
risk: null
events: []
depends_on: [ST-003, ST-004]
labels: [follow-up, foundation]
status: draft
---

## Task
Follow-up of the walking-skeleton spike ST-001 (`docs/reviews/ST-001-code-review.md` findings #2 and #18, `docs/reviews/ST-001-acceptance.md` edge case "Neon Auth", `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md` (proposed), Consequences "Move to production"). Nothing in the spike's throwaway parts or in the hosting move is owned by another story yet. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

**1. Remove the spike scaffolding** (once team login from ST-004 replaces the passphrase gate):
- Code: the passphrase gate `src/spike/*`, the file pages `src/app/spike/files/*`, the upload route `src/app/api/spike/upload/route.ts`, and the test page on `/` with the *Report problem* form for the hard-coded machine `"test-machine"` (`src/app/page.tsx`, `src/app/actions.ts` as far as they serve the test machine).
- Configuration: the `SPIKE_PASSWORD` environment variables in preview and production.
- Data: all blobs under the `spike/` prefix, and the spike's `problem_report` rows with `machine_id = 'test-machine'` in production and in every preview database branch.
- Order matters (code review #2): migration `drizzle/0000_problem_report.sql` is already applied with `machine_id text` and `reporter_team_member_id text`, and `"test-machine"` is not a valid ID. The spike rows are deleted first; then a new migration aligns both columns with the ID convention for opaque IDs (`MachineId`, `TeamMemberId`). [OPEN] ST-003 does not yet state that ID convention, and nothing stops ST-007 from adding a foreign key to the machine table before this task runs – see Open Questions.

**2. Move hosting to the museum's Vercel Pro team** before any real visitor data (problem reports, photos) is stored – ADR 0006: Vercel's data processing agreement covers only Pro and Enterprise, and Hobby Blob storage is limited to 1 GB. This part does not need ST-004 and can be done earlier.
- Create or choose the museum's Pro team [OPEN – owner and payer, see Open Questions].
- Transfer the Vercel project, the Neon database (with its integration) and the Blob store to that team; the production domain and deployments keep working.
- Accept the data processing agreements of Vercel (https://vercel.com/legal/dpa) and Neon/Databricks (https://www.databricks.com/legal/dpa) for the museum's account.
- Switch Neon to the Launch plan with 7 days of history, so point-in-time restore is available. The backups, their test restore and the recovery steps stay with ST-062; this task only provides the plan.

**3. Disable the unused Neon Auth integration** and remove its environment variables `NEON_AUTH_BASE_URL` and `VITE_NEON_AUTH_URL` (team login uses Better Auth, ADR 0006).

## Acceptance Criteria
- [ ] The files `src/spike/*`, `src/app/spike/files/*` and `src/app/api/spike/upload/route.ts` no longer exist, and no source file references `test-machine` or `SPIKE_PASSWORD`.
- [ ] On the production deployment, no route under `/spike` and no route under `/api/spike` responds with anything but 404.
- [ ] `/` no longer shows the test page for `"test-machine"`.
- [ ] No `SPIKE_PASSWORD` variable exists in any Vercel environment (production, preview, development).
- [ ] Listing the Blob store with the prefix `spike/` returns 0 blobs.
- [ ] `select count(*) from problem_report where machine_id = 'test-machine'` returns 0 in production and in every preview database branch that still exists.
- [ ] A migration after `0000_problem_report` changes `machine_id` and `reporter_team_member_id` to the ID column type of the convention and has been applied successfully in production (build log).
- [ ] The Vercel project, the Neon database and the Blob store belong to the museum's Pro team; the personal Hobby account holds none of them.
- [ ] After the transfer, a deployment of `main` succeeds, runs in `fra1`, and *Report problem* stores and shows a problem report again (manual check on production).
- [ ] The Vercel and Neon/Databricks DPA links and the date of their acceptance are recorded in the ADR that supersedes ADR 0006 or in `docs/stories/OPEN_QUESTIONS.md`.
- [ ] The Neon project is on the Launch plan with a history retention of 7 days (dashboard setting documented).
- [ ] Neon Auth is disabled, and neither `NEON_AUTH_BASE_URL` nor `VITE_NEON_AUTH_URL` exists in any Vercel environment.

## Out of Scope
- Separate preview and production object storage, error monitoring, uptime check (ST-061)
- Backups, test restore and recovery steps (ST-062)
- Team login and accounts (ST-004, ST-005)
- Module structure, command layer, ID assignment in commands, branded ID types (ST-003)
- Custom domain (ST-060)
- Other minor code review findings on the kept skeleton code (reporter check constraint, connection pool, boilerplate)

## Open Questions
- [OPEN] Who owns the museum's Vercel Pro team, who pays for it (about $22–25/month, ADR 0006) and who accepts the DPAs on behalf of the museum? See `docs/stories/OPEN_QUESTIONS.md`.
- [OPEN] Which story fixes the ID column type for opaque IDs (e.g. `uuid`), and how is it ensured that the spike rows are deleted and the columns aligned before ST-007 or ST-004 adds a foreign key to `problem_report`? See `docs/stories/OPEN_QUESTIONS.md`.
