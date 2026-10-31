---
status: accepted
date: 2026-10-31
---

# 0014 – AI through OpenRouter only, with a multimodal AI index in the existing PostgreSQL (pgvector)

## Context and Problem
Feature `ai-assessment` (`docs/product/vision.md`, scope note "AI assessments" and constraint "AI"; `docs/domain/events.yaml`, context `BC-AiAssistance`) lets a team member ask an AI for a first view of an open defect, with references into the machine's and machine model's manuals, schematics and images. That needs three things La Guardia does not have: an AI backend, a searchable index of the files – including scanned PDFs without a text layer and plain images – and a secret (the museum's API key) that technicians enter in the application. A future reader will ask why there is no vector database, why the key is in the database and not an environment variable, and why page images are embedded instead of OCR text.

## Driving Requirements
- OpenRouter is the only AI backend, paid with the museum's own key; only providers that neither keep nor train on the data – `docs/product/vision.md` (Constraints, "AI")
- Problem report descriptions and photos – visitors' included – reach the AI – `docs/product/vision.md`; `CMD-WriteAiAssessment`
- Technicians save the key and choose the chat model and the embedding model on the settings page; the key is never shown again; a key is checked with OpenRouter on save – `AGG-AiSettings`, `CMD-ChangeAiSettings`
- Indexed: all files of machines and machine models – PDF (every page: text layer as text and the page as an image), Markdown, text, PNG/JPEG/WebP; no OCR, no video or audio – user, 2026-10-31; `EVT-FileIndexedForAi`
- The search covers only the defect's machine and its machine model, with text and with each photo; found pages and images are sent as images – `CMD-WriteAiAssessment`
- A removed file leaves the AI index in the same step – HS-29
- Files up to 100 MB in the S3 store – `docs/adr/0012-s3-compatible-object-storage.md`
- One database, modules own their data – `docs/adr/0002-modular-monolith-state-based-persistence.md`, `docs/adr/0003-postgresql.md`; minimal operating effort, one volunteer – `docs/product/vision.md`
- The whole application runs locally in Docker without a cloud account – ADR 0012

## Considered Options
**Where the AI index lives**
1. **pgvector in the existing PostgreSQL** (Neon supports the extension; locally the `pgvector/pgvector:pg17` image) – chosen.
2. **A separate vector database** (hosted: Pinecone, Turbopuffer; self-hosted: Qdrant) – rejected: a second service with its own account, data processing agreement and backup, for at most tens of thousands of items; removing a file "in the same step" (HS-29) would span two stores.
3. **A provider's hosted file search** (e.g. a vector store at one model vendor) – rejected: ties La Guardia to one vendor against "OpenRouter only", and the vendor keeps the museum's files – against "neither keep nor train".
4. **No index – send whole manuals to a long-context model** – rejected: scanned manuals of up to 100 MB do not fit a request, and every AI assessment would pay for every page.

**How scanned pages become searchable**
- **Multimodal embeddings of each page rendered as an image, plus the text layer as text** – chosen (user, 2026-10-31: no OCR). A scanned schematic is found through its image; the chat model reads the found page as an image.
- OCR – rejected by the user; it would add a second model or service and still lose schematics.

**Rendering PDF pages on a Vercel function**
- **`pdfjs-dist` (Apache-2.0) for the text layer and the rendering, with `@napi-rs/canvas` (MIT, prebuilt Linux binaries)** – chosen: pure npm packages, no system binary, both run locally and on Vercel.
- MuPDF (WASM) – rejected: AGPL-licensed. Poppler (`pdftoppm`) – rejected: a system binary that Vercel functions do not have. An external rendering service – rejected: one more processor of the museum's files.

**Where the API key lives**
- **In the AI settings, encrypted (AES-256-GCM, `node:crypto`) with a key from an environment variable** – chosen: technicians enter and replace it on the settings page without a deployment (user, 2026-10-31); a database backup or a Neon preview branch copied from production carries only ciphertext, which a preview with its own environment key cannot decrypt.
- Only an environment variable – rejected: only the maintainer could change it, through Vercel. Plain text in the database – rejected: every backup and preview branch would carry a working key.

**Size of an embedding**
- **A fixed 1536 numbers** (user, 2026-10-31; the default `google/gemini-embedding-2` returns that size on request, and it stays below pgvector's 2000-dimension limit for an HNSW index) – chosen. Which embedding models fit: HS-34.
- No fixed size – possible, because a search covers one machine and its machine model (a few thousand items at most), which an exact search handles without any index; kept as the alternative in HS-34.

## Decision
- **One AI seam** in AI assistance with an **OpenRouter adapter** – the only code that talks to OpenRouter, over its HTTP API (`/api/v1/models`, `/api/v1/key` or an equivalent check, `/api/v1/embeddings`, `/api/v1/chat/completions`) with `fetch`, no SDK – and an in-memory adapter for tests, injected like the storage seam (ADR 0012). It is the anti-corruption layer of `docs/domain/context-map.md`: it turns OpenRouter's answers into the domain's failure reasons and reports the cost of every request.
- **Every request asks only for providers that neither keep nor train on the data**: `provider: { data_collection: "deny", zdr: true }` on chat completions and embeddings alike. The form „KI“ reminds the technicians to also turn on zero data retention and turn off prompt logging in the OpenRouter account's privacy settings, which OpenRouter enforces account-wide (a request cannot loosen it), and to set a spending limit on the key (`RM-AiSettings`). A model without such a provider fails with *model not available*.
- **The AI index is held in tables of the AI assistance module in the existing PostgreSQL** with the `vector` extension (one migration `CREATE EXTENSION IF NOT EXISTS vector`): one AI index entry per file and its index items, each with kind (passage, page image, image), page, the passage's text and an embedding of 1536 numbers (`docs/architecture/data-model.md`). A search first narrows to the entries of the machine and its machine model made with the current embedding model, then orders by cosine distance – exact, without an approximate index, which this size does not need; an HNSW index is added when a measurement says so.
- **What is indexed**: a PDF page by page – its text layer as one passage and the page rendered as an image of bounded size; Markdown and text files in passages; PNG, JPEG and WebP images as they are. **Page images are not kept**: when an AI assessment sends a found page, the page is rendered again from the file in the store. Storing them would add content to keep in step with the file (ADR 0009) for no requirement.
- **The key** is encrypted with `AI_SETTINGS_ENCRYPTION_KEY` (32 random bytes, base64), set once per environment on Vercel and in the local `.env`; the server decrypts it only to call OpenRouter. It is never journaled, logged or sent to the browser – the form shows its last four characters. Without the environment key, or with a different one, the saved key cannot be decrypted: AI counts as off and the form asks for the key again.
- **A removed file never stays in the AI index.** AI assistance adds `POL-RemovedFileLeavesAiIndex` to Collection's `CMD-RemoveFile` (ADR 0010, option 3), which removes the entry in the removal's transaction. Because an indexing reads its file for minutes outside any transaction (ADR 0015), Collection owns a **removal lock per file**, `pg_advisory_xact_lock(hashtext('file:' || id))`: `CMD-RemoveFile` takes it exclusively before deciding; the Collection read that the indexing uses in the transaction that stores its entry takes it shared and answers whether the file is removed. An indexing storing during a removal waits and then records nothing; a removal starting during a store waits and its policy then removes the new entry. This is the pattern of the machine's retirement lock (ADR 0010) and the second named exception to "a read of another module takes no lock".

## Consequences
- Positive: no new service, account or store; the AI index is backed up with the database, removed with a file in one transaction, and runs locally in the same Docker setup.
- Negative / cost:
  - The local and CI database image changes from `postgres:17-alpine` to `pgvector/pgvector:pg17` (`docker-compose.yml`); Neon needs the extension enabled by the migration.
  - New runtime dependencies `pdfjs-dist` and `@napi-rs/canvas` (a native binary, kept within the 250 MB function size); the dependency routine (ST-063) watches them.
  - OpenRouter becomes a processor of visitors' descriptions and photos: its terms and data processing terms are confirmed before real data is sent (as for AWS in ADR 0012), and the privacy notice says so – the technicians change the legal texts (`docs/product/vision.md`).
  - Losing `AI_SETTINGS_ENCRYPTION_KEY` loses only the saved API key – a technician enters it again. `docs/operations/` gets the step to create it.
  - The embedding model's price is paid per page and image: the cost estimate before a change of embedding model counts the pages and images of the current entries (`CMD-ChangeAiSettings`).
- Follow-up: a spike in the first indexing story – index the largest scanned manual (about 100 MB) on a preview and measure time, memory and cost per page against ADR 0015's run budget and the function's memory (2 GB default, 4 GB maximum on Pro).

## Open Points
- HS-34 – which embedding models a technician may choose for an index of 1536 numbers.
