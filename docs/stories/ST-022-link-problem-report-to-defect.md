---
id: ST-022
title: Triage – link a problem report to an open defect
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-ProblemReportLinkedToDefect]
depends_on: [ST-018, ST-021]
labels: [mvp, triage, ui]
status: done
---

## Story
As a technician, I want to link a problem report to an already known defect of the same machine, so that duplicate reports don't create duplicate defects but still count as evidence for that defect.

## Context
Command `CMD-LinkProblemReportToDefect` (technicians only). Rules and invariants:
- The problem report has not been triaged yet.
- The defect belongs to the same machine as the problem report.
- A linked problem report refers to exactly one defect; the outcome never changes.
The problem report's own page (built by ST-017) shows the open defects of the machine for linking – not the triage list. The open defects list shows the number of linked problem reports.
Linking uses the same version check on the problem report as ST-018.
From ST-053 on, linking to a resolved defect reopens it (`POL-LinkReopensResolvedDefect`); until then it is rejected.
Its triage outcome is offered on the problem report's own page, which ST-017 builds and owns (G18); the assertion that the outcome is offered there – and, for technician-only outcomes, not to helpers – belongs to this story (moved from ST-017, user 2026-10-03).
Page layout (story review 2026-10-03, decisions 1 and 2; G2a, G3, G8, G21): the problem report's page (ST-017) offers, in a section „Sichten“, only the outcomes the person may choose, in this order: „Mit Defekt verknüpfen“ (only when the machine has open defects), „Defekt erfassen“, „Direkt behoben“, „Meldung verwerfen“. Each is a button to its own form page (heading „<Outcome> · LG-042“) that repeats the machine and the description and has „Zurück zur Meldung“; a rejection stays on that form page and keeps what was typed; success lands on the triage list with a confirmation naming the machine. No outcome is offered on a triaged problem report. Linking records a fact and asks nothing.
The form „Mit Defekt verknüpfen“ (story review 2026-10-03): the machine's open defects, each with its title and since when it is open, none preselected; button „Mit Defekt verknüpfen“; confirmation „Meldung zu LG-042 mit Defekt „<title>“ verknüpft.“; rejection, shown at the form: „Bitte einen Defekt auswählen.“ When the machine has no open defect, linking is not offered and the page says so in words (G7).
A defect resolved after the page was opened cannot be linked – the action is rejected (decision 6). ST-053 later reopens a resolved defect on linking instead.

## Acceptance Criteria

Scenario: Open defects of the machine are offered for linking
  Given "LG-042" has the open defect "Left flipper weak"
  And a problem report for "LG-042" is untriaged
  When a technician opens that problem report from the triage list
  Then linking it to the open defect "Left flipper weak" is offered on that problem report's page

Scenario: Technician links a problem report to an open defect
  Given the open defect "Left flipper weak" of "LG-042"
  And the untriaged visitor problem report "Flipper on the left does nothing" for "LG-042"
  When a technician links the problem report to "Left flipper weak"
  Then the problem report is triaged with the outcome linked, referring to "Left flipper weak"
  And the open defects list shows 1 linked problem report for "Left flipper weak"
  And the defect details of "Left flipper weak" show the linked problem report

Scenario: Visitor count drops after linking
  Given the only untriaged problem report of "LG-042" is linked to "Left flipper weak"
  When a visitor opens the visitor machine page of "LG-042"
  Then the page shows no untriaged problem reports
  And "Left flipper weak" is shown as an open defect

Scenario: Defect of another machine cannot be linked
  Given the open defect "Display flickers" belongs to "LG-007"
  When a technician tries to link a problem report of "LG-042" to "Display flickers"
  Then the action is rejected
  And the problem report stays untriaged

Scenario: Already triaged problem report
  Given a problem report was triaged by Tom a moment ago
  When a technician tries to link the same problem report to a defect
  Then the action is rejected with the message that Tom already triaged it

Scenario: No open defect, nothing to link
  Given "LG-042" has no open defect
  And a problem report for "LG-042" is untriaged
  When a technician opens that problem report from the triage list
  Then linking it to a defect is not offered there
  And the page says that "LG-042" has no open defects

Scenario: A defect has to be chosen
  Given "LG-042" has the open defect "Left flipper weak"
  When a technician links an untriaged problem report of "LG-042" without choosing a defect
  Then the action is rejected
  And the problem report stays untriaged
  And the reason is shown at the form

Scenario: After linking, the technician is back on the triage list
  When a technician links a problem report of "LG-042" to the open defect "Left flipper weak"
  Then the triage list is shown
  And a confirmation names the machine "LG-042" and the defect "Left flipper weak"
  And the problem report is no longer listed

Scenario: A defect resolved in the meantime cannot be linked
  Given a technician has the page of an untriaged problem report for "LG-042" open, offering the open defect "Left flipper weak"
  And "Left flipper weak" was resolved a moment ago
  When the technician links the problem report to "Left flipper weak"
  Then the action is rejected
  And the problem report stays untriaged
  And "Left flipper weak" stays resolved

Scenario: Linking is not offered on a triaged problem report
  Given "LG-042" has the open defect "Left flipper weak"
  And a problem report for "LG-042" was triaged a moment ago
  When a technician opens that problem report's page
  Then linking it is not offered there

Scenario: Helpers cannot link
  Given a helper is logged in
  And "LG-042" has the open defect "Left flipper weak"
  And a problem report for "LG-042" is untriaged
  When the helper opens that problem report from the triage list
  Then linking is not offered there
  But if the helper tries to link it to "Left flipper weak" anyway, the action is rejected

## Out of Scope
- Linking to a resolved defect, which reopens it (ST-053)

## Open Questions
- none
