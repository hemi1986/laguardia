---
id: ST-003
title: Module structure, command layer and event journal
type: tech-task
context: BC-Team
priority: should
size: null
risk: null
events: []
depends_on: [ST-001]
labels: [mvp, foundation]
status: review
---

## Task
Set up the application skeleton from ST-001 as the modular monolith of `docs/adr/0002-modular-monolith-state-based-persistence.md`, so all following stories share one way of executing commands:

- Modules **Collection**, **Repair**, **Maintenance** and **Team**, each owning its data; other modules reference it by ID only and change it only through the owning module's commands. (This task spans all contexts; it is filed under `BC-Team`, the generic context that supplies the acting team member and role to all others.)
- A **command layer** helper: runs a command in one database transaction, performs the authorization check (acting team member and role) server-side, and appends the command's domain events to the append-only **event journal** (type, time, acting team member or visitor, aggregate reference, machine reference, data) in the same transaction.
- **Optimistic version check** on aggregates (needed for triage, HS-16 in `docs/domain/events.yaml`).
- **Language setup**: the team UI is German, with wording taken from the `_UI (de)_` lines in `CONTEXT.md`; the visitor pages use message catalogs for German and English.
- **Automated dependency update** pull requests (security discipline from ADR 0001).

## Acceptance Criteria
- [ ] A lint rule fails when one module imports another module's internals; demonstrated with a deliberate violation.
- [ ] Test: when a command is rejected, neither the aggregate change nor a journal entry is stored.
- [ ] Test: a successful command stores exactly its domain events in the journal with type, time, acting person, aggregate reference and machine reference.
- [ ] Test: a command called without an acting team member (and not allowed for visitors) is rejected in the command layer, independent of any middleware.
- [ ] Test: of two concurrent commands on the same aggregate version, exactly one succeeds and the other is rejected.
- [ ] Team UI texts come from a German message catalog; visitor texts from German and English catalogs.
- [ ] Automated dependency update pull requests are enabled for the repository.

## Out of Scope
- Login and accounts (ST-004, ST-005)
- Any domain command beyond the test command of ST-001

## Open Questions
- none
