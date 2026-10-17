---
id: ST-068
title: Browser test of the real visitor problem report flow
type: tech-task
context: BC-Repair
priority: could
size: M
risk: medium
events: []
depends_on: [ST-007, ST-013, ST-059]
labels: [follow-up, foundation]
status: ready
---

## Task
Follow-up of ST-059 (CI and test harness): `docs/reviews/ST-059-code-review.md` finding #15 (follow-up section) and `docs/reviews/ST-059-acceptance.md` ("Edge cases not covered by the story": the one browser test is coupled to the throwaway spike page). Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

**State on 2026-10-17 (text refreshed in the backlog grooming of 2026-10-17).** The spike browser test is gone (ST-078 deleted the spike code, ST-066 the spike configuration and data). The real visitor flow of ST-010 and ST-013 **already has a browser test**: `e2e/report-problem.spec.ts` (ST-013) – a visitor opens the visitor machine page by its museum number, reports a problem and sees the confirmation, at 360 px. It runs **locally only**: it registers its machine through the team pages with the e2e technician that each local run creates (ST-083), and it skips itself when `BASE_URL` is set, i.e. in `.github/workflows/e2e-preview.yml` against the Vercel preview.

**What is missing on the preview**, and what this task builds:
- the preview's database branch has **no machine on display** and **no technician account** to register one – so the test needs a machine seeded into the preview's database branch;
- the workflow has **no connection to the preview's database branch** for such a seed step;
- so the visitor flow is not tested against a deployed preview, and the ST-059 criterion "at least one browser test runs at 360 px width against a deployed preview" is carried by `e2e/security.spec.ts` alone.

The task makes the visitor flow's browser test run against the commit's Vercel preview in `.github/workflows/e2e-preview.yml` as well – by seeding a machine (below) and letting `e2e/report-problem.spec.ts`, or a preview variant of it, use that machine instead of registering one through the team pages.

The test needs a machine that is on display in the preview's database. Decided in the story review of 2026-09-27 (`docs/reviews/2026-09-27-story-review-st-067-073.md`, decision 2): a seed step in the browser-test workflow registers the machine through `CMD-RegisterMachine` (ST-007) in the preview's Neon database branch, so the event journal stays consistent, with a fixed museum number reserved for tests. It runs only against preview database branches, never production; the connection comes from the CI step built by this task (below).

**Preview database connection (moved from ST-075 on 2026-09-27).** Decided in the story review of 2026-09-27 (`docs/reviews/2026-09-27-story-review-st-067-073.md`, decision 2) as a separate task, merged back into this one by the backlog restructuring of 2026-09-27. The seed step needs a step in `.github/workflows/e2e-preview.yml` that obtains the database connection of the Neon branch belonging to the pushed commit's Vercel preview (`docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`) and hands it to the following steps. How the connection is obtained – through the Vercel/Neon integration, the Vercel API or the Neon API – is left to engineering; the criteria below hold for any mechanism.

## Acceptance Criteria
- [ ] A seed step in `.github/workflows/e2e-preview.yml`, run before the browser test, registers a machine with the fixed test museum number (a valid given museum number, "LG-" plus three digits, ST-007) and the initial machine status *Playable* through `CMD-RegisterMachine` in the preview's database branch, using the connection from the step below; the machine model it needs is created through `CMD-CreateMachineModel` (ST-006) if it does not exist yet; both are journaled like any other command (`EVT-MachineModelCreated`, `EVT-MachineRegistered`).
- [ ] The seed step is repeatable: when the machine model or the machine with the test museum number already exists in the preview's database branch, the step leaves it as it is and succeeds.
- [ ] The seed step runs only against a preview database branch: it relies on the production guard of the connection step below and never receives a production connection.
- [ ] A browser test at 360 px width opens the visitor machine page of a machine that is on display, reports a problem with a description, and sees the confirmation in the visitor's language.
- [ ] The same test asserts that the visitor machine page and the report form have no horizontal scrolling at 360 px width (page width ≤ 360 px).
- [ ] The test runs in `.github/workflows/e2e-preview.yml` against the commit's Vercel preview and is green there; the run is linked as evidence.
- [ ] The test uses neither the spike password nor the machine `"test-machine"`; the browser test needs no secret other than `VERCEL_AUTOMATION_BYPASS_SECRET`, and the seed step none other than those of the connection step below.
- [ ] The test does not depend on data left behind by earlier runs: a second run against the same preview is green as well.
- [ ] The visitor problem report flow's browser test no longer skips itself against the preview: it runs locally as today (machine registered by the local e2e technician, ST-083) and against the preview with the seeded machine.
- [ ] The browser test job still finishes in under 10 minutes including waiting for the preview (ST-059).

