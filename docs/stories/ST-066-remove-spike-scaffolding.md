---
id: ST-066
title: Remove the ST-001 spike scaffolding
type: tech-task
context: BC-Repair
priority: should
size: S
risk: low
events: []
depends_on: [ST-004, ST-007]
labels: [follow-up, foundation]
status: ready
---

## Task
Follow-up of the walking-skeleton spike ST-001 (`docs/reviews/ST-001-code-review.md` finding #2). Split from ST-065 in the story review `docs/reviews/2026-09-27-story-review.md` (decisions 1 and 3); moving hosting to the museum's Pro team stays with ST-065. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

Once team login (ST-004) replaces the passphrase gate, remove everything the spike left behind:
- **Code:** the passphrase gate `src/spike/*`, the file pages `src/app/spike/files/*`, the upload route `src/app/api/spike/upload/route.ts`, and the test page on `/` with the *Report problem* form for the hard-coded machine `"test-machine"` (`src/app/page.tsx`, `src/app/actions.ts` as far as they serve the test machine).
- **Configuration:** the `SPIKE_PASSWORD` environment variable in all Vercel environments (production, preview, development).
- **Data:** all blobs under the `spike/` prefix, and any spike `problem_report` rows that still remain in production or in a preview database branch.

The schema alignment is not part of this task: ST-007 deletes the spike rows with `machine_id = 'test-machine'`, aligns `problem_report.machine_id` with the machine ID type and adds the foreign key; ST-004 aligns `problem_report.reporter_team_member_id` with Better Auth's user ID format and adds its foreign key; ST-003 states the ID convention. This task only checks defensively that nothing spike-shaped remains.

Where practical, the checks are scripted (e.g. with the post-deploy smoke tooling of ST-061 and the Neon API for preview branches) instead of checked by hand.

## Acceptance Criteria
- [ ] The files `src/spike/*`, `src/app/spike/files/*` and `src/app/api/spike/upload/route.ts` no longer exist, and no source file references `test-machine` or `SPIKE_PASSWORD`.
- [ ] A scripted request to `/spike`, `/spike/files`, `/api/spike` and `/api/spike/upload` on the production deployment returns 404 for each.
- [ ] `/` no longer shows the test page for `"test-machine"`.
- [ ] A scripted listing of the Vercel environment variables finds no `SPIKE_PASSWORD` in production, preview or development.
- [ ] A scripted listing of the Blob store with the prefix `spike/` returns 0 blobs.
- [ ] Defensive check, in production and in every preview database branch that still exists: no `problem_report` row has a `machine_id` or `reporter_team_member_id` that does not follow the ID convention (e.g. `"test-machine"`), and both columns have the ID column type of the convention.

## Out of Scope
- ID convention and injected ID generator (ST-003)
- Aligning `problem_report.machine_id` and adding its foreign key (ST-007)
- Aligning `problem_report.reporter_team_member_id` and adding its foreign key (ST-004)
- Moving hosting to the museum's Pro team, DPAs, Neon Launch plan, Neon Auth (ST-065)
- Other minor code review findings on the kept skeleton code (reporter check constraint, connection pool, boilerplate)

## Open Questions
- none
