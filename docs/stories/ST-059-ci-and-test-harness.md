---
id: ST-059
title: CI and test harness
type: tech-task
context: BC-Repair
priority: must
size: M
risk: medium
events: []
depends_on: [ST-001]
labels: [mvp, foundation]
status: done
---

## Task
Set up continuous integration and the test harness on top of the walking skeleton (ST-001), before the command layer (ST-003) and all domain stories are built (story review 2026-09-26, TT-A). This task spans all contexts; it is filed under `BC-Repair` like the other cross-cutting foundation tasks (ST-001, ST-002).

- Lint and type check on every push.
- Unit tests and integration tests against a real PostgreSQL (not a mock).
- Browser tests at phone size (360 px wide) for the main flows.
- A red build blocks the deployment.
- Test-data builders for machines, machine models, problem reports, defects, maintenance tasks and team members.
- An injectable clock, so time-based rules (due, overdue, waiting longer than 3 days, stale claims) can be tested at fixed points in time.

## Acceptance Criteria
- [x] Every push runs lint, type check, unit and integration tests; the result is visible on the commit. – `.github/workflows/ci.yml`, job `verify` (`npm run verify`); green check on the branch commits.
- [x] Integration tests run against a real PostgreSQL database that is reset per test run. – Vitest project `integration` (`*.integration.test.ts`); the global setup `src/test-support/reset-test-database.ts` drops and re-migrates `laguardia_test`; PostgreSQL 17 service container in CI, docker compose locally.
- [x] At least one browser test runs at 360 px width against a deployed preview. – `e2e/report-problem.spec.ts` (Playwright, 360×800); `.github/workflows/e2e-preview.yml` waits for the commit's Vercel preview and passes the deployment protection with `VERCEL_AUTOMATION_BYPASS_SECRET`. Green against `laguardia-giwb8sd6z-hemi6.vercel.app` (run 36323721441).
- [x] A deliberately failing test prevents deployment to production. – production deploys from `main`; branch protection on `main` requires `verify`, admins included. Proof: PR #4 with a failing test → `verify` failure, merge state BLOCKED; closed, branch deleted. A Vercel Deployment Check on `verify` is added after the merge (the dialog only finds checks on `main`).
- [x] Test-data builders exist for every aggregate (`docs/architecture/data-model.md`) and for team members with each role. – `src/test-support/builders.ts`: `aMachine`, `aMachineModel`, `aFile`, `aProblemReport`, `aDefect`, `aMaintenancePlan`/`aMaintenanceTask`, `aMaintenanceRecord`, `aHelper`, `aTechnician`; locally typed until each aggregate has its domain type.
- [x] A test sets the clock to a fixed date and time and a time-based rule uses it. – `src/clock.ts` (`Clock`, `systemClock`, `fixedClock`), injected via `CommandContext`; `problem-reports.integration.test.ts` fixes the clock and CMD-ReportProblem stores that time. No time-based rule exists yet – the first is ST-003's time convention helper, which takes this clock (`OPEN_QUESTIONS.md`, decided 2026-09-27).
- [x] The full pipeline runs in under 10 minutes. – `verify` 44 s, browser tests on preview 59 s incl. waiting for the deployment (2026-09-27); both jobs have `timeout-minutes: 10`.

## Definition of Done (applies to every story)
Agreed in the story review (`docs/reviews/2026-09-26-story-review.md`); the pipeline from this task checks what can be automated.
- Phone-first layout, usable down to 360 px width.
- List pages respond in under 1 s with realistic data volume.
- Every command writes its entry to the event journal.
- German team UI texts come from the message catalog; visitor pages from the German and English catalogs.
- No personal data in logs.
- Critical security advisories for the framework are patched within 48 h (ST-063).

## Out of Scope
- Environments and monitoring (ST-061)
- The time convention itself (ST-003)

## Open Questions
- none
