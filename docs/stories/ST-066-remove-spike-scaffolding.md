---
id: ST-066
title: Remove the spike configuration and data
type: tech-task
context: BC-Repair
priority: should
size: S
risk: low
events: []
depends_on: [ST-004, ST-007, ST-078]
labels: [follow-up, foundation]
status: review
---

## Task
Follow-up of the walking-skeleton spike ST-001 (`docs/reviews/ST-001-code-review.md` finding #2) and of the photo spike ST-002 (`docs/reviews/ST-002-code-review.md` finding #3). Split from ST-065 in the story review `docs/reviews/2026-09-27-story-review.md` (decisions 1 and 3); moving hosting to the museum's Pro team stays with ST-065. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

**Split on 2026-09-29 (user decision).** The **code** removal moved out of this story into **ST-078**, which runs right away – the spike pages, the passphrase gate, the upload route, the test page on `/`, the `spike` message block, the spike browser test and the spike's traces in the repository's configuration. What is left here is what a code change cannot do and what only makes sense once the code is gone: the spike's **configuration** and **data**, plus the defensive checks that nothing spike-shaped survived.

- **Configuration:** the `SPIKE_PASSWORD` environment variable in all Vercel environments (production, preview, development), and the GitHub Actions secret `PREVIEW_SPIKE_PASSWORD` the browser-test workflow used for it (ST-078 removes the workflow's reference to it).
- **Data:** all blobs under the `spike/` prefix – including the spike photos under `spike/photos/`, which may show people and therefore must not remain on the Hobby account without a DPA (ADR 0006).
- **Defensive checks:** that no spike-shaped rows are left in production or in a preview database branch.

The schema alignment is not part of this task: ST-007 deletes the spike rows with `machine_id = 'test-machine'`, aligns `problem_report.machine_id` with the machine ID type and adds the foreign key; ST-004 aligns `problem_report.reporter_team_member_id` with Better Auth's user ID format and adds its foreign key; ST-003 states the ID convention. This task only checks defensively that nothing spike-shaped remains.

Where practical, the checks are scripted (e.g. with the post-deploy smoke tooling of ST-061 and the Neon API for preview branches) instead of checked by hand.

## Acceptance Criteria
- [ ] A scripted listing of the Vercel environment variables finds no `SPIKE_PASSWORD` in production, preview or development.
- [ ] The GitHub Actions secret `PREVIEW_SPIKE_PASSWORD` no longer exists (repository and Dependabot secrets), and the browser-test workflow runs green without it.
- [ ] A scripted listing of the Blob store with the prefix `spike/` returns 0 blobs (this covers the spike photos under `spike/photos/`).
- [ ] Defensive check, in production and in every preview database branch that still exists: no `problem_report` row has a `machine_id` or `reporter_team_member_id` that does not follow the ID convention (e.g. `"test-machine"`), and both columns have the ID column type of the convention.
- [ ] Defensive check on the production deployment: a scripted request to `/spike`, `/spike/files`, `/spike/photos`, `/api/spike` and `/api/spike/upload` returns 404 for each, and `/` shows neither the test machine nor the links to the spike pages (the code was removed in ST-078; this confirms it reached production).
- [ ] The production deployment builds and runs without `SPIKE_PASSWORD` being set anywhere.

## Out of Scope
- The spike **code**: `src/spike/*`, `src/app/spike/*`, `src/app/api/spike/upload/route.ts`, the test page on `/` and its Server Action, the `spike` message block, `e2e/report-problem.spec.ts` and the spike's traces in the repository's configuration (ST-078)
- Re-pointing the CSRF browser test away from the test page (ST-078) and the replacement browser test of the real visitor flow (ST-068)
- ID convention and injected ID generator (ST-003)
- Aligning `problem_report.machine_id` and adding its foreign key (ST-007)
- Aligning `problem_report.reporter_team_member_id` and adding its foreign key (ST-004)
- Moving hosting to the museum's Pro team, DPAs, Neon Launch plan, Neon Auth (ST-065)
- Other minor code review findings on the kept skeleton code (reporter check constraint, connection pool, boilerplate)
- Changes to the photo building block `src/photo/*` (ST-002 review findings on it are handled in ST-002 or in ST-016)

## Open Questions
- none

## Notes
- Back to `review` on 2026-09-29 because the story was split: the code removal moved to ST-078, and `depends_on` changed from `[ST-004, ST-007, ST-068]` to `[ST-004, ST-007, ST-078]` – ST-068 was only needed because the code removal took the spike browser test with it, which is now ST-078's concern.
