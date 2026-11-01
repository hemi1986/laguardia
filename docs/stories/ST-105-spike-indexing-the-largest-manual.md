---
id: ST-105
title: Indexing the largest manual for AI within one run
type: spike
context: BC-AiAssistance
priority: should
size: M
risk: high
events: [EVT-FileIndexedForAi]
depends_on: []
labels: [feature:ai-assessment]
status: done
---

## Question
Can La Guardia index the museum's largest manual – a scanned PDF of about 100 MB – for AI within one run of the
background work, and what does it cost?

Follow-up named by ADR 0014 (`docs/adr/0014-ai-through-openrouter-with-a-multimodal-index-in-postgresql.md`,
*Consequences*) and ADR 0015 (`docs/adr/0015-background-ai-work-with-state-in-the-database.md`, *Negative / cost*):
indexing reads the file from the store, takes every page's text layer and renders every page as an image of bounded
size (`pdfjs-dist` with `@napi-rs/canvas`), and asks OpenRouter for an embedding of each (1536 numbers, the default
embedding model `google/gemini-embedding-2`). ADR 0015 gives one run a budget of about 600 of its 800 seconds; a Vercel
function has 2 GB of memory by default and 4 GB at most. The AI index entry is replaced as a whole when a file is
indexed (invariant of AGG-AiIndexEntry). If the largest manual does not fit one run, ADR 0015 names two ways out –
storing the progress page by page, or Vercel Workflow – and the first one touches that invariant. The answer decides
how ST-112 and ST-106 are built and how large ST-106 is, so it is known before both are built and before ADR 0015 is
accepted. Revised after the story review `docs/reviews/2026-10-31-ai-assessment-story-review.md` (user, 2026-10-31).

## Timebox
1 day – stop there and record what is known, even if a criterion is not answered. The checklist is ordered so that
the decisive items come first; whatever is not reached is recorded as "not answered". The measuring code is a
throw-away route on a branch whose preview already deploys.

## Acceptance Criteria
- [x] **First, in minutes:** one page image and one text passage embedded through OpenRouter's embeddings endpoint with `google/gemini-embedding-2` at 1536 numbers, asking only for providers that neither keep nor train on the data (ADR 0014), each return a vector – the whole design rests on OpenRouter accepting images for embeddings. If it does not, stop and hand the result to the domain-architect (ADR 0014 changes).
- [x] **Setup:** the user provides the OpenRouter key as a **preview-scoped environment variable of the spike branch only** – never committed, never in a file, never in the settings, nobody pastes its value into the session (the agent only checks that the variable exists) – with a low spending limit on the key (about 5 US dollars) and zero data retention switched on in the OpenRouter account (otherwise requests for such providers fail with "no provider"). The key is removed after the spike.
- [x] **Setup:** the technicians name the largest scanned manual and the largest manual with a text layer among the machines' and machine models' files, and upload both to a machine model **on the spike's preview** – previews use their own store, not production's (ADR 0012, ADR 0009) – so both are read from the preview's store as an attached file is.
- [x] On that preview deployment (not locally only), each manual is read from the store, every page's text layer taken and every page rendered as an image, and both embedded with `google/gemini-embedding-2` at 1536 numbers, every request asking only for providers that neither keep nor train on the data.
- [x] Measured and written down per manual: pages, total time, time per page (reading, rendering, embedding), peak memory, the page image size chosen, cost per page and in total as OpenRouter reports it.
- [x] A verdict against the run budget (about 600 s) and the memory (2 GB, 4 GB): the largest manual fits one run / fits with more memory / does not fit – and from which page count a PDF does not fit.
- [x] If it does not fit: a proposal how ST-106 indexes such a PDF (page-by-page progress or ADR 0015's option 3), with what it means for the invariant "indexing a file again replaces its AI index entry as a whole", handed to the domain-architect before ST-112 and ST-106 are built; ADR 0015 (still `proposed`) is updated with the result.
- [x] Tokens billed per page image and per text passage, as OpenRouter reports them – ST-110's cost estimate for a change of the embedding model needs a tokens-per-item figure.
- [x] The maximum number of images the chat model the museum intends to use (for example `google/gemini-2.5-flash`) accepts in one request through OpenRouter, and whether 12 page images plus 10 problem report photos plus 5 request photos fit – it confirms the caps of ST-107.
- [x] Shown whether pages can be embedded several at a time within OpenRouter's limits, and what that does to time and memory.
- [x] Shown whether `@napi-rs/canvas` and `pdfjs-dist` stay within the function size limit (250 MB) and run in the local Docker setup as on Vercel.
- [x] The result is recorded in `## Result` here and summarised in the Notes of ST-112 and ST-106; the measuring code is not merged. If the result changes the Context, the checklist or the scenarios of ST-112, ST-106, ST-107 or ST-110, that story goes back to `review`.

## Result
Measured on 2026-11-01 on the spike's preview (`fra1`, Node 24, the project's Vercel plan) with the user's
preview-scoped key; the measuring code (`src/app/api/st-105-measure/`, branch history only) is not merged. Spent on
OpenRouter for the whole spike: about 0,08 $.

