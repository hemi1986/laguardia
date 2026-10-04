---
id: ST-042
title: Go-live readiness checklist incl. the initial maintenance plan
type: tech-task
context: BC-Collection
priority: must
size: M
risk: low
events: [EVT-MachineModelCreated, EVT-MachineRegistered, EVT-MaintenancePlanChanged]
depends_on: [ST-005, ST-011, ST-040, ST-043, ST-061, ST-062, ST-063, ST-064, ST-065, ST-066, ST-070, ST-078]
labels: [mvp, maintenance, collection]
status: ready
---

## Task
Get La Guardia ready for the first day in the museum (story review 2026-09-26: NEW-2, merged with the former "seed the initial maintenance plan" task per decision D7). Everything is entered through La Guardia's normal commands, so the event journal contains it.

1. **Team accounts**: every technician and helper has a personal account with the right role (ST-005).
2. **Machine models and machines**: the ~60 machines and their machine models are entered with museum number, location and current machine status – manually through ST-006/ST-007 or by a one-off import that uses the same commands.
3. **Stickers**: a QR sticker is printed and attached for every machine on display (ST-011), only after the custom domain exists (ST-060).
4. **Initial maintenance plan** (decision D7): the technicians enter the 19 maintenance tasks of the "Initial Maintenance Plan" in `docs/product/vision.md` themselves through ST-040 – no seed script.
   - Mapping of "Applies to": "Pinball" → machine category Pinball; "Arcade" → Arcade; "Pinball / EM" → Pinball with technology EM; "Arcade / CRT" → Arcade with technology CRT. No maintenance tasks for machine category *Other*.
   - Each maintenance task gets **one start date** (HS-12), staggered across tasks so that the machines don't all become due on the same day.
   - Because a machine registered after a task's start date counts as last done on its registration date (HS-20 resolution, D5), the machines are entered first and the tasks' start dates are chosen on or after the day the machines were entered – otherwise the staggering is lost.
   - The technicians write a one or two sentence instruction per task; where none is written yet, the task name is used.
5. **Operations**: environments, monitoring, backups and the update routine are in place (ST-061, ST-062, ST-063); the legal texts from the museum are online (ST-064).
   - Decision (user, 2026-10-04, ST-064): because the museum has not delivered its texts yet, ST-064 ships the privacy notice with clearly marked placeholder texts in German and English, and shows no imprint until the museum provides one. Replacing them with the museum's own texts is part of this task.
6. **No spike scaffolding is left** (story review 2026-09-29): the spike code, the password-gated test page on `/` and the spike pages are gone (ST-078), and the spike configuration and data are gone (ST-066). This is a go-live blocker, not housekeeping: the blobs under the `spike/` prefix may show identifiable people and must not remain without a DPA (ADR 0006), and a password-gated test page must not be reachable in production on the museum's first day.

## Acceptance Criteria
- [ ] Every team member who takes part in the trial can log in with a personal account and the right role.
- [ ] All machines of the museum are registered with museum number, machine model, location and current machine status; the machine overview shows the same number of machines as the museum's own list.
- [ ] Every machine on display has a QR sticker; scanning three randomly chosen stickers opens the right visitor machine page.
- [ ] All 19 maintenance tasks exist with interval (1, 3 or 12 months), suitable-for-helpers mark and restriction as in `docs/product/vision.md`; none applies to machine category Other.
- [ ] Every maintenance task has an instruction (the technicians' text or the task name) and one start date on or after the day the machines were entered; start dates are staggered across tasks.
- [ ] On go-live day the due maintenance list (ST-043) shows no flood: no maintenance task is due on more than the machines the technicians expect.
- [ ] A test restore (ST-062) and a test alert (ST-061) have been done; the privacy notice is reachable from the visitor pages (ST-064).
- [ ] The museum's own privacy notice (and imprint, if the museum decides one is needed) in German and English has replaced the placeholder texts in the visitor message catalogs (`src/platform/messages/visitor.de.ts`, `visitor.en.ts`, section `legal`); no placeholder text remains on `/datenschutz` or `/impressum`.

## Out of Scope
- Maintenance records from before go-live
- Start dates per machine

## Open Questions
- none
