# AI work in the background – `AI_WORK_SECRET` and the run budget

Indexing files for AI and writing AI assessments run in the background (`docs/adr/0015-background-ai-work-with-state-in-the-database.md`,
ST-112). The server starts a run by calling its own worker route `/api/ai-work`; the route accepts only calls that carry
the **worker secret**. About 5 minutes per environment.

There is **no scheduled job** (no cron) and **no automatic retry**. A run is started only after something made work:
saving the AI settings, requesting an AI assessment, attaching a file, „Erneut versuchen“ – or a page that sees a piece
of work whose hold ran out (the defect page, the form „KI“). A run that has more work than its budget calls the worker
route again before it ends, so a long queue is a chain of runs.

## `AI_WORK_SECRET` – create it

```sh
openssl rand -base64 32
```

At least 32 characters; one value per environment – never the same value twice:

| Environment | Where |
|---|---|
| Local (`npm run dev`) | `.env.development.local` (`AI_WORK_SECRET=…`, see `.env.example`) |
| Local browser tests | nothing to do – `scripts/e2e-server.ts` sets a fixed secret and its own address |
| Previews | Vercel → Project → Settings → Environment Variables, environment **Preview**, type **Sensitive** |
| Production | the same, environment **Production**, type **Sensitive** – a value of its own |
| A server of its own (Docker, later) | the container's environment, plus `AI_WORK_ORIGIN` – the address the server answers on, e.g. `https://werkstatt.example` |

Redeploy after adding it on Vercel; environment variables reach a deployment only when it is built.

The secret never leaves the server: pages, links and the browser never see it. Never put it in a chat, a ticket or a
commit.

## Where the server calls itself

From its own environment, never from a request: `AI_WORK_ORIGIN` when set; on Vercel production the production domain
(`VERCEL_PROJECT_PRODUCTION_URL`); on a preview its own deployment (`VERCEL_URL`); otherwise `http://localhost:$PORT`
(3000). **Previews are not a place to try AI work** (ADR 0015, D2): Vercel's deployment protection refuses the call there,
and no bypass secret is configured. Test AI work locally.

## `AI_WORK_BUDGET_SECONDS` – the run budget

How long a run may take new work, in whole seconds. A piece of work already started is finished, never stored in part;
the hold on a piece lasts **twice the budget**, so a run never outlives its own hold.

| Where | Value |
|---|---|
| Vercel Hobby (now) | leave it unset – the default is **250**, within the route's `maxDuration` of 300 s |
| A server of its own | well above the longest indexing, e.g. `3600` |

On Hobby a PDF that needs more than one run (more than about 280 pages, ST-105) is cut off with its run and, once its
hold has run out, fails as *broken off* („abgebrochen“). That is accepted (user, 2026-11-01, D1); it is tried again
only by hand.

## When something is missing or goes wrong

- **`AI_WORK_SECRET` missing (or shorter than 32 characters):** no run starts – the start is skipped and logged
  (`AI work: AI_WORK_SECRET is not set`), and the worker route refuses every call. Requested AI assessments stay „wird
  geschrieben“, files stay waiting. Set the secret and redeploy; the next start (any of the triggers above) takes all
  of it.
- **A call of the worker route fails** (a deployment in between, the route not reachable): the chain stops and is
  logged (`AI work: the worker route …`). Nothing is lost – what was not taken stays waiting for the next start.
- **A run is cut off** (a crash, a deployment, the time limit): the pieces it held fail as *broken off* once their hold
  has run out – noticed by the next run, whatever starts it. A run cut off never calls the worker route for the rest of
  the queue, so that rest waits for the next start too. A technician taps „Erneut versuchen“ on the file; a team
  member requests a new AI assessment.

## PDFs and page images

Indexing a PDF (ST-106) parses it with `pdfjs-dist` and renders each page with `@napi-rs/canvas` – both kept as server
packages of their own (`next.config.ts`). pdfjs' **wasm** decoders (JBIG2, JPEG 2000), **ICC** profiles, standard fonts
and CMaps are traced into the worker route's function; without them a scanned page renders blank and only logs a
warning (ST-105). Both packages come as prebuilt binaries – no system library is needed locally or on Vercel, and the
function stays within its size limit (ST-105 measured pdfjs 35 MB, the Linux canvas binary 36 MB).

## Rotating the secret

Set a new value and redeploy. A run in flight during the deployment is cut off like any other run.