### Foundation (moved from ST-075 on 2026-09-27 – preview database connection, story review decision 2)
- [ ] After the existing "Wait for the Vercel preview of this commit" step, a step in `.github/workflows/e2e-preview.yml` makes the database connection of the Neon branch used by that commit's preview deployment available to the following steps of the same job (e.g. as a masked environment variable).
- [ ] The connection belongs to the same preview the browser tests run against: a following step that reads a row written through that preview (or the Neon branch name/ID reported for the preview deployment) confirms it; the run is linked as evidence.
- [ ] The step never yields the production database: when the connection it obtains points to the production branch, the step fails before any later step uses it; demonstrated with a deliberate change (e.g. pointing it at the production branch's ID) and then reverted.
- [ ] When the preview's database branch cannot be found or the API call fails, the step retries within the job's time limit and then fails with a message that names the reason; it never falls back to another branch.
- [ ] The connection string and every token the step needs never appear in the job log (masked); the step prints at most the branch name or ID.
- [ ] Every token the step needs is stored as a GitHub Actions secret and, so that Dependabot branches run the workflow as well, as a Dependabot secret with the same name; the token's scope is as narrow as the provider allows (read access to the project's preview branches), and its name and purpose are documented in `.env.example` next to `VERCEL_AUTOMATION_BYPASS_SECRET`.
- [ ] The workflow's `permissions` stay minimal (no new GitHub permission beyond what the step needs).

## Out of Scope
- The separate Blob store and other preview environment settings (ST-061)
- The spike scaffolding – removed by ST-078 (code) and ST-066 (configuration and data), both done
- Making "Browser tests on preview" a required check for merging into `main` (`docs/reviews/ST-059-code-review.md` finding #16, to be decided e.g. in ST-061)
- Browser tests for further flows (team login, triage, maintenance)
- Photos on problem reports (ST-016)

## Open Questions
- none – how the preview gets a machine on display was answered in the story review of 2026-09-27: seeded through `CMD-RegisterMachine` with a fixed test museum number, preview branches only, never production (see Task).

## Notes
- `must` → `should` in the backlog grooming of 2026-10-11 (user decision of 2026-10-12, conflict B): built after go-live; until then the flow is covered locally by `e2e/report-problem.spec.ts`. `should` → `could` in the backlog grooming of 2026-10-17 (PO): the local browser test covers the flow; the preview part belongs to the hosting block.
- **Belongs to the hosting block** (user, 2026-10-17: hosting, operations and go-live deferred to the end): build it after ST-065 (museum Pro team) and ST-061 (environments and operations, incl. the preview's own Blob store), together with that block. It deliberately has **no** `depends_on` on them – they are `wont` for now, and a dependency on a `wont` story would block it formally. Start it by name, `/implement ST-068`, once ST-065 and ST-061 are done.
- The acting person of the seed step (`CMD-RegisterMachine` is for technicians only) is decided in this story's test plan, when login (ST-004) and account management (ST-005) exist – user decision in the story review of 2026-09-27 (`docs/reviews/2026-09-27-story-review-st-067-073.md`, decision 6).
