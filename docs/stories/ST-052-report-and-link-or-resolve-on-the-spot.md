---
id: ST-052
title: Report a problem and link it or resolve it on the spot in the same step
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-ProblemReported, EVT-ProblemReportLinkedToDefect, EVT-ProblemResolvedOnTheSpot]
depends_on: [ST-019, ST-022, ST-023]
labels: [mvp, triage, ui]
status: done
---

## Story
As a team member who just found and handled a problem at a machine, I want to report it and link it to a known defect or mark it as resolved on the spot in the same step, so that my own findings don't wait in the triage list.

## Context
Second part of the split of ST-023 (story review 2026-09-26). All rules of `CMD-ReportProblem`, `CMD-LinkProblemReportToDefect` (ST-022) and `CMD-ResolveProblemOnTheSpot` (ST-019) apply.
- Technicians may choose, besides recording a defect (ST-023), the outcomes *link to an open defect of the machine* and *resolve on the spot*. For technicians an outcome stays mandatory.
- Helpers may report and resolve on the spot in the same step (e.g. a stuck ball they just freed) – the only triage outcome helpers may choose. Otherwise a helper's problem report waits in the triage list.
- The problem report and its triage are stored together: if the triage part is rejected, the problem report is not stored either.
- A defect resolved in the meantime cannot be linked, as in ST-022; reopening a defect on linking stays ST-053 (user, 2026-10-10, decision 2a).

