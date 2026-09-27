---
id: ST-075
title: CI obtains the preview database connection for seeding
type: tech-task
context: BC-Repair
priority: must
size: S
risk: medium
events: []
depends_on: [ST-059]
labels: [follow-up, foundation]
status: ready
---

## Task
Follow-up of ST-059 (CI and test harness), decided in the story review of 2026-09-27 (`docs/reviews/2026-09-27-story-review-st-067-073.md`, decision 2). Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

ST-068 replaces the spike browser test with a browser test of the real visitor problem report flow. That test needs a machine that is on display in the preview's database; it is seeded through `CMD-RegisterMachine` in the preview's Neon database branch, so the event journal stays consistent – preview branches only, never production. The seed step itself belongs to ST-068. This task provides what the seed step needs: a step in the browser-test workflow `.github/workflows/e2e-preview.yml` that obtains the database connection of the Neon branch belonging to the pushed commit's Vercel preview (`docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`) and hands it to the following steps.

How the connection is obtained – through the Vercel/Neon integration, the Vercel API or the Neon API – is left to engineering; the criteria below hold for any mechanism.

## Acceptance Criteria
- [ ] After the existing "Wait for the Vercel preview of this commit" step, a step in `.github/workflows/e2e-preview.yml` makes the database connection of the Neon branch used by that commit's preview deployment available to the following steps of the same job (e.g. as a masked environment variable).
- [ ] The connection belongs to the same preview the browser tests run against: a following step that reads a row written through that preview (or the Neon branch name/ID reported for the preview deployment) confirms it; the run is linked as evidence.
- [ ] The step never yields the production database: when the connection it obtains points to the production branch, the step fails before any later step uses it; demonstrated with a deliberate change (e.g. pointing it at the production branch's ID) and then reverted.
- [ ] When the preview's database branch cannot be found or the API call fails, the step retries within the job's time limit and then fails with a message that names the reason; it never falls back to another branch.
- [ ] The connection string and every token the step needs never appear in the job log (masked); the step prints at most the branch name or ID.
- [ ] Every token the step needs is stored as a GitHub Actions secret and, so that Dependabot branches run the workflow as well, as a Dependabot secret with the same name; the token's scope is as narrow as the provider allows (read access to the project's preview branches), and its name and purpose are documented in `.env.example` next to `VERCEL_AUTOMATION_BYPASS_SECRET`.
- [ ] The workflow's `permissions` stay minimal (no new GitHub permission beyond what the step needs).
- [ ] The browser test job still finishes in under 10 minutes including waiting for the preview (ST-059).

## Out of Scope
- The seed step and the browser test of the visitor flow (ST-068)
- The separate Blob store and other preview environment settings (ST-061)
- Making "Browser tests on preview" a required check for merging into `main` (`docs/reviews/ST-059-code-review.md` finding #16)

## Open Questions
- none
