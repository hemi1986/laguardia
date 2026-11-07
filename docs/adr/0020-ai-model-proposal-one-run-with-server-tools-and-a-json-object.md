---
status: accepted
date: 2026-11-07
---

# 0020 – An AI model proposal is written in one run with OpenRouter's server tools and a JSON object (amends 0019)

Proposed amendment to ADR 0019, decision 4 (accepted ADRs are not edited). Result of spike ST-122 (HS-41), measured on 2026-11-07 with the chat model of the local AI settings, `deepseek/deepseek-v4.1-flash-1017`, three devices, one run each per variant.

## Findings
- **Both tools work with the chat model.** `{"type":"openrouter:web_search"}` returns an answer with 10 `url_citation` annotations for "Flipper High Speed Williams"; `{"type":"openrouter:web_fetch"}` fetched the Wikipedia page and quoted it. Both are accepted together in one request to `/chat/completions`. The tools are not tied to a model: without native search OpenRouter falls back to Exa.
- **A strict `json_schema` is not kept together with the tools.** With `response_format: json_schema` (strict) the model answered with other keys (`source_links`, `type` instead of `fileCategory`), extra fields and, once, a markdown fence – 0 of 3 in the agreed form. With `response_format: json_object` and the exact keys in the system prompt the answer was in the agreed form in 6 of 6 runs (3 + 3 with the data preference below). A second request without tools that turns the research into the strict schema was also 3 of 3 correct, but takes about twice as long and costs about twice as much.
- **Link checks** (3 runs, 19 documents, ST-129's checks, `GET` with range): 0 not https, 0 neither PDF nor text, 0 over 100 MB, **7 not reachable – all `ipdb.org`, HTTP 403** to a plain server request (the files exist, the host blocks it). 2 documents are `text/html` pages (Pinball wiki, Wikipedia): whether ST-129 takes HTML as "text" is its decision. Per run: High Speed 4 of 8 unreachable, Fireball 3 of 4, Pac-Man 0 of 7.
- **The story's example is wrong:** "High Speed" (Williams, 1986, System 11) has alphanumeric displays, not a DMD – the AI correctly answered *Solid-state*. A DMD example is e.g. a Williams WPC machine of 1991 or later.

## Measured (variant JSON object, one run)
| Device | Duration | Searches | Server-tool calls | Tokens | Cost (OpenRouter) |
|---|---|---|---|---|---|
| High Speed (Williams, Pinball) | 37 s | 8 | 14 | 227,178 | $0.0768 |
| Fireball (Bally 1972, EM) | 14 s | 2 | 4 | 33,986 | $0.0181 |
| Pac-Man (Namco, Arcade) | 15 s | 2 | 5 | 24,260 | $0.0185 |

Repeat with the data preference: 28 s / $0.0712, 11 s / $0.0200, 35 s / $0.0375. Two-request variant: 23 s / $0.0364, 89 s / $0.0713, 43 s / $0.0507. Most of the cost is the search fee (Exa, about $0.007 per search), the rest is tokens of fetched pages. Not streamed; no intermediate progress is reported by the API.

## Data preference
`provider: { data_collection: "deny" }` is accepted together with both tools (3 of 3 runs complete). It restricts the providers of the chat model only. The search and fetch engines (Exa, Firecrawl, …) run through OpenRouter and receive the search terms – this is not covered by the preference and was not verified further. The privacy notice must say that the description a technician types and the AI's search terms go to a web search service. ADR 0016 allows any provider, so this is for the notice only.

## Decision (proposed)
1. **One run, not two.** `CMD-WriteAiModelProposal` sends one request with both tools and `response_format: {type: "json_object"}`; the exact keys are in the prompt. Observed maximum 37 s, far inside one run of the background work (ADR 0015, 250 s). Fields and documents are validated in code; a malformed answer fails the proposal as "answer unusable" (no second request).
2. **Model requirements:** the chosen chat model must accept `tools` with server tools and `json_object`. Only `deepseek/deepseek-v4.1-flash-1017` was measured; a model that rejects them makes the request fail and the proposal fails as "answer unusable" (or "device not recognised" for a failing request with no content – ST-124 to decide the text).
3. **Budget of a run:** `max_tool_calls: 15`, `web_fetch.max_uses: 6`, `web_search.max_results: 8`, a request timeout of 120 s. Expected cost $0.02–$0.08 per proposal, a ceiling of about $0.15 is plausible; the cost is the `usage.cost` of the response and goes into `EVT-AiModelProposalWritten`.
4. **What the page shows while it runs:** a static note that the AI searches the web and that it takes up to a minute – no progress steps, because the API reports none; the page checks the state like the AI assessment's page.
5. **Links:** the fetch seam of ST-129 cannot rely on a plain request – `ipdb.org` answered 403. A document that cannot be loaded fails alone (HS-40), as ADR 0019 already says; whether a browser-like `User-Agent` helps was not tested.

## Consequences
- ST-124 builds the single run as above; its `[OPEN]` on HS-41 is resolved by this ADR once the user accepts it.
- Examples in ST-124 to ST-130 that use "High Speed" as a DMD machine must change.
- ADR 0019 stays as it is; decision 4 is read together with this ADR once accepted.
