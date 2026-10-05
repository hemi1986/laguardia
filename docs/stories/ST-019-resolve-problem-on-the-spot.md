---
id: ST-019
title: Triage – resolve a problem on the spot
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-ProblemResolvedOnTheSpot]
depends_on: [ST-017]
labels: [mvp, triage, ui]
status: in-progress
---

## Story
As a helper, I want to mark a problem report as resolved on the spot with a short note when I fixed it immediately, so that trivial problems like a stuck ball don't become defects but still show up in the machine's repair history.

## Context
Command `CMD-ResolveProblemOnTheSpot` (actor: team member – helpers and technicians). Rules:
- The problem report has not been triaged yet – guarded by the same version check on the problem report as in ST-018, so a concurrent triage is rejected.
- A note is required.
Outcome *resolved on the spot* (`CONTEXT.md`): no defect is created; the problem report stays in the repair history (ST-033).
Helpers use the triage list only for this triage outcome (`RM-TriageList`).
Its triage outcome is offered on the problem report's own page, which ST-017 builds and owns (G18); the assertion that the outcome is offered there – and, for technician-only outcomes, not to helpers – belongs to this story (moved from ST-017, user 2026-10-03).
Page layout (story review 2026-10-03, decisions 1 and 2; G2a, G3, G8, G21): the problem report's page (ST-017) offers, in a section „Sichten“, only the outcomes the person may choose, in this order: „Mit Defekt verknüpfen“ (only when the machine has open defects), „Defekt erfassen“, „Direkt behoben“, „Meldung verwerfen“. Each is a button to its own form page (heading „<Outcome> · LG-042“) that repeats the machine and the description and has „Zurück zur Meldung“; a rejection stays on that form page and keeps what was typed; success lands on the triage list with a confirmation naming the machine. No outcome is offered on a triaged problem report. Resolving on the spot records a fact and asks nothing.
The form „Direkt behoben“ (story review 2026-10-03): the note's field is labelled „Was wurde gemacht?“ (UI wording only – the model keeps the word *note* from `events.yaml`); button „Als direkt behoben eintragen“; confirmation „Meldung zu LG-042 als direkt behoben eingetragen.“; rejections, shown at the form: „Bitte kurz beschreiben, was gemacht wurde.“ and „<Name> hat diese Meldung schon gesichtet.“

## Acceptance Criteria

Scenario: Resolving on the spot is offered on the problem report's page
  Given a problem report for "LG-042" is untriaged
  When the helper Anna or a technician opens that problem report from the triage list
  Then resolving it on the spot is offered there

Scenario: Helper resolves a problem on the spot
  Given the visitor problem report "Ball stuck behind the left ramp" for "LG-042" is untriaged
  When the helper Anna resolves it on the spot with the note "Ball freed, ramp OK"
  Then the problem report is triaged with the outcome resolved on the spot by Anna with that note
  And no defect is created
  And the problem report no longer appears in the triage list

Scenario: Visitor machine page no longer counts it
  Given the only untriaged problem report of "LG-042" was resolved on the spot
  When a visitor opens the visitor machine page of "LG-042"
  Then the page shows no untriaged problem reports

Scenario: A note is required
  When a team member resolves an untriaged problem report on the spot without a note
  Then the action is rejected
  And the problem report stays untriaged
  And the reason is shown at the form, with the note's field marked

Scenario: Already triaged problem report
  Given a problem report was triaged by Tom a moment ago
  When a helper tries to resolve the same problem report on the spot
  Then the action is rejected with the message that Tom already triaged it

Scenario: A rejected resolution keeps what was typed
  Given the helper Anna has typed the note "Ball freed, ramp OK" to resolve a problem report on the spot
  And that problem report was triaged by Tom a moment ago
  When Anna submits it
  Then nothing is recorded
  And she stays at the form, where the note "Ball freed, ramp OK" is still filled in

Scenario: After resolving, the team member is back on the triage list
  When the helper Anna resolves a problem report of "LG-042" on the spot with the note "Ball freed, ramp OK"
  Then the triage list is shown
  And a confirmation names the machine "LG-042"
  And the problem report is no longer listed

Scenario: Resolving on the spot is not offered on a triaged problem report
  Given a problem report for "LG-042" was triaged a moment ago
  When the helper Anna or a technician opens that problem report's page
  Then resolving it on the spot is not offered there

## Out of Scope
- Showing it in the repair history (ST-033)

## Open Questions
- none
