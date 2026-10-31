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
status: ready
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
- [ ] **First, in minutes:** one page image and one text passage embedded through OpenRouter's embeddings endpoint with `google/gemini-embedding-2` at 1536 numbers, asking only for providers that neither keep nor train on the data (ADR 0014), each return a vector – the whole design rests on OpenRouter accepting images for embeddings. If it does not, stop and hand the result to the domain-architect (ADR 0014 changes).
- [ ] **Setup:** the user provides the OpenRouter key as a **preview-scoped environment variable of the spike branch only** – never committed, never in a file, never in the settings, nobody pastes its value into the session (the agent only checks that the variable exists) – with a low spending limit on the key (about 5 US dollars) and zero data retention switched on in the OpenRouter account (otherwise requests for such providers fail with "no provider"). The key is removed after the spike.
- [ ] **Setup:** the technicians name the largest scanned manual and the largest manual with a text layer among the machines' and machine models' files, and upload both to a machine model **on the spike's preview** – previews use their own store, not production's (ADR 0012, ADR 0009) – so both are read from the preview's store as an attached file is.
- [ ] On that preview deployment (not locally only), each manual is read from the store, every page's text layer taken and every page rendered as an image, and both embedded with `google/gemini-embedding-2` at 1536 numbers, every request asking only for providers that neither keep nor train on the data.
- [ ] Measured and written down per manual: pages, total time, time per page (reading, rendering, embedding), peak memory, the page image size chosen, cost per page and in total as OpenRouter reports it.
- [ ] A verdict against the run budget (about 600 s) and the memory (2 GB, 4 GB): the largest manual fits one run / fits with more memory / does not fit – and from which page count a PDF does not fit.
- [ ] If it does not fit: a proposal how ST-106 indexes such a PDF (page-by-page progress or ADR 0015's option 3), with what it means for the invariant "indexing a file again replaces its AI index entry as a whole", handed to the domain-architect before ST-112 and ST-106 are built; ADR 0015 (still `proposed`) is updated with the result.
- [ ] Tokens billed per page image and per text passage, as OpenRouter reports them – ST-110's cost estimate for a change of the embedding model needs a tokens-per-item figure.
- [ ] The maximum number of images the chat model the museum intends to use (for example `google/gemini-2.5-flash`) accepts in one request through OpenRouter, and whether 12 page images plus 10 problem report photos plus 5 request photos fit – it confirms the caps of ST-107.
- [ ] Shown whether pages can be embedded several at a time within OpenRouter's limits, and what that does to time and memory.
- [ ] Shown whether `@napi-rs/canvas` and `pdfjs-dist` stay within the function size limit (250 MB) and run in the local Docker setup as on Vercel.
- [ ] The result is recorded in `## Result` here and summarised in the Notes of ST-112 and ST-106; the measuring code is not merged. If the result changes the Context, the checklist or the scenarios of ST-112, ST-106, ST-107 or ST-110, that story goes back to `review`.

## Notes
- Requirements-engineer's recommendation (2026-10-31), approved in the story review: a spike of its own **before**
  ST-112 and ST-106 rather than a first step inside them – its outcome can change the domain model (the whole-entry
  invariant) and ADR 0015, both of which they build on, and ST-106 cannot be estimated without it.
- The cost of the spike's embeddings is paid with the key the user provides; the user is told the measured cost.
- The manuals are museum files, not visitors' data – the spike sends no problem report description or photo, so the
  constraint that the privacy notice must mention the AI before visitors' data reaches it does not apply here.
- No review lane: the measuring code is not merged.
