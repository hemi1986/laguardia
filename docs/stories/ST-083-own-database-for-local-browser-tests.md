---
id: ST-083
title: Local browser tests run against a database of their own
type: tech-task
context: BC-Repair
priority: should
size: M
risk: medium
events: []
depends_on: []
labels: [follow-up, foundation]
status: in-progress
---

## Task
Decision of the user, 2026-10-02, during /implement ST-009; revised after the story review `docs/reviews/2026-10-02-story-review.md` (decisions of the user, 2026-10-02). Cross-cutting test infrastructure; filed under `BC-Repair` like the other foundation tasks (ST-059, ST-067, ST-078).

**Problem.** Local browser tests (`npx playwright test`, `npm run verify -- --e2e`) run against the developer's local dev server (`playwright.config.ts`: `webServer` with `reuseExistingServer: true` on port 3000) and therefore against the developer's own development database (`laguardia` in the docker compose PostgreSQL, `DATABASE_URL` in `.env.development.local`). Every run leaves test data behind there: team member accounts (`e2e_*`, `nojs_*`, helper accounts), machine models and machines. By 2026-10-02 the local development database held 272 test accounts and about 180 machine models; the team member page (`/team/members`) became so slow that the account browser tests (`e2e/team-accounts.spec.ts`, `e2e/account-pages.spec.ts`) timed out under the full suite. The user had to delete the whole local database and re-create their own first technician and the e2e technician (`E2E_TEAM_USERNAME` / `E2E_TEAM_PASSWORD`) by hand.

Deleting test data after each run is not the answer: accounts are never deleted, only deactivated (ADR 0004/0006, ST-005); many tables refer to team members and machines by foreign key; and an aborted run would still leave data behind.

**Decided direction.** Local browser tests get a database of their own, the way the integration tests have `laguardia_test` (`src/test-support/reset-test-database.ts`, `globalSetup` in `vitest.config.ts`). Decided facts (user, 2026-10-02):
- The browser-test database is **`laguardia_e2e_test`** on the same local PostgreSQL – consistent with `laguardia_<name>_test` of `isolatedTestDatabase`. `resetDatabase` refuses every database whose name does not end in `_test`; that guard stays exactly as strict as it is, it is not loosened.
- Before each local browser-test run that database is created if missing, reset and migrated, and the e2e technician account is created from `E2E_TEAM_USERNAME` / `E2E_TEAM_PASSWORD` through the Team module's own setup – the non-interactive path of the first-technician setup (`npm run setup:first-technician`), with no copied Team logic and no hand-written SQL.
- Playwright starts its own dev server on port **3100** with its own `distDir` **`.next-e2e`**, pointed at that database, instead of reusing the developer's dev server on port 3000. Next.js 16 allows one `next dev` per `distDir` (lock at `<distDir>/dev/lock`, "Another next dev server is already running" – `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`), so the second server needs a `distDir` of its own; the developer's server on 3000 keeps running. `distDir` is set for the e2e server only and defaults to `.next`, so Vercel builds are unchanged.
- The e2e server's `DATABASE_URL` and `BETTER_AUTH_URL` are set explicitly for it (they override `.env.development.local`); the e2e database URL is derived the way `TEST_DATABASE_URL` is, never from `DATABASE_URL`. Login and the CSRF check depend on `BETTER_AUTH_URL` matching port 3100.
- Playwright starts `webServer` before `globalSetup`, so reset, migrate and seeding must be done before the e2e server serves; the e2e server does not reuse an existing server on its port.

Everything else about how is left to the implementation (where the reset and the seed are triggered, how `distDir` is switched, the side effects on `.gitignore`, `tsconfig`, eslint ignores and `next typegen`).

**First step (about 30 minutes): prove that a second `next dev` with its own `distDir` runs beside one on port 3000.** If it does not, stop: mark the problem as open in this story (as `/implement` describes under *When the story is wrong*), add a row for ST-083 to `docs/stories/OPEN_QUESTIONS.md` and send the story back to `review` – no workaround in the code.

Runs against a deployed preview (`BASE_URL` set, CI workflow `.github/workflows/e2e-preview.yml`) are unchanged – this task is about local runs only. Seeding the preview database is ST-068's job (decision in `docs/stories/OPEN_QUESTIONS.md`, 2026-09-27). The CI `verify` job runs no browser tests and does not change.

Related: ST-081 (finding a team member – a search on the members page) is a product need of its own and stays valid regardless of this task; ST-083 only removes the test-side cause of the timeouts.

