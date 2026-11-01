---
status: proposed
date: 2026-10-31
---

# 0015 – AI work runs in the background: found from the database, started after the response, continued by itself, retried by a daily cron

Supersedes, once accepted and for AI assistance only, two points of `docs/adr/0002-modular-monolith-state-based-persistence.md` (accepted, not edited): "no background workers" and "no scheduler or cron job". Everything else in ADR 0002 holds – the automatic policies of Collection, Repair and Maintenance stay synchronous, and *due*, *overdue* and the other time-based events stay computed on read. ADR 0009's cleanup of abandoned uploads is unchanged.

## Context and Problem
Feature `ai-assessment` brings the first work that cannot run inside a request: writing an AI assessment takes up to a few minutes (a chat completion with photos and page images), indexing a scanned 100 MB manual takes minutes, and turning AI on or changing the embedding model indexes every file of every machine and machine model – far longer than one function may run. The user decided: AI assessments and indexing run in the background, the defect page refreshes itself while an AI assessment is being written, and a daily job retries what a crash or a timeout left behind (`docs/domain/events.yaml`: `POL-RequestedAiAssessmentIsWritten`, `POL-AttachedFileIsIndexedForAi`, `POL-AiIndexFollowsTheSettings`, `POL-UnfinishedAiWorkIsRetried`, `RM-DefectAiAssessments`; user, 2026-10-31). ADR 0002 has neither background work nor a scheduler, and expected an outbox "if a policy ever needs to become asynchronous".

## Driving Requirements
- The team member does not wait on the page; the AI assessment shows "being written", then written or failed – `POL-RequestedAiAssessmentIsWritten`, `RM-DefectAiAssessments`
- Files are indexed in the background on attach and all of them when AI is turned on or the embedding model changes – `POL-AttachedFileIsIndexedForAi`, `POL-AiIndexFollowsTheSettings`
- Unfinished work is retried once a day – `POL-UnfinishedAiWorkIsRetried`, `EVT-AiWorkLeftUnfinished`
- **The project is on Vercel Hobby** (spike ST-105, 2026-11-01): a function runs **300 s at most**; a deployment with a longer `maxDuration` is refused. The user will not buy Pro and expects to run La Guardia later in a local Docker installation instead of Vercel and Neon (user, 2026-11-01) – the design must work with a short run and with no time limit at all. For comparison, Vercel Pro in `fra1` (ADR 0006): a function runs 300 s by default and at most 800 s (1800 s in beta); 2 GB memory by default, 4 GB at most; cron jobs on Pro may run every minute but only for production deployments; `after()` work counts against the function's duration – https://vercel.com/docs/functions/limitations, https://vercel.com/docs/cron-jobs/usage-and-pricing
- Minimal operating effort, one volunteer – `docs/product/vision.md`; the database scales to zero when idle (Neon, ADR 0006 cost estimate)
- The whole application runs locally in Docker without a cloud account – `docs/adr/0012-s3-compatible-object-storage.md`
- The state of every AI assessment and AI index entry is domain state that read models show – `docs/architecture/data-model.md`

