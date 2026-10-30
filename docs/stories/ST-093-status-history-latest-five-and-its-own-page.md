---
id: ST-093
title: Status history on the machine record – the latest five and a page of its own
type: story
context: BC-Collection
priority: should
size: S
risk: low
events: [EVT-MachineStatusChanged, EVT-MachineRegistered]
depends_on: []
labels: [ui, feature:consistent-layout-dark-mode]
status: in-progress
---

## Story
As a team member, I want the machine record to show only the latest status changes and lead me to the whole status history on a page of its own, so that after years of changes the repair history and the files are not pushed far down the page.

## Context
Finding **F2** of the consistency audit `docs/reviews/2026-10-25-ux-audit-consistency.md`, accepted by the user in the `/feature` grilling of 2026-10-25. Yardstick `docs/product/ux-guidelines.md` **G24** (history on a record: the latest five, a link „Alle … (n)“ to a page of its own headed „… · LG-042“, grouped by year once it can pass about 20 entries, „Zurück zum Gerät“), with G17, G29. Changes the done story **ST-009** (section 6 of the machine record, the status history, which lists every entry); not reopened. Read model `RM-MachineRecord`, fed by `EVT-MachineRegistered` (the first entry) and `EVT-MachineStatusChanged`.

- Section 6 of the machine record (owner ST-009, G18), „Status-Historie“, shows the **5 latest entries**, newest first, each with previous status, new status, reason, who and when, as today.
- With more than 5 entries, below them the link **„Alle Statusänderungen (n)“** – n counts every entry, the registration included – leads to the page **„Status-Historie · LG-042“** with all entries, newest first, and the back link „Zurück zum Gerät“. The link is not shown with 5 entries or fewer.
- That page **groups the entries by year with a count each** („2026 · 4 Einträge“), like the maintenance records' page (ST-047) and the repair history's page (ST-033). The year is the calendar year in Europe/Berlin – an entry at 00:30 on 1 January in Berlin belongs to the new year, although it is still 31 December in UTC.
- A retired machine keeps its status history, on the record and on the page (ST-009, ST-039).
- The page of a **reserved museum number** (a machine's earlier museum number after a correction, ST-035) leads to the page of the current museum number, as the machine record does.
- Team members only, like the machine record.

## Acceptance Criteria

Scenario: The machine record shows the latest five status changes
  Given "LG-042" has 8 entries in its status history
  When a team member opens the machine record of "LG-042"
  Then the status history shows the 5 newest entries, newest first
  And the link „Alle Statusänderungen (8)“ is shown below them

Scenario: The whole status history on its own page
  Given "LG-042" has 8 entries in its status history, 3 of them in 2025 and 5 in 2026
  When a team member follows „Alle Statusänderungen (8)“
  Then the page is headed „Status-Historie · LG-042“
  And it shows all 8 entries, newest first, under „2026 · 5 Einträge“ and „2025 · 3 Einträge“
  And „Zurück zum Gerät“ leads back to the machine record of "LG-042"

Scenario: A short status history needs no link
  Given "LG-050" was registered as Playable and its machine status has never been changed
  When a team member opens the machine record of "LG-050"
  Then the status history shows only „Erfasst als Spielbereit“
  And no link to all status changes is shown

Scenario: Five entries need no link, six do
  Given "LG-043" has 5 entries in its status history and "LG-044" has 6
  When a team member opens the machine records of "LG-043" and "LG-044"
  Then "LG-043" shows all 5 entries and no link to all status changes
  And "LG-044" shows its 5 newest entries and the link „Alle Statusänderungen (6)“

Scenario: The year of an entry is the year in Berlin
  Given "LG-042" was registered in 2025 and its machine status was changed only once since, at 00:30 on 1 January 2026 in Berlin (23:30 on 31 December 2025 in UTC)
  When a team member opens „Status-Historie · LG-042“
  Then the change is listed under „2026 · 1 Eintrag“ and the registration under „2025 · 1 Eintrag“

Scenario: A reserved museum number leads to the current one
  Given the museum number of "LG-024" was corrected to "LG-042"
  When a team member opens the status history page of "LG-024"
  Then they are on „Status-Historie · LG-042“

Scenario: A retired machine's status history stays reachable
  Given the retired machine "LG-013" has 7 entries in its status history
  When a team member opens its machine record and follows „Alle Statusänderungen (7)“
  Then all 7 entries are shown

Scenario: The page of an unknown machine
  When a team member opens the status history page of "LG-999", which does not exist
  Then La Guardia says that no machine with this museum number exists

Scenario: Visitors do not reach the status history page
  Given nobody is logged in
  When the status history page of "LG-042" is opened
  Then the login is requested first

## Out of Scope
- Changing how a status change is recorded (ST-012)

## Open Questions
- none

## Notes
- Size estimate by the requirements engineer: S (the audit says M) – one new page in the shape of the two existing history pages. Lead dev (story review 2026-10-25): S, low; the Berlin year boundary is a table test on the grouping.
- Built last of the layout chain ST-089–ST-093 (user, story review 2026-10-25, decision 3).
