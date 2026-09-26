---
status: accepted
date: 2026-09-26
---

# 0002 – Modular monolith, one database, state-based persistence with an event journal

## Context and Problem
`docs/domain/events.yaml` models the domain as events, commands and policies across three bounded contexts plus a generic Team area (`docs/domain/context-map.md`). A future reader could expect event sourcing, a message broker or one service per context. With one volunteer maintainer and minimal operating effort (`docs/product/vision.md`, Constraints) and ~60 machines, none of that is justified by a documented requirement.

## Decision
- **One deployable, one database.** Collection, Repair, Maintenance and Team are modules inside the monolith (`docs/adr/0001-tech-stack.md`). Each module owns its aggregates and their data; other modules reference them **by ID only** and change them **only through the owning module's commands**.
- **State-based persistence, not event sourcing.** Aggregates are stored as current state plus the histories the domain shows explicitly (machine status history, work log entries, defect resolutions, maintenance records – `docs/architecture/data-model.md`).
- **Event journal.** Every command also appends its domain events (type, time, acting team member, aggregate and machine reference, data) to an append-only journal **in the same transaction**. The journal feeds "new since last login", timelines and repair times (`RM-TechnicianDashboard`, `RM-HelperDashboard`, `RM-MachineRecord`, `RM-RepairTimes`); it is never replayed to rebuild state.
- **Automatic policies run in-process and synchronously**, in the same transaction as the triggering command: `POL-RetirementClosesDefects`, `POL-RetirementDismissesProblemReports`, `POL-LinkReopensResolvedDefect`. No broker, no outbox, no background workers. Manual policies are UI flows (e.g. *Record defect* and *Change machine status* submitted together, HS-3).
- **Cross-aggregate consistency** is handled where the model needs it: triage is guarded by the problem report's version check and *Record defect* creates the defect in the same transaction (HS-16); museum number uniqueness is a uniqueness constraint in the database (HS-17).
- **Read models are queries** over the single database and may read across modules; no separate projections or read stores.
- **Time-based events are computed on read.** *Due* / *Overdue* (`EVT-MaintenanceTaskDue`, `EVT-MaintenanceTaskOverdue`), "waiting longer than 3 days" and "claims older than 14 days" are calculated when a page is loaded – no scheduler or cron job.

## Considered Options
- **Event sourcing**: rejected – the histories the domain needs are covered by explicit history entities and the journal; rebuilding state from events, versioning events and maintaining projections is too much for one volunteer.
- **Services or a separate database per context / message broker**: rejected – no scaling, team or availability requirement justifies distribution (`docs/product/vision.md`).
- **No journal (timestamps on each table only)**: possible, but every dashboard would need its own "what changed since" query across many tables; the journal gives one simple source for it.

## Consequences
- Boundaries between modules are a code discipline (e.g. enforced by import rules), not a deployment boundary.
- Journal entries must be written by every command – a shared helper in the command layer, covered by tests.
- If a policy ever needs to become asynchronous (e.g. slow work), an outbox can be added later without changing the domain model.