## Considered Options
1. **Run the work inside the request** – rejected: the team member would wait minutes, and indexing everything does not fit any function's time limit.
2. **State in the database, a run started after the response (`after()`), continued by itself when its time is up, and a daily Vercel cron as safety net** – chosen.
3. **Vercel Workflow** (durable steps, retries, no duration limit) – rejected for now: the work's state would live twice – in Workflow's own store and in the domain tables the pages read –, it adds a compiler plugin, directives and a local "world" to the build and the tests, and it is a Vercel-only product right after ADR 0012 removed one for local parity. It becomes the better choice if the self-continuation proves unreliable or the amount of work grows by an order of magnitude.
4. **Vercel Queues** – rejected: the same second place for state, at-least-once delivery to handle anyway, a consumer function per topic and no local equivalent in the Docker setup.
5. **A frequent cron (every few minutes) as the only trigger** – rejected: it would wake the database all day and end its scale-to-zero, and an AI assessment would wait for the next tick.
6. **An outbox table** (ADR 0002's anticipated way) – not needed: the stored state already says what is left to do – AI assessments still *requested*, and files without an AI index entry for the current embedding model (*waiting*, derived) – so nothing extra is written in the triggering transaction and Collection's commands stay unaware of AI.

## Decision
- **The work is found, not sent.** A run of the AI work asks the database what is left: AI assessments still requested first (a person is waiting), then waiting files while AI is on – for the daily retry also the failed files HS-32 names. No message, no outbox, no data handed over from the triggering command.
- **One worker route** in the app (`/api/ai-work`, a route handler) does every run, configured with the plan's longest `maxDuration` (300 s on Hobby); the default memory is enough (ST-105: ≈ 320 MB for the largest manual). It accepts only requests carrying the deployment's `CRON_SECRET` (as Vercel's cron sends it), answers at once and does the run in its own `after()`. Requests from pages never run AI work in their own function.
- **Started after the response.** The Server Actions that make work – saving the AI settings, requesting an AI assessment, attaching a file, „Erneut versuchen“ – call the worker route in `after()` once their command has committed (a short request; the page does not wait for it). Per HS-33 (resolved), the defect page, refreshing itself while an AI assessment is being written, does the same once that AI assessment's hold has run out.
- **A run holds what it works on.** It takes one piece of work at a time and holds it for a limited time in a short transaction (`FOR UPDATE SKIP LOCKED` on a small technical hold record – file or AI assessment, held until; not domain state, `docs/architecture/data-model.md`), so several runs share the work instead of doing – and paying for – it twice. The slow part runs outside any transaction; the result is stored through the aggregate's command in one short transaction with its usual checks (still requested; file not removed, under the file's removal lock of ADR 0014).
- **Continued by itself.** A run stops taking new work once its budget (about 250 of its 300 seconds on Hobby; a setting, so a self-hosted server can give it far more) is used, and if work is left it calls the worker route again before it ends. Turning AI on with a few hundred files is therefore a chain of runs within minutes to an hour, not a wait for the next day.
- **Retried daily.** `vercel.json` gets one cron job calling the worker route once a day at night (Europe/Berlin). It finds whatever a broken chain, a crash or a deployment left behind (`EVT-AiWorkLeftUnfinished` is this derivation, not a record). Vercel runs crons only for production; previews and local development rely on the start after the response and the self-continuation.
- **Tests** drive one run directly through its function with the injected clock, database, AI seam (ADR 0014) and storage seam; the call of the worker route is an injected function. No test waits for a real background run.

- **A PDF's indexing keeps its progress page by page** (spike ST-105: 0,89 s per page on Vercel, so a run of 250 s indexes ≈ 280 pages and the largest manual has 568). A run takes a PDF, continues after the last page stored in its **progress record**, embeds pages until its budget is used and stores them there; the next run continues. When the last page is done, the AI index entry is replaced as a whole in one short transaction – the progress record is technical state like a hold (`docs/architecture/data-model.md`), never shown by a read model, so the invariant "indexing a file again replaces its AI index entry as a whole" holds unchanged. It names the embedding model it was made with; a record of another model is dropped and started again, and it is removed with its file (`POL-RemovedFileLeavesAiIndex`, same transaction) and when AI is turned off. Markdown, text and image files are small and stay one piece of work.
- **One item per embedding request, a few requests in parallel** (ST-105): OpenRouter routes a request with several inputs to an endpoint without zero data retention, which the provider rule refuses.

## Consequences
- Positive: no new service, store or product; the pages read the same tables the work writes; local development and CI run the same code; the database wakes only when there is work and once a day.
- Negative / cost:
  - A piece of work longer than one run's budget cannot finish in one run – measured by ST-105 (the largest manual needs ≈ 505 s); hence the page-by-page progress of a PDF above. Option 3 (Vercel Workflow) stays rejected: it is Vercel-only, and the user expects to leave Vercel.
  - Indexing all files after turning AI on is slower on Hobby (≈ 280 pages per run, ≈ 0,00019 $ per page) – a chain of runs, as intended.
  - The self-call can fail (a deployment in between, the protection of previews): previews need Vercel's "Protection Bypass for Automation" secret sent with the call; a broken chain waits for the next start or, in production, for the night.
  - New secrets per environment: `CRON_SECRET` (and the bypass secret on previews); `docs/operations/` gets the steps.
  - A run in progress during a deployment is cut off; its hold runs out and the next run takes the work again (HS-33 for AI assessments).
- Follow-up: the engineering conventions get a section *Background work* after the first story that builds it (the worker route, holds, budget, continuation, how a story tests a run).

## Open Points
- None. HS-32 and HS-33 are resolved as recommended (user, 2026-10-31): the daily retry indexes again only files that failed at OpenRouter; a hold lasts 15 minutes, a broken-off AI assessment is written once more and then failed as "timed out".
