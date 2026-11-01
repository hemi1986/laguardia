---
id: ST-112
title: Background work for AI – worker route, holds, run budget and continuation
type: tech-task
context: BC-AiAssistance
priority: should
size: M
risk: medium
events: [EVT-AiWorkLeftUnfinished]
depends_on: [ST-104, ST-105]
labels: [foundation, feature:ai-assessment]
status: in-progress
---

## Task
Builds the foundation of `docs/adr/0015-background-ai-work-with-state-in-the-database.md` that ST-106 (indexing),
ST-107 (writing AI assessments), ST-108 (failed and broken-off AI assessments) and ST-109 (failed and broken-off files)
all run on: the worker route, the technical holds, a run with its budget and its self-continuation, the step that fails
what broke off, and how a story tests a run. Split out of ST-106 by the story review
`docs/reviews/2026-10-31-ai-assessment-story-review.md` (user, 2026-10-31) – groundwork several stories need is a tech
task, not a hidden Definition of done (ST-050/ST-079 precedent).

It brings no kind of work of its own: indexing a file is the first kind (ST-106), writing an AI assessment the second
(ST-107). A run takes the kinds in a fixed order – AI assessments still requested before waiting files, because a
person is waiting (ADR 0015) – and this task proves the mechanism with a stand-in kind in its tests only.

