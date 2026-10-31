---
id: ST-112
title: Background work for AI – worker route, holds, run budget and continuation
type: tech-task
context: BC-AiAssistance
priority: should
size: M
risk: high
events: []
depends_on: [ST-105]
labels: [foundation, feature:ai-assessment]
status: ready
---

## Task
Builds the foundation of `docs/adr/0015-background-ai-work-with-state-in-the-database.md` that ST-106 (indexing),
ST-107 (writing AI assessments), ST-108 (break-offs, the daily retry) and ST-109 (retrying failed files) all run on:
the worker route, the technical holds, a run with its budget and its self-continuation, and how a story tests a run.
Split out of ST-106 by the story review `docs/reviews/2026-10-31-ai-assessment-story-review.md` (user, 2026-10-31) –
groundwork several stories need is a tech task, not a hidden Definition of done (ST-050/ST-079 precedent).

It brings no kind of work of its own: indexing a file is the first kind (ST-106), writing an AI assessment the second
(ST-107). A run takes the kinds in a fixed order – AI assessments still requested before waiting files, because a
person is waiting (ADR 0015) – and this task proves the mechanism with a stand-in kind in its tests only. The daily cron
job in `vercel.json` is ST-108's; this task only names how a story tests it.

Depends on the spike ST-105: its verdict decides whether a run must store the progress of a large PDF page by page, which
changes what a hold covers and how a run continues. The spike's result is summarised in the Notes below before this
task is built.

## Acceptance Criteria
- [ ] ADR 0015 is accepted by the user before this task is built; the result of ST-105 is in the Notes below and followed.
- [ ] The local and the CI database image is `pgvector/pgvector:pg17` (`docker-compose.yml`, `.github/workflows/ci.yml`; ADR 0014); a migration enables the `vector` extension, and it runs on Neon for previews and production.
- [ ] One worker route `/api/ai-work` (a route handler, `maxDuration = 800`, more memory only if ST-105 asks for it) accepts only requests carrying the deployment's `CRON_SECRET`; a request without it or with a wrong one is refused and starts nothing. It answers at once and does the run in its own `after()`.
- [ ] One function starts the AI work after a response: a Server Action calls it in `after()` once its command has committed, and it calls the worker route with the secret from the server's environment – the secret never reaches a page, a link or the browser. On previews the call also carries Vercel's "Protection Bypass for Automation" secret.
- [ ] A run holds what it works on: one piece of work at a time (a file or an AI assessment), held in a small technical hold record (not domain state, `docs/architecture/data-model.md`) taken in a short transaction with `FOR UPDATE SKIP LOCKED`. Two runs started at the same moment never take the same piece; a hold runs out after 15 minutes (HS-33) and the piece can be taken again. No database connection or transaction is held during the slow part.
- [ ] A run stops taking new work once its budget (about 600 of its 800 seconds) is used, and if work is left it calls the worker route again before it ends; with no work left it ends without a call.
- [ ] The run is one function with the clock, the database, the AI seam (ST-104), the storage seam and the call of the worker route injected; a test drives one run directly and never waits for a real background run (ADR 0015, *Tests*).
- [ ] `.claude/skills/engineering-conventions/SKILL.md` gets the section *Background work* (ADR 0015's follow-up) – worker route, holds, budget, continuation, the order of the kinds of work, how a story adds a kind and tests a run – and the seam catalog gets three rows, decided by the user in this task's test plan: **the run function** (driven directly with the injected clock and stand-ins), **the worker route** (written as `workerRoute(dependencies)` like `uploadRoute`, tested with real requests), and **the `vercel.json` cron scan** (a test reads `vercel.json` and checks a cron's path and schedule – first used by ST-108).
- [ ] `docs/operations/` gets the steps to create `CRON_SECRET` per environment and the preview bypass secret, and what happens when either is missing (the self-call fails; a broken chain waits for the next start or, in production, the night).
- [ ] The pull request goes through the normal review lane plus `/code-review` (shared platform code) and `/security-review` (a route accepting a secret that starts paid work).

## Notes
- Result of the spike ST-105: *to be filled in by ST-105.*
- Built out of turn on purpose: ST-106 depends on it, so the generated backlog pulls it in front of ST-106 although its
  number is higher. Feature order (user, 2026-10-31): ST-104 → ST-105 → ST-112 → ST-106 → ST-107 → ST-108 → ST-109 →
  ST-110 → ST-111.
- Size M, risk high – estimated in the story review (2026-10-31): unknown limits of self-calls on previews, the first
  route that starts paid work, and connection handling during a run of up to 800 seconds against a database that scales
  to zero.
