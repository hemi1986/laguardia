---
id: ST-122
title: Web search and fetch for a machine model proposal
type: spike
context: BC-AiAssistance
priority: must
size: M
risk: high
events: [EVT-AiModelProposalWritten]
depends_on: []
labels: [feature:ai-model-proposal]
status: in-progress
---

## Question
Do OpenRouter's server tools for web search and for fetching a web page work with the chat model chosen in the AI
settings, together with a structured answer – the fields of a machine model and a list of documents with links – and
how long does one run take and what does it cost?

Hotspot **HS-41** (`docs/domain/events.yaml`), feature `ai-model-proposal` (user, 2026-11-07), ADR 0019
(`docs/adr/0019-ai-model-proposal-accepted-in-one-transaction-documents-loaded-afterwards.md`). The answer decides how
`CMD-WriteAiModelProposal` (ST-124) is built, whether its run fits one run of the background work (ADR 0015) and what a
proposal costs; ST-124 to ST-130 are not `ready` before it is answered.

## Timebox
1 day – stop there and record what is known, even if a criterion is not answered. The measuring code is a throw-away
route or script on a branch; the key stays an environment variable of that branch and is never committed or pasted.

## Acceptance Criteria
- [ ] **First, in minutes:** one request to OpenRouter with the chat model of the settings and the server tool for web search returns an answer with citations for "Flipper High Speed Williams" – and one with the tool for fetching a page returns the text of a given Pinball wiki page. If a tool is not offered for the model, say which models offer it and stop.
- [ ] Both tools together with a structured answer (title, manufacturer, year, machine category, technology; documents with title, file category and https link; the sources) are returned in the agreed form for three real devices: a pinball machine with a DMD ("High Speed" by Williams), an electromechanical pinball machine, an arcade machine.
- [ ] Measured per device and written down: duration of the whole run, number of searches and fetches, tokens, cost as OpenRouter reports it.
- [ ] Recorded: how often a link the AI names is not reachable, not https, not a PDF or text, or larger than 100 MB (the checks of ST-129), counted over the documents of the three runs.
- [ ] Recorded: whether the requests ask only for providers that neither keep nor train on the data, as ADR 0014 did, is possible with the tools or not (ADR 0016 allows any provider; the answer is for the privacy notice).
- [ ] Decision for ST-124: one run or two (fields first, documents second), the model requirements, the budget of a run, and what the page shows while it runs. Written into ADR 0019 as a proposed amendment; HS-41 resolved.

## Out of Scope
- Writing any production code of the feature
- Indexing or storing the documents found (ST-129)

## Open Questions
- none
