---
id: ST-066
title: Remove the spike configuration and data
type: tech-task
context: BC-Repair
priority: must
size: S
risk: low
events: []
depends_on: [ST-004, ST-007, ST-078]
labels: [follow-up, foundation]
status: in-progress
---

## Task
**Split out of ST-065 again on 2026-10-17 (user decision).** The backlog grooming of 2026-10-11 had folded the spike's configuration and data into the hosting move (ST-065); with hosting deferred, the cleanup is done now on the current account. ST-065 no longer contains it.

Follow-up of the walking-skeleton spike ST-001 (`docs/reviews/ST-001-code-review.md` finding #2) and of the photo spike ST-002 (`docs/reviews/ST-002-code-review.md` finding #3). Split from ST-065 in the story review `docs/reviews/2026-09-27-story-review.md` (decisions 1 and 3); moving hosting to the museum's Pro team stays with ST-065. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

**Split on 2026-09-29 (user decision).** The **code** removal moved out of this story into **ST-078**, which runs right away – the spike pages, the passphrase gate, the upload route, the test page on `/`, the `spike` message block, the spike browser test and the spike's traces in the repository's configuration. What is left here is what a code change cannot do and what only makes sense once the code is gone: the spike's **configuration** and **data**, plus the defensive checks that nothing spike-shaped survived.

- **Configuration:** the `SPIKE_PASSWORD` environment variable in all Vercel environments (production, preview, development), and the GitHub Actions secret `PREVIEW_SPIKE_PASSWORD` the browser-test workflow used for it (ST-078 removes the workflow's reference to it).
- **Data:** all blobs under the `spike/` prefix – including the spike photos under `spike/photos/`, which may show people and therefore must not remain on the Hobby account without a DPA (ADR 0006).
- **Defensive checks:** that no spike-shaped rows are left in production or in a preview database branch.

The schema alignment is not part of this task: ST-007 deletes the spike rows with `machine_id = 'test-machine'`, aligns `problem_report.machine_id` with the machine ID type and adds the foreign key; ST-004 aligns `problem_report.reporter_team_member_id` with Better Auth's user ID format and adds its foreign key; ST-003 states the ID convention. This task only checks defensively that nothing spike-shaped remains.

Where practical, the checks are scripted (e.g. with the post-deploy smoke tooling of ST-061 and the Neon API for preview branches) instead of checked by hand.

## Acceptance Criteria
- [x] A scripted listing of the Vercel environment variables finds no `SPIKE_PASSWORD` in production, preview or development. – Vercel API listing of all project environment variables (`filter_project_envs`, 2026-10-17): no `SPIKE_PASSWORD` in any target. The line was also removed from the local `.env.development.local`.
- [x] The GitHub Actions secret `PREVIEW_SPIKE_PASSWORD` no longer exists (repository and Dependabot secrets), and the browser-test workflow runs green without it. – deleted with `gh secret delete` (Actions and `--app dependabot`, 2026-10-17); `gh secret list` shows only `VERCEL_AUTOMATION_BYPASS_SECRET` in both; `e2e` green on this story's pull request.
- [x] A scripted listing of the Blob store with the prefix `spike/` returns 0 blobs (this covers the spike photos under `spike/photos/`). – the store is OIDC-only, so a prefix listing from outside a deployment is not possible; the maintainer deleted everything under `spike/` in the Vercel store browser (2026-10-17), and the Vercel API store metadata (`get_storage_stores_by_id`) went from 4 blobs / 109 MB to 1 blob / 254 KB, which is not under `spike/`.
- [x] Defensive check, in production and in every preview database branch that still exists: no `problem_report` row has a `machine_id` or `reporter_team_member_id` that does not follow the ID convention (e.g. `"test-machine"`), and both columns have the ID column type of the convention. – both columns are `uuid` with a foreign key (`drizzle/0003_problem_report_reporter_team_member.sql`, `drizzle/0005_machine.sql`), so a value like `"test-machine"` cannot be stored; every deployment runs the migrations in its build (ADR 0006), so this holds for production and every deployed preview branch. A SQL check on the production branch in the Neon SQL editor (2026-10-17) counted 0 rows without a matching machine or team member.
- [x] Defensive check on the production deployment: a scripted request to `/spike`, `/spike/files`, `/spike/photos`, `/api/spike` and `/api/spike/upload` returns 404 for each, and `/` shows neither the test machine nor the links to the spike pages (the code was removed in ST-078; this confirms it reached production). – `curl` loop against `https://eschbach.michaelschempp.de` (2026-10-17): 404 for all five paths; `/` answers 200 and contains neither `test-machine` nor `/spike`.
- [x] The production deployment builds and runs without `SPIKE_PASSWORD` being set anywhere. – production deployment of `0c5b210` (pull request #85) is `READY` while the variable exists in no environment.

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
- 2026-10-17 (user decision): `must` again and next in line – hosting (ST-065) is deferred, the spike cleanup is not. The checks run against the current Hobby production and its preview branches.
- Raised to `must` and made a go-live blocker in the story review of 2026-09-29 (user decision): the blobs under `spike/` may show identifiable people and sit on the Hobby account without a DPA (ADR 0006), so this is a compliance gap, not a cleanup. `ST-042` (go-live readiness) now depends on this story and on ST-078. Priority also carries the ordering: `BACKLOG.md` is generated in priority order, so at `should` the story would sort behind every `must`.
- Lead dev in the story review of 2026-09-29: **S / low**, unchanged.
- Back to `review` on 2026-09-29 because the story was split: the code removal moved to ST-078, and `depends_on` changed from `[ST-004, ST-007, ST-068]` to `[ST-004, ST-007, ST-078]` – ST-068 was only needed because the code removal took the spike browser test with it, which is now ST-078's concern.