**Findings that change assumptions**
- **The project is on Vercel Hobby, not Pro.** A function may run **300 s at most** – the first deployment with
  `maxDuration = 800` was refused (`invalid_max_duration`). ADR 0015's run of 800 s with a budget of about 600 s does
  not exist on this plan; a run has about **250 s**. The user does not intend to buy Pro and will probably run La
  Guardia later in a local Docker installation instead of Vercel and Neon (user, 2026-11-01 – hosting to be planned
  separately). The design must therefore work with a short run budget **and** with no time limit at all.
- **Images are accepted for embeddings** – `google/gemini-embedding-2`, 1536 numbers, provider Google, with
  `provider: { data_collection: "deny", zdr: true }`, for a text passage and for a page image alike.
- **Several items in one embedding request do not work under zero data retention**: OpenRouter routes a request with
  several inputs to a batch-capable Vertex endpoint that is not zero-data-retention, and answers 404 "No endpoints
  found matching your data policy". One item per request, 4 requests in parallel ran without a single 429 or retry.
- **Scanned pages need pdfjs' WASM decoders**: without `wasmUrl` (JBIG2, JPEG 2000) and `iccUrl`, pdfjs 6 renders a
  scanned page **blank** and only logs a warning – a silent failure ST-106 must guard against. The `wasm/`, `iccs/`,
  `standard_fonts/` and `cmaps/` folders of `pdfjs-dist` must be traced into the function; `pdfjs-dist` and
  `@napi-rs/canvas` are `serverExternalPackages`.
- **Rendering is the cost, not the embedding**: the time per page is the decoding of the scanned image. 1024 px and
  1536 px take the same time (560 ms locally); the embedding requests run beside the rendering and hide behind it.

**Measured – largest manual** ("Williams Teile Katalog Blaue Version", `16-9064-B`, 25 MB, 568 pages, scanned with a
text layer – so it is both the largest scanned manual and the largest with a text layer; the museum's manuals are far
below 100 MB – user, 2026-11-01)

| | Vercel preview (Hobby) | Local (WSL, Node 24.13) |
|---|---|---|
| Reading from the store | 0,6 s for 25 MB | – (from disk) |
| Opening the PDF | 0,2 s | – |
| Pages in one run | 283 in 251 s, then the budget stop | 568 in 326 s (render only) |
| Time per page (total) | **0,89 s** | 0,57 s |
| – text layer | 6 ms | 2 ms |
| – rendering | 851 ms | 563 ms |
| – JPEG encoding | 18 ms | 8 ms |
| – embedding (2 requests, in parallel) | ≈ 0,9 s each, hidden behind the rendering | – |
| Peak memory (RSS) | **318 MB** | 314 MB |
| Page image | 792 × 1024 px, JPEG quality 75, ≈ 71 KB | same |
| Tokens per page image | **258** | – |
| Tokens per text passage | **274** on average (dense parts lists) | – |
| Cost per page (image + text) | **0,00019 $** (image 0,000128 $, text 0,00006 $) | – |
| Cost of the whole manual | ≈ **0,11 $** | – |
| Failures, retries | none; every vector 1536 numbers | – |

