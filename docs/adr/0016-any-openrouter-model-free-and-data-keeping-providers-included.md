---
status: proposed
date: 2026-11-01
---

# 0016 – Any OpenRouter model may be chosen: free models and providers that keep or train on the data included

Supersedes, once accepted, one point of `docs/adr/0014-ai-through-openrouter-with-a-multimodal-index-in-postgresql.md` (accepted, not edited): "Every request asks only for providers that neither keep nor train on the data" (`provider: { data_collection: "deny", zdr: true }`) and the reminder to turn on zero data retention. Everything else in ADR 0014 holds – OpenRouter as the only AI backend, the museum's own key encrypted in the database, the multimodal AI index in PostgreSQL.

## Context and Problem
ADR 0014 sent every chat and embedding request with `provider: { data_collection: "deny", zdr: true }`. In use this narrowed the choice far more than the model list showed: the form „KI“ lists every model OpenRouter offers, but a model without a zero-data-retention endpoint – free models among them, and in the spike `google/gemini-2.5-flash` – only failed later, at the first AI assessment, with *model not available*. The user decided that zero data retention does not matter for this project (user, 2026-11-01): every model may be chosen, free ones included, also when the provider keeps the data or trains on it.

## Decision
- **No provider restriction in any request** – chat completions, embeddings and the test embedding on saving send no `provider` option; OpenRouter routes to any of the model's providers.
- **Every model of OpenRouter's lists can be chosen**, free ones included; „· passt nicht“ stays only for what La Guardia technically needs (text and images; 1536 numbers for the embedding model, checked on saving).
- **The account's own privacy settings at OpenRouter still apply** – a request cannot loosen them. The form „KI“ now reminds the technicians that free models need the account's permission for providers that keep or train on inputs, and to set a spending limit on the key. *Model not available* says to check those settings for a free model.
- The privacy notice still has to say that problem report descriptions and photos – also visitors' – reach OpenRouter (vision, unchanged); whether it names that providers may keep or train on them is for the technicians who change the legal texts.

## Consequences
- Free and cheaper models become usable; an AI assessment no longer fails only because a model has no zero-data-retention endpoint.
- Visitors' problem report descriptions and photos may be kept by a provider or used for training. Accepted by the user for this project (2026-11-01); `docs/product/vision.md` (Constraints, "AI") changed accordingly.
- A free model can be rate-limited or withdrawn by OpenRouter at any time – it then fails like any unavailable model (*model not available*, *OpenRouter refused*) and is tried again by hand.
- One item per embedding request stays: each item's cost and failure stay its own (ST-105), no longer because of zero data retention.
