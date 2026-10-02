---
id: ST-083
title: Local browser tests run against a database of their own
type: tech-task
context: BC-Repair
priority: must
size: S
risk: low
events: []
depends_on: []
labels: [follow-up, foundation]
status: draft
---

## Task
Decision of the user, 2026-10-02, during /implement ST-009. Cross-cutting test infrastructure; filed under `BC-Repair` like the other foundation tasks (ST-059, ST-067, ST-078).

**Problem.** Local browser tests (`npx playwright test`, `npm run verify -- --e2e`) run against the developer's local dev server (`playwright.config.ts`: `webServer` with `reuseExistingServer: true` on port 3000) and therefore against the developer's own development database (`laguardia` in the docker compose PostgreSQL, `DATABASE_URL` in `.env.development.local`). Every run leaves test data behind there: team member accounts (`e2e_*`, `nojs_*`, helper accounts), machine models and machines. By 2026-10-02 the local development database held 272 test accounts and about 180 machine models; the team member page (`/team/members`) became so slow that the account browser tests (`e2e/team-accounts.spec.ts`, `e2e/account-pages.spec.ts`) timed out under the full suite. The user had to delete the whole local database and re-create their own first technician and the e2e technician (`E2E_TEAM_USERNAME` / `E2E_TEAM_PASSWORD`) by hand.

Deleting test data after each run is not the answer: accounts are never deleted, only deactivated (ADR 0004/0006, ST-005); many tables refer to team members and machines by foreign key; and an aborted run would still leave data behind.

**Decided direction.** Local browser tests get a database of their own, the way the integration tests have `laguardia_test` (`src/test-support/reset-test-database.ts`, `globalSetup` in `vitest.config.ts`):
- a separate database (e.g. `laguardia_e2e`) on the same local PostgreSQL;
- before each local browser-test run it is reset (dropped/recreated or emptied) and migrated, and the e2e technician account is created automatically from `E2E_TEAM_USERNAME` / `E2E_TEAM_PASSWORD` – through the Team module's own setup (as `npm run setup:first-technician` does), not with hand-written SQL;
- Playwright starts its own dev server on another port, pointed at that database, instead of reusing the developer's dev server on port 3000 – so the developer's development data is never touched by tests.

How is left to the implementation (e.g. Playwright `globalSetup`, a second env file or env overrides for the web server). Note that `resetDatabase` currently refuses any database whose name does not end in `_test`; the guard against resetting the development database by mistake must stay at least as strict for the new database.

Runs against a deployed preview (`BASE_URL` set, CI workflow `.github/workflows/e2e-preview.yml`) are unchanged – this task is about local runs only. Seeding the preview database is ST-068's job (decision in `docs/stories/OPEN_QUESTIONS.md`, 2026-09-27).

Related: ST-081 (find a team member – the members page has no search, G4) addresses the slow page from the product side; this task removes the cause in the tests.

## Acceptance Criteria
- [ ] A full local browser-test run creates no team member account, machine model or machine in the development database: the row counts of these tables in `laguardia` are the same before and after `npm run verify -- --e2e` (demonstrated once and noted in the pull request).
- [ ] The local browser tests run against a dev server Playwright starts itself, on a port other than 3000, connected to the browser-test database; a dev server the developer has running on port 3000 is neither reused nor stopped.
- [ ] Before every local run the browser-test database is reset and migrated, so two consecutive runs start from the same empty state: the second of two back-to-back full runs passes with the same results as the first and its tables contain only the data of that run.
- [ ] The e2e technician account is created automatically from `E2E_TEAM_USERNAME` / `E2E_TEAM_PASSWORD` through the Team module's own setup (no hand-written SQL); with these variables set, the browser tests that need a technician account run and pass locally instead of skipping or failing for a missing account.
- [ ] On a fresh clone, with `.env.development.local` filled in from `.env.example`, `npm run db:up` is the only preparation the local browser tests need – no `db:migrate:dev`, no `setup:first-technician` and no manual account.
- [ ] The reset refuses to touch any database other than the browser-test database (in particular the development database `laguardia`), with an error message that names the database – demonstrated once with a deliberately wrong name.
- [ ] `npm run verify -- --e2e` stays the one command for a local run including browser tests; `npx playwright test` alone behaves the same.
- [ ] Runs against a deployed preview (`BASE_URL` set, `.github/workflows/e2e-preview.yml`) behave as before: no local database, no local dev server, the same tests skipped.
- [ ] The engineering conventions (`.claude/skills/engineering-conventions/SKILL.md`, Tests section), `README.md` and `.env.example` say which database and port the local browser tests use, that they are reset on every run and that the development database is never touched by tests.

## Out of Scope
- Seeding the preview database for browser tests against a deployed preview (ST-068)
- Changing what the browser tests assert
- A search on the team member page (ST-081)
- Cleaning up test data already left in a developer's development database

## Open Questions
- none
