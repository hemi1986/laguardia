# Story review 2026-10-02 – ST-083

Reviewed: `docs/stories/ST-083-own-database-for-local-browser-tests.md` (tech task, draft). Reviewers: product-owner,
lead-dev. No ux-designer: the story has no screen – it changes how local browser tests are run.

## ST-083 – Own database for local browser tests

### Product owner – approve with changes, priority **should**
- Value is concrete: the local browser tests are part of the verify gate, and they polluted and broke the development
  data (272 test accounts, ~180 machine models, timeouts, a manual wipe). Fits the vision's reliability goal, no
  non-goal touched.
- Priority: `should`, not `must` – it is not on the MVP path; `must` would dilute that signal. Build it **before
  ST-010** anyway, as a deliberate out-of-turn build with an explicit `/implement ST-083` (ST-010 is the first visitor
  story and adds browser tests – cheaper to isolate first). Accepts `must` if the user prefers it.
- Scope is right (local only; preview runs, ST-068's preview seed and cleaning existing dev data out).
- Change requests: an aborted or failed run also leaves the development database untouched (the reason deleting
  afterwards was rejected); a clear error when the e2e port is taken; a clear "run `npm run db:up`" when PostgreSQL is
  not running; the e2e database is created when missing; reword the ST-081 note – ST-081 (search on the members page)
  is a product need on its own, not replaced by faster tests; no `depends_on`.

### Lead dev – approve after text changes, **size M, risk medium**, no split
- **Pitfall that changes the size:** Next.js 16 takes a lock per `distDir` (`<distDir>/dev/lock`, "Another next dev
  server is already running" – `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`). A second
  `next dev` beside the developer's server on 3000 needs **its own `distDir`** (inside the project, set through an
  environment variable in `next.config.ts`, default `.next` so Vercel builds are unchanged) – a Next.js config change
  with side effects on `.gitignore`, `tsconfig`, eslint ignores and `next typegen`.
- **Database name:** the reset guard accepts only names ending in `_test`. Use `laguardia_e2e_test` (consistent with
  `laguardia_<name>_test` of `isolatedTestDatabase`) rather than loosening a destructive guard.
- **Environment:** the e2e server's `DATABASE_URL` and `BETTER_AUTH_URL` must be set explicitly (they override
  `.env.development.local`); the e2e database URL is derived like `TEST_DATABASE_URL`, never from `DATABASE_URL`.
  Login and the CSRF test depend on `BETTER_AUTH_URL` matching the e2e port.
- **Order:** Playwright starts `webServer` before `globalSetup` – reset, migrate and seed must happen before the server
  serves (e.g. in the server's start command); `reuseExistingServer: false` for the e2e server. `server-only` and the
  `@/` alias mean the seed runs as a script with the flags of `setup:first-technician`, which needs a non-interactive
  path (no copied Team logic).
- Missing behaviour: `E2E_TEAM_*` unset → no seed, account specs skip as today; a password under 10 characters fails
  the run with the Team module's message; `.env.example` lists the variables.
- Testability: the guard is a unit test (`laguardia`, `laguardia_e2e` and a production-looking name refused, the name
  in the message); "after the reset the database holds exactly the e2e technician"; row counts in the dev database
  once by hand, noted in the PR; with `BASE_URL` set no reset and no server start.
- First step of the task (~30 min): prove a second `next dev` with its own `distDir` runs beside one on 3000; if not,
  `[OPEN]` and back to review. No separate spike story. CI's `verify` job runs no browser tests – nothing changes there;
  run `npm run build` once because `next.config.ts` changes.
- Conventions only, no ADR (no stack choice changes); the engineering-conventions edit needs the user's confirmation.

### Conflicts
- Priority: PO `should` vs. story `must` – user decides.
- Size/risk: story S/low vs. lead dev M/medium – no counter-argument; adopt.

## Proposed new stories, spikes, tech tasks
- None. Optional later: a `db:reset:e2e` script for manual debugging (only if asked).

## Decisions (user, 2026-10-02)
1. Priority **should**; built before ST-010 with an explicit `/implement ST-083` (Notes).
2. Database name **`laguardia_e2e_test`** – the `_test` guard stays as strict as it is.
3. Port **3100** and `distDir` **`.next-e2e`**, fixed and documented; a clear error when the port is taken; Vercel builds
   keep `.next`; first step of the task proves two dev servers side by side, otherwise `[OPEN]` and back to review.
4. All other change requests of both reviewers adopted as recommended (size M, risk medium, the added criteria, the
   ST-081 note reworded, conventions only – no ADR).
