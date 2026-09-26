---
id: ST-042
title: Seed the initial maintenance plan
type: tech-task
context: BC-Maintenance
priority: should
size: null
risk: null
events: [EVT-MaintenancePlanChanged]
depends_on: [ST-043]
labels: [mvp, maintenance]
status: review
---

## Task
Fill the maintenance plan at go-live with the 19 maintenance tasks of the "Initial Maintenance Plan" in `docs/product/vision.md` (interval, suitable for helpers, applies to), through the normal *Change maintenance plan* command so that the event journal contains the changes.

Mapping of "Applies to": "Pinball" → restriction machine category Pinball; "Arcade" → Arcade; "Pinball / EM" → Pinball with technology EM; "Arcade / CRT" → Arcade with technology CRT. No maintenance tasks for machine category *Other*.

Start dates (HS-12): at go-live each maintenance task gets **one start date**, not one per machine. The start date counts as last done on every applicable machine. The technicians stagger the start dates across the maintenance tasks so that the machines don't all become due on the same day after go-live. Machines that were maintained more recently than a task's start date simply get a maintenance record after go-live.

Instructions: the technicians write a one or two sentence instruction per maintenance task before go-live; where none is written yet, the task name is used as the instruction.

## Acceptance Criteria
- [ ] All 19 maintenance tasks exist with the interval (1, 3 or 12 months) and suitable-for-helpers mark from `docs/product/vision.md`.
- [ ] Restrictions follow the mapping above; no maintenance task applies to machine category Other.
- [ ] Every maintenance task has exactly one start date, provided by the technicians before go-live; the start dates are staggered across tasks as the technicians chose them.
- [ ] Every maintenance task has an instruction – the technicians' text, or the task name where no text was provided.
- [ ] The seed is written through *Change maintenance plan*, so each task has a journal entry.
- [ ] Running the seed a second time does not create duplicate maintenance tasks.
- [ ] After seeding, the due maintenance list (ST-043) shows no task as due on the go-live day unless its start date is at least one interval in the past.

## Out of Scope
- Maintenance records from before go-live
- Start dates per machine

## Open Questions
- none
