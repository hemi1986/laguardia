---
status: accepted
date: 2026-11-07
---

# 0019 – An AI model proposal is accepted in one transaction; its linked documents are loaded afterwards

Feature `ai-model-proposal` (user, 2026-11-07; `docs/product/vision.md`, `docs/domain/events.yaml` **AGG-AiModelProposal**, **FLOW-AiModelProposal**) lets a technician type a device and get a proposal for a machine model and its documents. Three things are hard to reverse and surprising later: which module owns the proposal and calls whose commands, why the machine model and the links' files do not arrive together, and what the server may fetch from the web.

## Driving Requirements
- Nothing is saved without the technician's confirmation; a failure of one document must not undo the machine model – user, 2026-11-07, grilling Q10 (b)
- Collection is upstream and stays free of AI – `docs/adr/0002-modular-monolith-state-based-persistence.md`, `docs/adr/0010-cross-module-policies-and-retirement-lock.md`
- A file is added through `CMD-AddFile`, indexed by the existing policy afterwards – `docs/adr/0018-files-without-an-owner.md`
- Background AI work with state in the database, started by what a command committed – `docs/adr/0015-background-ai-work-with-state-in-the-database.md`, `docs/adr/0017-ai-work-started-by-what-a-command-committed.md`
- OpenRouter is the only AI backend, any model – `docs/adr/0014-ai-through-openrouter-with-a-multimodal-index-in-postgresql.md`, `docs/adr/0016-any-openrouter-model-free-and-data-keeping-providers-included.md`

## Decision
1. **The proposal lives in AI assistance** (`AGG-AiModelProposal`). It never changes Collection by itself; `CMD-AcceptAiModelProposal` is the one command that does, and it calls Collection's `CMD-CreateMachineModel` and `CMD-AttachFile` through their in-transaction entry points, in its own transaction. AI assistance is downstream of Collection, so the call goes in the allowed direction and Collection names no AI.
2. **The linked documents are loaded after saving**, one background run per link (`CMD-LoadProposedDocument`, started by `EVT-AiModelProposalAccepted`, ADR 0017), each in its own transaction with `CMD-AddFile`. A link that fails records its reason on the proposal and is retried by hand; the machine model and the other documents stay.
3. **What the server fetches** is limited: `https` only, no private or the museum's own addresses (also after a redirect), PDF/text/Markdown only, at most 100 MB, nothing from the content is executed. The AI only proposes links; the technician sees and ticks them before anything is fetched, so a web page cannot make La Guardia store anything unseen.
4. **The AI part uses OpenRouter's server tools** for web search and fetching a page with the chat model chosen in the settings; the spike ST-122 confirms they work with it (HS-41) before the stories after it are ready.

## Considered Options
- **Load the documents while the proposal is written, so the technician can open them before saving** – rejected: unconfirmed content would sit in storage and need cleaning up (ADR 0009's abandoned uploads), and the run would take far longer.
- **One command in Collection with a proposal reference** – rejected: Collection would name AI (ADR 0010).
- **Compose Collection's `CMD-CreateMachineModel` with a policy of AI assistance** (ADR 0010 option 3) – rejected: the policy needs the proposal and the chosen documents as input and must reject the command from outside, which makes the composed command carry AI's form; calling the upstream commands from the downstream command is simpler.

## Consequences
- Collection's `CMD-CreateMachineModel`, `CMD-AttachFile` and `CMD-AddFile` need entry points usable inside another module's transaction (the `in-command` pattern); the engineering conventions' seam catalog gets a seam for fetching a web address (stand-in in tests).
- The fetch seam is the one place outside OpenRouter where the server talks to the internet; its limits are tested.
- A spike ST-122 comes first (HS-41).