There is **no scheduled job and no automatic retry** (user, 2026-11-01, D3 in `docs/reviews/2026-11-01-story-review.md`;
ADR 0002's "no scheduler or cron job" holds). A run is started only after a response: by a Server Action that made work
(saving the AI settings, a request, attaching a file, „Erneut versuchen“), by its own continuation, or by a page that
sees a hold ran out (the defect page, ST-108; the form „KI“, ST-109 – HS-33, HS-35). Whatever started it, a run takes
all work that is left.

A piece of work is always whole: a run does a file or an AI assessment completely or not at all, and nothing of a
piece is carried from one run to the next (user, 2026-11-01, D1). What continues across runs is the queue – the pieces
still waiting –, never a half-done piece.

**Broken-off work – generic here, recorded per kind** (ADR 0015, *What breaks off fails, once*;
`POL-UnfinishedAiWorkFails`, `EVT-AiWorkLeftUnfinished`). The mechanism is the same for every kind and is built here:
a hold that ran out without a result is never taken again; the next run, before it takes new work, hands each such
piece to its kind and drops the hold in the same transaction. *Recording* the failure goes through each aggregate's
own command and therefore belongs to the kind: an AI assessment failed as *broken off* is ST-108, a file failed as
*broken off* is ST-109. This task proves the step with the stand-in kind.

## Acceptance Criteria
- [ ] ADR 0015 is accepted by the user before this task is built; the result of ST-105 is in the Notes below and followed.
- [ ] The local and the CI database image is `pgvector/pgvector:pg17` (`docker-compose.yml`, `.github/workflows/ci.yml`; ADR 0014); a migration enables the `vector` extension, and it runs on Neon for previews and production.
- [ ] One worker route `/api/ai-work` (a route handler, `maxDuration = 300` – the longest the current Vercel Hobby plan allows; a longer value fails the deployment) accepts only requests carrying the deployment's worker secret (an environment variable of its own, ADR 0015); a request without it or with a wrong one is refused and starts nothing. It answers at once and does the run in its own `after()`.
- [ ] One function starts the AI work after a response: a Server Action calls it in `after()` once its command has committed, and a page may call it in `after()` too; it calls the worker route with the secret from the server's environment – the secret never reaches a page, a link or the browser. A query tells a page whether a hold of a given kind has run out without a result, so the defect page (ST-108) and the form „KI“ (ST-109) start a run only then and refreshing them never starts work on every load.
- [ ] A run holds what it works on: one piece of work at a time (a file or an AI assessment), held in a small technical hold record (not domain state, `docs/architecture/data-model.md`) taken in a short transaction with `FOR UPDATE SKIP LOCKED`. Two runs started at the same moment never take the same piece. A hold lasts longer than a run's budget – its length is derived from the budget (ADR 0015), so a run never outlives its own hold – and it is never renewed. No database connection or transaction is held during the slow part. Storing a piece's result ends its hold in the same transaction. Test with the injected clock: a piece held by a run that was cut off is not taken by another run, neither before nor after its hold has run out.
- [ ] A run fails what broke off before it takes new work: every piece whose hold ran out without a result is handed to its kind's broken-off recording, and the hold is dropped in the same transaction. Test with the injected clock and the stand-in kind: after a cut-off run's hold has run out, the next run records the piece broken off exactly once – also when two runs start at the same moment – before it takes any waiting piece, and no later run takes or records it again.
- [ ] A run that gives a piece up on purpose – the stand-in reports that AI was turned off – ends its hold without a result and without a failure: the piece is waiting again, and a later run takes it and is not treated as broken off.
- [ ] A run stops taking new work once its budget is used; a piece already started is finished, never stored in part. The budget is a setting (about 250 s on Hobby; a self-hosted server gives it far more). Test with the injected clock: with the budget set to 10 s and 6 waiting stand-in pieces of 3 s each, the run starts 4 pieces (at 0, 3, 6 and 9 s), takes no fifth, and calls the worker route exactly once before it ends.
- [ ] A waiting queue longer than one run's budget is continued by the next run: in the same test, the run started by that call takes the remaining 2 pieces and ends without calling the worker route; each of the 6 pieces is done exactly once. With no work left a run ends without a call.
- [ ] The run is one function with the clock, the budget, the database, the AI seam (ST-104), the storage seam and the call of the worker route injected; a test drives one run directly and never waits for a real background run (ADR 0015, *Tests*).
- [ ] `docs/engineering/conventions.md` gets the section *Background work* (ADR 0015's follow-up) – worker route, holds, budget, continuation, broken-off work, the order of the kinds of work, how a story adds a kind (its work and its broken-off recording) and tests a run – and the seam catalog gets two rows, decided by the user in this task's test plan: **the run function** (driven directly with the injected clock and stand-ins) and **the worker route** (written as `workerRoute(dependencies)` like `uploadRoute`, tested with real requests). The third row once planned, the `vercel.json` cron scan, is void – there is no cron (D3).
- [ ] `docs/operations/` gets the steps to create the worker secret per environment and the budget setting, and what happens when the secret is missing: the self-call fails and a broken chain waits for the next start (an attached file, a request, saving the AI settings, „Erneut versuchen“, or a page that sees a hold ran out). It says that there is no scheduled job.
- [ ] The pull request goes through the normal review lane plus `/code-review` (shared platform code) and `/security-review` (a route accepting a secret that starts paid work, and pages that may start it).

## Notes
- Result of the spike ST-105 (2026-11-01, `docs/stories/ST-105-spike-indexing-the-largest-manual.md`, *Result*): the project is on Vercel **Hobby** – a run has 300 s at most (≈ 250 s budget), not 800 s; the user will not buy Pro and expects to self-host later in Docker. A PDF page costs ≈ 0,89 s on Vercel (rendering 0,85 s), so a run indexes ≈ 280 pages; memory ≈ 320 MB, no extra memory needed.
- Decisions after the story review 2026-11-01 (user, D1, D2, D3): no design around the Hobby time limit – no page-by-page progress of a PDF across runs, no progress record, no renewal of a hold; the design targets a runtime without a short time limit. `maxDuration` is the literal 300 only so that the deployment on the current plan does not fail; it must be a literal in the route file (static route config), so only the budget can be a setting. Accepted limitation: on Hobby a piece that does not fit one run – a PDF of more than ≈ 280 pages – is cut off there and, once its hold has run out, fails as *broken off* (ST-106, ST-109). No cron job and no automatic retry: what fails or breaks off is tried again only by hand (D3).
- Testing during implementation is local, in the Docker setup (D2) – not on Vercel previews. Whether the self-call works on a protected preview deployment is not part of this task; no bypass secret is configured (ADR 0015).
- Built out of turn on purpose: ST-106 depends on it, so the generated backlog pulls it in front of ST-106 although its
  number is higher. Feature order (user, 2026-10-31): ST-104 → ST-105 → ST-112 → ST-106 → ST-107 → ST-108 → ST-109 →
  ST-110 → ST-111.
- Size M, risk medium – re-checked after D3: the cron job, its scan seam and the daily retry are gone; the generic
  broken-off step and the "has a hold run out" query come in, each one test on the same run function. What stays risky
  is the first route that starts paid work (security review) and connection handling during a run of up to 300 seconds
  against a database that scales to zero.
- A result is stored only while the run still holds the piece, in the transaction that ends the hold; a late result
  after the hold ran out records nothing – for files (`CMD-IndexFileForAi`, story review 2026-11-01) as for AI
  assessments (`CMD-WriteAiAssessment`'s version check). The hold step offers this as a conditional write.
