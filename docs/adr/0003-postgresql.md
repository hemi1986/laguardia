---
status: accepted
date: 2026-09-26
---

# 0003 – PostgreSQL as the single database

La Guardia needs one transactional, relational store: triage must be guarded against concurrent outcomes (HS-16), museum numbers must be unique across all machines (HS-17), read models join data across contexts, and due dates are date/interval arithmetic (`docs/domain/events.yaml`, `docs/adr/0002-modular-monolith-state-based-persistence.md`). We propose **PostgreSQL**, preferably as a managed service with automatic backups, because it works with every hosting option still open – serverless platforms, container platforms and an own server – whereas **SQLite**, operationally the simplest for a single server, needs a persistent local disk and so rules out serverless hosting and makes backups the maintainer's job (`docs/product/vision.md`: minimal operating effort, one volunteer). Document databases were not considered further: the model is relational and the data volume is tiny (~60 machines).

## Consequences
- The hosting decision (open, see Open Points in `docs/adr/0001-tech-stack.md`) must include a PostgreSQL offering or run PostgreSQL itself.
- If hosting ends up as a single self-managed server, revisit SQLite – then this ADR would be superseded.
- Whether photos and files are stored in the database or in separate object storage is decided together with hosting.
