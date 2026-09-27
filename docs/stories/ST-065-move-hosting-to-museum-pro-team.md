---
id: ST-065
title: Move hosting to the museum's Vercel Pro team
type: tech-task
context: BC-Repair
priority: must
size: S
risk: medium
events: []
depends_on: [ST-001]
labels: [follow-up, foundation]
status: ready
---

## Task
Follow-up of the walking-skeleton spike ST-001 (`docs/reviews/ST-001-code-review.md` finding #18, `docs/reviews/ST-001-acceptance.md` edge case "Neon Auth", `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`, Consequences "Move to production"). Split from the original ST-065 in the story review `docs/reviews/2026-09-27-story-review.md` (decisions 1, 2 and 4); removing the spike scaffolding is ST-066. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

**Deadline:** this task must be finished before real visitor data is stored, i.e. before visitor reporting (ST-010, ST-013, ST-014) is live in production – ADR 0006: Vercel's data processing agreement covers only Pro and Enterprise, and Hobby Blob storage is limited to 1 GB. Team member accounts (ST-004, ST-005) may stay on the Hobby deployment until then (decision 2).

**1. Museum's Vercel Pro team** (decision 4):
- The museum owns and pays for the Vercel Pro team (about $22–25/month incl. Neon Launch, ADR 0006) as data controller.
- The museum's project owner is team owner and accepts the data processing agreements of Vercel (https://vercel.com/legal/dpa) and Neon/Databricks (https://www.databricks.com/legal/dpa) on behalf of the museum.
- The developer is a Member of the team with deploy rights, without billing rights.

**2. Transfer** the Vercel project, the Neon database (with its integration) and the Blob store to that team; the production domain and deployments keep working.

**3. Neon Launch plan** with 7 days of history, so point-in-time restore is available. Backups, their test restore and the recovery steps stay with ST-062; this task only provides the plan.

**4. Disable the unused Neon Auth integration** and remove its environment variables `NEON_AUTH_BASE_URL` and `VITE_NEON_AUTH_URL` (team login uses Better Auth, ADR 0006).

The acceptance of the DPAs is recorded either in `docs/stories/OPEN_QUESTIONS.md` or in a new ADR that supersedes ADR 0006; ADR 0006 is accepted and is not edited.

## Acceptance Criteria
- [ ] The Vercel Pro team belongs to the museum and is paid by the museum; the museum's project owner is team owner.
- [ ] The developer is a Member of the team with deploy rights and without billing rights.
- [ ] The Vercel project, the Neon database and the Blob store belong to the museum's Pro team; the personal Hobby account holds none of them.
- [ ] After the transfer, a deployment of `main` succeeds, runs in `fra1`, and *Report problem* stores and shows a problem report again (manual check on production).
- [ ] The Vercel and Neon/Databricks DPA links, who accepted them and the date of their acceptance are recorded in `docs/stories/OPEN_QUESTIONS.md` or in a new ADR that supersedes ADR 0006.
- [ ] The Neon project is on the Launch plan with a history retention of 7 days (dashboard setting documented).
- [ ] Neon Auth is disabled, and neither `NEON_AUTH_BASE_URL` nor `VITE_NEON_AUTH_URL` exists in any Vercel environment (production, preview, development).
- [ ] All items above are done before visitor reporting (ST-010, ST-013, ST-014) is live in production.

## Out of Scope
- Removing the spike scaffolding (code, routes, `SPIKE_PASSWORD`, `spike/` blobs, spike rows) (ST-066)
- Separate preview and production object storage, error monitoring, uptime check (ST-061)
- Backups, test restore and recovery steps (ST-062)
- Team login and accounts (ST-004, ST-005)
- Custom domain (ST-060)

## Open Questions
- none
