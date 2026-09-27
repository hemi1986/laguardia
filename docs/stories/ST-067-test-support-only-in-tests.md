---
id: ST-067
title: Test support is only imported by tests
type: tech-task
context: BC-Repair
priority: should
size: XS
risk: low
events: []
depends_on: [ST-003]
labels: [follow-up, foundation]
status: ready
---

## Task
Follow-up of ST-059 (CI and test harness): `docs/reviews/ST-059-code-review.md` finding #14 (follow-up section). Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

`src/test-support/` holds the test-data builders, the test database connection and `resetTestDatabase`, which drops and re-migrates schemas. Application code must never import it. Today no lint rule stops that, because `eslint.config.mjs` has no module boundary rules yet; ST-003 introduces them (ADR 0002: "boundaries … enforced by import rules").

Extend the module boundary rules from ST-003 (e.g. with the boundary plugin ST-003 chooses, or `no-restricted-imports`) so that `src/test-support/` may be imported only by:
- unit tests (`*.test.ts`) and integration tests (`*.integration.test.ts`),
- browser tests and their fixtures under `e2e/`,
- the Vitest and Playwright configurations (`vitest.config.ts`, `playwright.config.ts`),
- other files inside `src/test-support/` itself.

## Acceptance Criteria
- [ ] A deliberate import of `src/test-support/` (both via the `@/test-support/…` alias and via a relative path) from application code – a module file under `src/modules/` and a file under `src/app/` – makes `npm run lint` fail with a message that names test support as test-only; demonstrated and then removed.
- [ ] Imports of `src/test-support/` from a `*.test.ts` file, a `*.integration.test.ts` file, a file under `e2e/`, `vitest.config.ts` and `playwright.config.ts` pass the lint.
- [ ] The rule is part of the lint step of `npm run verify`, so it runs on every push in CI (ST-059).
- [ ] The existing code base passes the rule without exceptions or disable comments.

## Out of Scope
- The module boundary rules between Collection, Repair, Maintenance and Team (ST-003)
- The other ST-059 code review findings (#1–#13, #15, #16)

## Open Questions
- none