## Acceptance Criteria
- [ ] A full local browser-test run creates no team member account, machine model or machine in the development database: the row counts of these tables in `laguardia` are the same before and after `npm run verify -- --e2e` (checked once by hand and noted in the pull request).
- [ ] An aborted or failed local run also leaves the development database untouched: the row counts in `laguardia` are the same before and after a run stopped part-way (checked once by hand and noted in the pull request).
- [ ] The local browser tests run against a dev server Playwright starts itself on port 3100 with `distDir` `.next-e2e`, connected to `laguardia_e2e_test`.
- [ ] With the developer's dev server running on port 3000 during a local run, there is no "Another next dev server is already running" lock error, and that server is neither used by the tests nor stopped.
- [ ] With port 3100 already taken, the run fails with a clear message naming the port instead of reusing the server on it (`reuseExistingServer` off for the e2e server).
- [ ] With PostgreSQL not running, the run stops with a message telling the developer to run `npm run db:up` instead of hanging.
- [ ] When `laguardia_e2e_test` does not exist, the run creates it and proceeds.
- [ ] Reset, migrate and seeding happen before the e2e server serves its first request; after the reset, before any test, the database holds exactly one team member account, the e2e technician.
- [ ] Two back-to-back full local runs start from the same state: the second passes with the same results as the first and its tables contain only the data of that run.
- [ ] The e2e server's `DATABASE_URL` and `BETTER_AUTH_URL` are set explicitly for it – the e2e database URL derived like `TEST_DATABASE_URL`, never from `DATABASE_URL`; login works on port 3100, including the CSRF test of `e2e/security.spec.ts`.
- [ ] The e2e technician is created through the Team module's own setup (the non-interactive path of the first-technician setup, no copied Team logic, no hand-written SQL); with `E2E_TEAM_USERNAME` / `E2E_TEAM_PASSWORD` set, the browser tests that need a technician account run and pass locally.
- [ ] With `E2E_TEAM_USERNAME` / `E2E_TEAM_PASSWORD` unset, no account is seeded and the account-dependent specs skip as they do today.
- [ ] A password the Team module rejects (under 10 characters) fails the run with the Team module's message.
- [ ] The reset guard is covered by a unit test: `laguardia`, `laguardia_e2e` and a production-looking database name are refused, each with the database name in the error message.
- [ ] On a fresh clone, with `.env.development.local` filled in from `.env.example`, `npm run db:up` is the only preparation the local browser tests need – no `db:migrate:dev`, no `setup:first-technician` and no manual account.
- [ ] `npm run verify -- --e2e` stays the one command for a local run including browser tests; `npx playwright test` alone behaves the same.
- [ ] With `BASE_URL` set (runs against a deployed preview, `.github/workflows/e2e-preview.yml`) no reset and no local server start happen; the same tests are skipped as before.
- [ ] `npm run build` and `npm run typecheck` stay green with the `distDir` change, and a plain build still writes to `.next`.
- [ ] `.env.example` lists the variables a fresh clone needs for the local browser tests (`BETTER_AUTH_SECRET`, `E2E_TEAM_USERNAME`, `E2E_TEAM_PASSWORD`); the engineering conventions (`.claude/skills/engineering-conventions/SKILL.md`, Tests section and the seam catalog's browser-test row), `README.md` and `.env.example` say which database (`laguardia_e2e_test`), port (3100) and `distDir` (`.next-e2e`) the local browser tests use, that the database is reset on every run and that the development database is never touched by tests. The conventions edit is confirmed by the user in the pull request.

## Out of Scope
- Seeding the preview database for browser tests against a deployed preview (ST-068)
- Changing what the browser tests assert
- A search on the team member page (ST-081)
- Cleaning up test data already left in a developer's development database
- The CI `verify` job – it runs no browser tests and stays unchanged
- Per-spec database isolation and parallel Playwright workers
- A `db:reset:e2e` script for manual debugging (only if asked for later)

## Open Questions
- none

## Notes
- **Built out of turn, before ST-010** (user, 2026-10-02, story review `docs/reviews/2026-10-02-story-review.md`): at `should` the generated backlog sorts this task behind the open `must` stories, so it is started with an explicit `/implement ST-083`, never the bare `/implement`. ST-010 is the first visitor story and adds browser tests – cheaper to isolate the browser-test database first.
- Priority `should`, size **M**, risk **medium** (story review 2026-10-02): the second dev server needs its own `distDir`, a Next.js config change with side effects; the reset guard is destructive and must not be loosened. Conventions only, no ADR – no stack choice changes.
