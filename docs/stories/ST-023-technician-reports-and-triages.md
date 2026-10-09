---
id: ST-023
title: Technician reports a problem and records a defect in the same step
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-ProblemReported, EVT-DefectRecorded, EVT-MachineStatusChanged]
depends_on: [ST-015, ST-016, ST-018]
labels: [mvp, triage, ui]
status: review
---

## Story
As a technician, I want to report a fault I found and record it as a defect in the same step, optionally changing the machine status, so that I don't have to triage my own problem reports later in the triage list.

## Context
`docs/product/vision.md`: every problem report – also from team members – is triaged by a technician; technicians triage their own reports in the same step. `CMD-ReportProblem`: a technician's own problem report is triaged in the same step.
- For technicians the triage outcome is **mandatory**: a technician's problem report is never stored untriaged and never appears in the triage list.
- This story covers the outcome *record a defect*, optionally with a machine status change (*Limited* or *Out of order*, as in ST-018). All rules of `CMD-ReportProblem` and `CMD-RecordDefect` apply. The outcomes *link* and *resolve on the spot*, and the helper variant, follow in ST-052.
- The problem report and its triage are stored together: if the triage part is rejected, the problem report is not stored either.
- A problem report describing two faults leads to one defect; the technician records further faults as own problem reports (HS-4).

**Decided in the test plan (user, 2026-10-10, during `/implement ST-023`):** the obligation is enforced by `CMD-ReportProblem` itself – a technician's problem report without a triage part is rejected, not only by the form. Tests that need an untriaged problem report arrange it as a visitor or helper.

