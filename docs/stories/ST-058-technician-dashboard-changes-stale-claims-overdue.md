---
id: ST-058
title: Technician dashboard – recent changes, stale claims and overdue maintenance
type: story
context: BC-Repair
priority: should
size: M
risk: low
events: [EVT-MachineStatusChanged, EVT-DefectResolved, EVT-DefectReopened, EVT-DefectClaimed, EVT-WorkLogged, EVT-MaintenanceTaskOverdue]
depends_on: [ST-024, ST-026, ST-030, ST-043, ST-048]
labels: [mvp, dashboard, ui]
status: in-progress
---

## Story
As a technician, I want the technician dashboard to also show recent machine status changes, resolved and reopened defects, stale claims and overdue maintenance, so that I see everything that needs my attention in one place.

## Context
Read model `RM-TechnicianDashboard`, second part of the split of ST-048 (story review 2026-09-26).
- Machine status changes and defects resolved or reopened of the last 7 days – or since the technician's previous dashboard visit, if that is longer ago (the previous visit is recorded from ST-050 on; until then 7 days).
- *Stale claims* (`CONTEXT.md`): claims older than 14 days (more than 336 hours, ST-003) without a work log entry – by anyone – since the claim. Stale claims are only singled out, never released automatically.
- Overdue maintenance tasks (rules of ST-043 and ST-056).
All values are computed when the dashboard is opened.
UI wording (de): Liegengeblieben (stale claim).

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G18, G4a, G6a, G7). ST-048 owns the page (G18); this story fills its sections 3 to 5, at their places:
- **3 „Liegengeblieben“** – each stale claim with the defect's title, its machine and its claimant, and the reason in words (claimed more than 14 days ago without a work log entry, G6a); each leads to the defect's page.
- **4 „Überfällige Wartung“** – each overdue maintenance task with how many machines it is overdue on, not the machines themselves, and a link to „Wartung“ (G18: the dashboard never repeats the due maintenance list).
- **5 „Letzte Änderungen“** – machine status changes with who and when, and defects resolved or reopened, newest first. Recent changes are not something that needs attention: they are shown below ST-048's all-empty sentence when everything else is empty.
- Empty sections follow ST-048's pattern: an empty section next to a filled one says so in a short sentence of its own; ST-048's all-empty sentence also covers sections 3 and 4.

## Acceptance Criteria

Scenario: Stale claims are singled out
  Given the defect "Display flickers" was claimed by Ben 15 days ago and has no work log entry since the claim
  When a technician opens the technician dashboard
  Then "Display flickers" is listed as a stale claim of Ben, with the reason in words
  And it is still claimed by Ben

Scenario: A work log entry by someone else keeps a claim from being stale
  Given the defect "Display flickers" was claimed by Ben 15 days ago
  And the technician Tom logged work on it 3 days ago
  When a technician opens the technician dashboard
  Then "Display flickers" is not listed as a stale claim

Scenario: Overdue maintenance tasks are counted, not listed by machine
  Given "Wax playfield" is overdue on "LG-042" and "LG-043"
  When a technician opens the technician dashboard
  Then it says that "Wax playfield" is overdue on 2 machines
  And the due maintenance list can be opened from there

Scenario: Machine status changes and resolved or reopened defects
  Given the helper Anna set "LG-007" to Out of order yesterday
  And the defect "Left flipper weak" was reopened today
  When a technician opens the technician dashboard
  Then the status change of "LG-007" by Anna and the reopened "Left flipper weak" are shown

Scenario: Older changes drop off after 7 days
  Given a machine status change happened 8 days ago
  And the technician visited the dashboard since then
  When the technician opens the technician dashboard
  Then that machine status change is not shown

Scenario: An empty section says so next to a filled one
  Given no claim is stale
  And "Wax playfield" is overdue on "LG-042"
  When a technician opens the technician dashboard
  Then the stale claims section says that no claim is stale
  And the overdue maintenance section names "Wax playfield"

Scenario: Recent changes are shown below the all-empty sentence
  Given nothing needs the technician's attention
  And the technician Tom set "LG-007" to Playable yesterday
  When a technician opens the technician dashboard
  Then it says that nothing needs attention right now
  And below that it shows the status change of "LG-007" by Tom

## Out of Scope
- Marking what is new since the last visit (ST-050)

## Open Questions
- none
