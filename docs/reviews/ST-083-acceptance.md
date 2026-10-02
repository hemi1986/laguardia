# Acceptance – ST-083: Local browser tests run against a database of their own
Date: 2026-10-02 · Tests run: `npx vitest run src/test-support` → 15 passed; `npx playwright test` (port 3100) → 35 passed, 0 failed · Preview: none (CI on the branch reported green by the implementer; not re-checked)

## Checklist (tech task – evidence per item)
| # | Item | Evidence | OK? |
|---|---|---|---|
| 1 | Full run leaves dev DB counts unchanged | Manual (counts 18/16/8 before/after); structurally: `scripts/e2e-server.ts` sets `DATABASE_URL` explicitly to the e2e URL, derived from `testDatabaseUrl()` | yes (manual, to be noted in the PR) |
| 2 | Aborted run leaves dev DB untouched | Manual (run aborted after 18 tests) | yes (manual) |
| 3 | Own server on 3100, distDir `.next-e2e`, `laguardia_e2e_test` | `playwright.config.ts` webServer, `next.config.ts` `NEXT_DIST_DIR`; 35 tests pass on 3100 | yes |
| 4 | Dev server on 3000 is neither used nor stopped | Manual (200 before/after); no lock error in my run | yes (manual) |
| 5 | Port 3100 taken -> clear message | `reuseExistingServer: false`; manual message seen | yes (manual) |
| 6 | PostgreSQL down -> `npm run db:up` message | Manual; message comes from `resetDatabase` | yes (manual) |
| 7 | Missing database is created | `e2e-database.integration.test.ts` (drops, prepares) + manual DROP | yes |
| 8 | Reset/migrate/seed before first request; exactly one account | Prepare runs before `spawn("next dev")` in `e2e-server.ts`; test asserts exactly `[{e2e_tech, technician}]` and 0 machine models after a re-prepare | yes |
| 9 | Back-to-back runs equal | Test "again after a second preparation" (left-over row gone); my run passed on top of earlier runs | yes |
| 10 | Explicit `DATABASE_URL`/`BETTER_AUTH_URL`, login and CSRF work | `e2e-server.ts` env; URL test (`/laguardia_e2e_test`, host of test DB); `security.spec.ts` CSRF tests pass | yes |
| 11 | Technician via Team module's setup, no copied logic/SQL | `setUpFirstTechnician` + shared `firstTechnicianProblem`; login test with `logIn` | yes |
| 12 | E2E_TEAM_* unset -> no account | Test "seeds no account when no e2e technician is configured" (specs skip as before – not re-run without variables) | yes |
| 13 | Short password -> Team module's message | Test with the exact message | yes |
| 14 | Guard unit test (3 names, name in the message) | `reset-test-database.test.ts`, literals asserted (`Refusing to reset "<name>"`) | yes |
| 15 | Fresh clone: only `npm run db:up` | `.env.example`, README; db is created by prepare. Not run on a real fresh clone | yes (by reading) |
| 16 | `verify -- --e2e` and `playwright test` alike | `verify.ts` runs `test:e2e` = `playwright test` | yes |
| 17 | `BASE_URL` set -> no reset, no server | `webServer: baseURL ? undefined`, prepare lives only in the server script; CI preview job green (per implementer) | yes |
| 18 | build/typecheck green, plain build writes `.next` | Manual (implementer); `distDir` defaults to `.next` | yes (manual) |
| 19 | Docs: `.env.example`, README, conventions | Diffs seen for `.env.example`, README, conventions file changed; conventions edit still needs the user's confirmation in the PR | yes, pending user confirmation |

Note on test quality: the guard and database tests assert literals from the story (names, message text, `/laguardia_e2e_test`). The integration test uses a separate `laguardia_e2e_prepare_test`, so it never resets the live e2e database. Items 5, 6, 12 (specs skipping) and 17 have no automated test – acceptable, the story says "checked by hand" or they are structural.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px, list speed, journal, message catalogs, personal data in logs | no (no product behaviour) | – | n/a |
| Tests first, traceability | tech task: checklist | see above | yes |
| Secrets | yes | `.env*` ignored, `.env.example` has only the empty `E2E_TEAM_PASSWORD`; `.next-e2e` ignored, eslint-ignored | yes |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| `.env.local` from `vercel env pull` (production-like `DATABASE_URL`): Playwright/`e2e-server.ts` load only `.env.development.local`; Next loads `.env.local` too, but the explicit `DATABASE_URL` in the child env wins, and the reset guard allows only `*_test` | no rule violated; risk covered | none |
| `TEST_DATABASE_URL` pointing at a real server in the shell: e2e URL derives from it, guard still requires `_test` suffix | covered by guard | none |
| `next-env.d.ts` (gitignored) is rewritten by whichever dev server ran last; right now it imports `.next-e2e/dev/types/...`. On a fresh clone or after deleting `.next-e2e` before `next dev`/build regenerates it, `npm run typecheck` could fail on a missing file; tsconfig includes both distDirs | no | question: observed on a clean clone? If so fix here (about 30 min); not a follow-up story (no security/data-loss risk) |
| Windows: `spawn("npx", …)` without a shell fails with ENOENT; docs assume macOS/Linux/Docker | no rule | question – no Windows user named in the vision; no action |
| Stale `.next-e2e` after a killed (`kill -9`) run: Next's lock is file-based and released with the process | none | none |
| E2E_TEAM_USERNAME set but password unset (or vice versa): silently no account, specs skip | story only says "unset" | question – a warning would help, minor |
| Another process holds connections to `laguardia_e2e_test` (a leftover server) while the reset drops it | none | none (port 3100 check prevents it in the normal case) |
| Seeded name "E2E Technician" is fixed; the technician's own dev DB account is separate | none | none |
| The branch diff also contains ST-009 work (machine record, eslint `*.test-support` rule); the ST-083 review scope should be the ST-083 commits only | – | remark: the eslint policy change is not part of ST-083 and is covered by ST-009's review |

Follow-up hurdle: no gap meets all three conditions; nothing needs a new story.

## Verdict
accepted with remarks – remarks: (1) the manual evidence (items 1, 2, 4, 5, 6, 18 and the abort/port checks) must be noted in the PR; (2) the user still confirms the conventions edit in the PR; (3) check the `next-env.d.ts` / missing `.next-e2e` typecheck case on a clean clone.