**Verdict**
- **Memory is no constraint**: ≈ 320 MB of the 2 GB a function has – no extra memory needed.
- **Time is**: at 0,89 s per page a run of about 250 s (Hobby) indexes **≈ 280 pages**, one of about 600 s (Pro) would
  index ≈ 670. The largest manual (568 pages) **does not fit one run on the project's plan**, and a PDF of more than
  ≈ 280 pages never will. On a self-hosted server without a time limit it fits easily (≈ 8 minutes).
- More memory would not help on its own: the rendering is single-threaded; only more CPUs with parallel rendering
  (worker threads) would, and Hobby gives no choice.

**Proposal for ST-106 and ST-112** (handed to the domain-architect; ADR 0015 updated, still `proposed`): **a PDF's
indexing keeps its progress page by page in a technical progress record and replaces the AI index entry as a whole
only when the last page is done.** A run takes a PDF, continues from the last stored page, embeds pages until its
budget is used, stores the finished pages in the progress record (not in the AI index entry) and lets the next run
continue. When the last page is embedded, the AI index entry is replaced in one short transaction, as today. So the
invariant "indexing a file again replaces its AI index entry as a whole – never a mix of two indexings or two
embedding models" **holds unchanged**: the progress record is technical state like the holds of ADR 0015, invisible to
read models; it names the embedding model it was made with and is dropped when the model changes, the file is removed
(same transaction as `POL-RemovedFileLeavesAiIndex`) or AI is turned off. It works on Hobby, on Pro and on a
self-hosted server alike (there a run's budget can simply be long). Vercel Workflow (ADR 0015 option 3) is not
proposed – it is Vercel-only, and the user expects to leave Vercel.

**Other answers**
- **Chat model and images** (for ST-107): `google/gemini-2.5-flash` has **no zero-data-retention endpoint** on
  OpenRouter – every request fails with 404 "No endpoints found matching your data policy". The current Flash
  (`~google/gemini-flash-latest`) accepted **27 images in one request** (12 + 10 + 5 fit) with zero data retention:
  ≈ 1.090 tokens per 256 px image, 0,022 $ for the request. Its "thinking" used up an answer limit of 20 tokens and
  returned no text – ST-107 must leave the answer limit large enough for the reasoning.
- **Function size**: with `pdfjs-dist` (35 MB) and `@napi-rs/canvas` (36 MB, Linux x64 binary) the preview deployed
  and ran on Vercel; locally the same code ran under Node 24 against the local stack (pdfjs and the canvas need no
  system library). Not measured: the exact bundle size of the function.
- **A file record without content** – a preview's database copied from production holds files whose content is in
  production's store only – fails in pdfjs with "Invalid PDF structure"; ST-106 checks the store's answer and records
  "not readable".
- **Size of the progress record** (for ST-112/ST-106): 568 pages give ≈ 1.136 vectors of 1536 numbers – ≈ 7 MB as
  pgvector's 4-byte floats, plus ≈ 0,3 MB of text; well within PostgreSQL, also for a partly done PDF.
- **Not answered**: the effect of more memory (Hobby offers none) and parallel rendering with worker threads.

## Notes
- Requirements-engineer's recommendation (2026-10-31), approved in the story review: a spike of its own **before**
  ST-112 and ST-106 rather than a first step inside them – its outcome can change the domain model (the whole-entry
  invariant) and ADR 0015, both of which they build on, and ST-106 cannot be estimated without it.
- The cost of the spike's embeddings is paid with the key the user provides; the user is told the measured cost.
- The manuals are museum files, not visitors' data – the spike sends no problem report description or photo, so the
  constraint that the privacy notice must mention the AI before visitors' data reaches it does not apply here.
- No review lane: the measuring code is not merged.