**Form (ST-023, `docs/reviews/ST-023-ux-form.md`; story review 2026-10-10, ux-designer, adopted by the user, decision 2a):**
- **Helpers (H2):** `/melden` keeps ST-015's form for helpers; above the description it shows „Schon selbst behoben?“ and the button „Direkt behoben“, which leads to the same page technicians reach from „Sichten“ – above the description, so it is seen before anything is typed.
- **Page `/melden/direkt-behoben`** (helpers and technicians): heading „Problem melden und als direkt behoben eintragen · LG-042“; section „Meldung“ (Beschreibung with the hint „Was ist kaputt, wo am Gerät?“, Foto (freiwillig) as in ST-016); section „Direkt behoben“ with the field „Was wurde gemacht?“ (ST-019); submit „Melden und als direkt behoben eintragen“; link „Zurück zum Gerät“. Rejections: the description text, „Bitte kurz beschreiben, was gemacht wurde.“, „LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“ – each followed by „Das Foto muss erneut ausgewählt werden.“ when a photo was attached (G8a). Success: the machine record with ST-019's confirmation „Meldung zu LG-042 als direkt behoben eingetragen.“
- **Page `/melden/mit-defekt-verknuepfen`** (technicians only; a helper is treated as in ST-023): heading „Problem melden und mit Defekt verknüpfen · LG-042“; section „Meldung“ as above; section „Defekt“ with the machine's open defects, each with its title and since when it is open, none preselected (ST-022); submit „Melden und mit Defekt verknüpfen“; link „Zurück zum Gerät“. Rejections: the description text, „Bitte einen Defekt auswählen.“, ST-022's text for a defect resolved in the meantime, the retired text – each with the photo sentence when a photo was attached. Success: the machine record with ST-022's confirmation „Meldung zu LG-042 mit Defekt „<title>“ verknüpft.“
- **Both pages:** sent once, stored together; ST-015's „… wartet auf die Sichtung.“ is not shown. The choice page shows „Mit Defekt verknüpfen“ (only with open defects; otherwise „LG-042 hat keine offenen Defekte.“ in its place, G7), „Defekt erfassen“, „Direkt behoben“.
- After a rejection of the photo itself (ST-016's texts, unchanged) the photo sentence is not added, as in ST-023 (user, 2026-10-10, decision 3a).

## Acceptance Criteria

Scenario: Technician reports and resolves on the spot in one step
  When a technician reports "Ball stuck in the shooter lane" for "LG-042" and resolves it on the spot with the note "Freed the ball" in the same step
  Then a problem report by that technician exists with the outcome resolved on the spot
  And no defect is created

Scenario: Technician reports and links in one step
  Given "LG-042" has the open defect "Left flipper weak"
  When a technician reports "Left flipper weak again during test" and links it to "Left flipper weak" in the same step
  Then the problem report is triaged with the outcome linked
  And no defect is created

Scenario: Helper reports and resolves on the spot in one step
  When the helper Anna reports "Ball stuck behind the left ramp" for "LG-042" and resolves it on the spot with the note "Ball freed" in the same step
  Then a problem report by Anna exists with the outcome resolved on the spot
  And it never appears in the triage list

Scenario: Helpers cannot link a problem report to a defect when reporting
  Given a helper is logged in
  And "LG-042" has the open defect "Left flipper weak"
  When the helper opens the form for reporting a problem for "LG-042" and linking it
  Then the helper sees the plain form for reporting a problem instead
  But if the helper sends a problem report linked to "Left flipper weak" anyway, neither the problem report nor a link is stored

Scenario: Helpers' other problem reports still go to the triage list
  When a helper reports a problem for "LG-042" without resolving it on the spot
  Then the problem report is untriaged and appears in the triage list

Scenario: Technicians are offered all three triage outcomes when reporting
  Given "LG-042" has the open defect "Left flipper weak"
  When a technician starts reporting a problem from the machine record of "LG-042"
  Then linking to a defect, recording a defect and resolving on the spot are offered, in this order

Scenario: No open defect, nothing to link when reporting
  Given "LG-042" has no open defect
  When a technician starts reporting a problem from the machine record of "LG-042"
  Then linking to a defect is not offered
  And the page says that "LG-042" has no open defects

Scenario: Helpers are offered resolving on the spot when reporting
  Given a helper is logged in
  When the helper starts reporting a problem from the machine record of "LG-042"
  Then the problem report can be sent with a description only
  And resolving it on the spot in the same step is offered before the description

Scenario: A rejected resolution on the spot keeps what was typed
  Given the helper Anna reports "Ball stuck behind the left ramp" for "LG-042" and resolves it on the spot without a note
  When she submits it
  Then the problem report is not stored
  And the reason is shown at the form, with the note's field marked
  And the description "Ball stuck behind the left ramp" is still there

Scenario: A rejected link keeps what was typed
  Given "LG-042" has the open defect "Left flipper weak"
  And a technician reports "Left flipper weak again during test" for "LG-042" and links it without choosing a defect
  When they submit it
  Then the problem report is not stored
  And the reason is shown at the form
  And the description is still there

Scenario: A defect resolved in the meantime cannot be linked when reporting
  Given a technician has the form for reporting a problem for "LG-042" and linking it open, offering "Left flipper weak"
  And "Left flipper weak" was resolved a moment ago
  When the technician submits it linked to "Left flipper weak"
  Then neither the problem report nor a link is stored
  And the technician stays at the form, where the description is still filled in

Scenario: After resolving on the spot when reporting, back on the machine record
  When the helper Anna reports a problem for "LG-042" and resolves it on the spot with the note "Ball freed"
  Then the machine record of "LG-042" is shown
  And a confirmation says that the problem report for "LG-042" was resolved on the spot
  And it does not say that the problem report waits for triage

Scenario: After linking when reporting, back on the machine record
  Given "LG-042" has the open defect "Left flipper weak"
  When a technician reports a problem for "LG-042" and links it to "Left flipper weak"
  Then the machine record of "LG-042" is shown
  And a confirmation names the machine "LG-042" and the defect "Left flipper weak"

## Out of Scope
- Recording a defect in the same step (ST-023)
- Reopening a defect resolved in the meantime when linking (ST-053)
- Adding G21a and the H2 sentence to `docs/product/ux-guidelines.md` (ux-designer)

## Open Questions
- none

## Notes
- Built right after ST-023 (story review 2026-10-10, PO) – run `/implement ST-052` explicitly.
