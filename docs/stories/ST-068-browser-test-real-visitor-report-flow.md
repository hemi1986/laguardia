---
id: ST-068
title: Browser test of the real visitor problem report flow
type: tech-task
context: BC-Repair
priority: must
size: S
risk: medium
events: []
depends_on: [ST-007, ST-013, ST-059, ST-075]
labels: [follow-up, foundation]
status: ready
---

## Task
Follow-up of ST-059 (CI and test harness): `docs/reviews/ST-059-code-review.md` finding #15 (follow-up section) and `docs/reviews/ST-059-acceptance.md` ("Edge cases not covered by the story": the one browser test is coupled to the throwaway spike page). Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

The only browser test, `e2e/report-problem.spec.ts`, drives the ST-001 spike test page: it enters the spike password (`SPIKE_PASSWORD`) and reports a problem for the hard-coded machine `"test-machine"`. ST-066 removes that page, the password and the test machine. Without a replacement, the pipeline would be left with no browser test at 360 px, and the ST-059 criterion "at least one browser test runs at 360 px width against a deployed preview" would no longer hold.

Replace the spike browser test with a browser test of the real visitor flow from ST-010 and ST-013, run against the commit's Vercel preview by the existing workflow `.github/workflows/e2e-preview.yml`: a visitor opens the visitor machine page of a machine by its museum number and reports a problem. This task must be done before or together with ST-066, so at least one browser test keeps running at all times.

The test needs a machine that is on display in the preview's database. Decided in the story review of 2026-09-27 (`docs/reviews/2026-09-27-story-review-st-067-073.md`, decision 2): a seed step in the browser-test workflow registers the machine through `CMD-RegisterMachine` (ST-007) in the preview's Neon database branch, so the event journal stays consistent, with a fixed museum number reserved for tests. It runs only against preview database branches, never production; the connection comes from the CI step of ST-075.

## Acceptance Criteria
- [ ] A seed step in `.github/workflows/e2e-preview.yml`, run before the browser test, registers a machine with the fixed test museum number (a valid given museum number, "LG-" plus three digits, ST-007) and the initial machine status *Playable* through `CMD-RegisterMachine` in the preview's database branch, using the connection from ST-075; the machine model it needs is created through `CMD-CreateMachineModel` (ST-006) if it does not exist yet; both are journaled like any other command (`EVT-MachineModelCreated`, `EVT-MachineRegistered`).
- [ ] The seed step is repeatable: when the machine model or the machine with the test museum number already exists in the preview's database branch, the step leaves it as it is and succeeds.
- [ ] The seed step runs only against a preview database branch: it relies on ST-075's production guard and never receives a production connection.
- [ ] A browser test at 360 px width opens the visitor machine page of a machine that is on display, reports a problem with a description, and sees the confirmation in the visitor's language.
- [ ] The same test asserts that the visitor machine page and the report form have no horizontal scrolling at 360 px width (page width ≤ 360 px).
- [ ] The test runs in `.github/workflows/e2e-preview.yml` against the commit's Vercel preview and is green there; the run is linked as evidence.
- [ ] The test uses neither the spike password nor the machine `"test-machine"`; the browser test needs no secret other than `VERCEL_AUTOMATION_BYPASS_SECRET`, and the seed step none other than those of ST-075.
- [ ] The test does not depend on data left behind by earlier runs: a second run against the same preview is green as well.
- [ ] `e2e/report-problem.spec.ts` (the spike test) is removed or rewritten, so no browser test references the spike page any more.
- [ ] The browser test job still finishes in under 10 minutes including waiting for the preview (ST-059).

## Out of Scope
- Removing the spike scaffolding itself (ST-066)
- Making "Browser tests on preview" a required check for merging into `main` (`docs/reviews/ST-059-code-review.md` finding #16, to be decided e.g. in ST-061)
- Browser tests for further flows (team login, triage, maintenance)
- Photos on problem reports (ST-016)

## Open Questions
- none – how the preview gets a machine on display was answered in the story review of 2026-09-27: seeded through `CMD-RegisterMachine` with a fixed test museum number, preview branches only, never production (see Task).

## Notes
- The acting person of the seed step (`CMD-RegisterMachine` is for technicians only) is decided in this story's test plan, when login (ST-004) and account management (ST-005) exist – user decision in the story review of 2026-09-27 (`docs/reviews/2026-09-27-story-review-st-067-073.md`, decision 6).