**Form (ux-designer proposal `docs/reviews/ST-023-ux-form.md`, option B, approved by the user on 2026-10-10 during `/implement ST-023`; G21 applied to reporting, proposed as G21a):**
- **Choice page.** For a technician, „Problem melden“ on the machine record (ST-015) leads to `/team/machines/<museum number>/melden`. That page does not show ST-015's form to a technician. Under the heading „Problem melden · LG-042“ and the machine line „LG-042 · Medieval Madness“ it shows a section „Sichten“ with the sentence „Meldungen von Techniker:innen werden gleich beim Melden gesichtet.“ and one button per triage outcome the technician may choose, in the order „Mit Defekt verknüpfen“ (ST-052, only with open defects), „Defekt erfassen“, „Direkt behoben“ (ST-052); nothing is preselected. ST-023 adds only „Defekt erfassen“, and the link „Zurück zum Gerät“. Dismissing is not offered (Out of Scope). The user accepted explicitly that until ST-052 this is one extra tap that decides nothing.
- **Form page `/team/machines/<museum number>/melden/defekt-erfassen`.** Heading „Problem melden und Defekt erfassen · LG-042“. Section „Meldung“: Beschreibung with the hint „Was ist kaputt, wo am Gerät?“ (without ST-015's sentence „Eine Techniker:in sichtet die Meldung.“) and Foto (freiwillig) as in ST-016. Section „Defekt“: exactly ST-018's fields, defaults and status rule – title empty (not prefilled from the description) with ST-018's hint, priority „normal“ preselected, „Für Helfer:innen geeignet“ not set, the machine's current status in words, „Status nicht ändern“ preselected plus only the stricter statuses, or the sentence that the status stays (*Out of order*, and *Not on display*, which occurs here because team members may report for a machine not on display). No reason field; the status history entry's reason is the defect's title. Submit „Melden und Defekt erfassen“, link „Zurück zum Gerät“. Everything is sent once and stored together.
- **Rejections** stay on the form page, keep what was typed and mark the field (G8): „Bitte beschreibe das Problem.“ (the existing text; its G13 wording is changed by the follow-up ST-084), „Bitte einen Titel angeben.“, „LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“, and the existing texts for a status that is no longer stricter or a version conflict. When a photo was attached, the rejection ends with „Das Foto muss erneut ausgewählt werden.“ (G8a), e.g. „Bitte einen Titel angeben. Das Foto muss erneut ausgewählt werden.“ ST-023 builds G8a for this form only; the two existing report forms get it in ST-084. A rejected form leaves no stored photo (ST-016, "store, run, delete on failure").
- **No triage outcome** can only come from a page loaded before the change (or before the person's role changed) that sends ST-015's plain form: the technician sees the choice page with „Bitte wählen, wie die Meldung gesichtet wird. Es wurde nichts gespeichert.“ above the buttons. The description typed on that stale page is not kept – a narrow exception to G8, accepted explicitly by the user (2026-10-10).
- **Landing.** On success the technician is back on the machine record with ST-018's confirmation „Defekt „<title>“ an LG-042 erfasst.“, followed by „ LG-042 ist jetzt <status>.“ when the status was changed. ST-015's „… wartet auf die Sichtung.“ is not shown.
- **Helpers** keep ST-015's form on `/melden` unchanged; no triage outcome is offered to them (G11).

## Acceptance Criteria

Scenario: Technician reports and records a defect in one step
  Given the machine "LG-042" is Playable
  When the technician Tom reports "Left flipper coil stop broken" for "LG-042" and records the defect "Left flipper sticks" with the machine status Limited in the same step
  Then a problem report by Tom exists with the outcome defect recorded
  And the defect "Left flipper sticks" is open
  And "LG-042" is Limited
  And the problem report never appears in the triage list

Scenario: Technician's problem report needs a triage outcome
  When a technician reports a problem for "LG-042" without choosing a triage outcome
  Then the problem report is not stored
  And the technician is asked to choose how the problem report is triaged, and told that nothing was saved
  And the triage outcomes are offered
  But the description typed on the page loaded before is not kept

Scenario: Invalid triage part stores nothing
  When a technician reports a problem for "LG-042" and records a defect without a title in the same step
  Then neither the problem report nor a defect is stored

Scenario: Two faults become two own problem reports
  Given a technician found two faults on "LG-042"
  When the technician reports and records the first fault and then reports and records the second fault
  Then "LG-042" has two problem reports by that technician, each with its own defect

Scenario: Technicians are offered the triage outcome when reporting
  Given a technician is logged in
  When the technician starts reporting a problem from the machine record of "LG-042"
  Then recording a defect is offered as the triage outcome
  And a problem report without a triage outcome cannot be sent from there

Scenario: Helpers report as before
  Given a helper is logged in
  When the helper starts reporting a problem from the machine record of "LG-042"
  Then no triage outcome is offered
  And the problem report can be sent with a description only

Scenario: Only a stricter machine status when reporting
  Given the machine "LG-042" is Limited
  When a technician reports a problem for "LG-042" and records a defect in the same step
  Then the form says that "LG-042" is currently Limited
  And besides not changing the status, only Out of order is offered
  And not changing the status is preselected

Scenario: No status choice for a machine not on display
  Given the machine "LG-042" is Not on display
  When a technician reports a problem for "LG-042" and records a defect in the same step
  Then no machine status can be chosen in the same step
  And the form says that "LG-042" is already Not on display and its status stays

Scenario: Report without a description stores nothing
  When a technician reports a problem for "LG-042" without a description and records the defect "Left flipper sticks" in the same step
  Then neither the problem report nor a defect is stored
  And the reason is shown at the form, with the description marked
  And the title "Left flipper sticks" is still there

Scenario: A rejected report keeps what was typed
  Given a technician reports "Left flipper coil stop broken" for "LG-042" and records a defect with the priority high, the suitable-for-helpers mark set, the machine status Out of order and no title
  When they submit it
  Then neither the problem report nor a defect is stored
  And the reason is shown at the form, with the title marked
  And the description, the priority, the mark and the machine status they chose are still there

Scenario: A rejected report says the photo must be chosen again
  Given a technician reports a problem for "LG-042" with a photo and records a defect without a title
  When they submit it
  Then nothing is stored
  And the rejection says that the photo must be chosen again

Scenario: Machine retired in the meantime stores nothing
  Given a technician has the form for reporting a problem for "LG-042" and recording a defect open
  And "LG-042" was retired a moment ago
  When the technician submits it
  Then neither the problem report nor a defect is stored
  And the technician stays at the form and is told that "LG-042" is retired by now and nothing was saved

Scenario: After reporting, the technician is back on the machine record
  Given the machine "LG-042" is Playable
  When a technician reports a problem for "LG-042" and records the defect "Left flipper sticks" with the machine status Limited in the same step
  Then the machine record of "LG-042" is shown
  And a confirmation names the defect "Left flipper sticks" and the machine "LG-042"
  And the confirmation says that "LG-042" is now Limited
  And it does not say that the problem report waits for triage

## Out of Scope
- Linking and resolving on the spot in the same step, helpers (ST-052)
- Dismissing one's own problem report (makes no sense for a fault the technician just found)
- G8a's photo sentence on the two existing report forms (team ST-015, visitor ST-013/ST-016) and the G13 wording of „Bitte beschreibe das Problem.“ in the team catalog (follow-up ST-084, user 2026-10-10)
- Showing the new defect in an open-defects section of the machine record (open question ST-009/ST-021, 2026-10-04)
- Adding G21a to `docs/product/ux-guidelines.md` (ux-designer, after the user's approval)

## Open Questions
- none
