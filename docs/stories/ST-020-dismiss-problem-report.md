---
id: ST-020
title: Triage – dismiss a problem report, removing spam content
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-ProblemReportDismissed]
depends_on: [ST-017, ST-016]
labels: [mvp, triage, ui]
status: in-progress
---

## Story
As a technician, I want to dismiss a problem report with a reason when it describes no fault or is spam, so that the triage list stays clean and spam text or photos are not kept.

## Context
Command `CMD-DismissProblemReport` (technicians only by hand). Rules and invariants:
- The problem report has not been triaged yet.
- A reason is required, chosen from *not a fault*, *spam* or *other*; *other* requires a free text.
- Dismissing as spam removes the description and the photo – a problem report dismissed as spam has no description and no photo.
- The stored photo is deleted through the storage seam as part of the command's flow (ADR 0007), after the dismissal is committed; if that deletion fails, the dismissal stands and the failure is logged (without the photo or text) and can be retried. A short delay until a cached copy disappears from the storage provider's delivery network is acceptable, because photos are team-only anyway.
- In the MVP this is the only protection against spam (decision D3).
- The reason "machine retired" is set only automatically by `POL-RetirementDismissesProblemReports` (ST-039).
- The dismissing actor is not hard-coded as a technician: on retirement the system dismisses (ST-039). How a system triage stores "triaged by" is ST-039's decision – the CHECK of migration 0009 requires a TeamMemberId today (story review 2026-10-03).
- A problem report dismissed as spam leaves the triage list and is not part of the repair history (ST-033 shows only problem reports resolved on the spot). The only place it is still shown is its own page (ST-017), opened directly; this story makes that page show it as dismissed without description and photo, since it is the first to leave a problem report without a description.
- Its triage outcome is offered on the problem report's own page, which ST-017 builds and owns (G18); the assertion that the outcome is offered there – and, for technician-only outcomes, not to helpers – belongs to this story (moved from ST-017, user 2026-10-03).
- Page layout (story review 2026-10-03, decisions 1 and 2; G2a, G3, G8, G21): the problem report's page (ST-017) offers, in a section „Sichten“, only the outcomes the person may choose, in this order: „Mit Defekt verknüpfen“ (only when the machine has open defects), „Defekt erfassen“, „Direkt behoben“, „Meldung verwerfen“. Each is a button to its own form page (heading „<Outcome> · LG-042“) that repeats the machine and the description and has „Zurück zur Meldung“; a rejection stays on that form page and keeps what was typed; success lands on the triage list with a confirmation naming the machine. No outcome is offered on a triaged problem report.
- The form „Meldung verwerfen“ (story review 2026-10-03): the reasons in this order, none preselected – „Kein Defekt“, „Spam“, „Anderer Grund“ (the glossary's UI wording); „Gerät ausgemustert“ is never offered by hand. The free text is always visible, labelled „Begründung (nur bei „Anderer Grund“)“. Button „Meldung verwerfen“.
- Only dismissing as spam asks first, once (decision 2, G10): „Meldung zu LG-042 als Spam verwerfen? Beschreibung und Foto werden endgültig gelöscht.“ with „Endgültig verwerfen“ / „Zurück“. The other reasons record a fact and ask nothing.
- Confirmation: „Meldung zu LG-042 verworfen.“ Rejections, shown at the form: „Bitte einen Grund auswählen.“, „Bitte den Grund beschreiben.“

## Acceptance Criteria

Scenario: Technician dismisses a problem report
  Given the visitor problem report "Way too hard to score" for "LG-042" is untriaged
  When a technician dismisses it with the reason "not a fault"
  Then the problem report is triaged with the outcome dismissed and the reason "not a fault"
  And it no longer appears in the triage list

Scenario: Dismissing as spam removes text and photo
  Given an untriaged visitor problem report for "LG-042" contains an advertisement text and a photo
  When a technician dismisses it with the reason spam
  Then the problem report has neither description nor photo anymore
  And the stored photo is gone
  And the dismissal with reason, technician and time is kept
  And its page shows it as dismissed as spam, without description and photo

Scenario: Dismissing as spam asks first
  Given an untriaged problem report for "LG-042" has a description and a photo
  When a technician chooses to dismiss it as spam
  Then they are asked once whether to dismiss it as spam, being told that description and photo will be deleted for good
  And if they go back, nothing is dismissed and spam is still chosen
  And if they confirm, the problem report is dismissed as spam

Scenario: Failed photo deletion does not undo the dismissal
  Given an untriaged problem report for "LG-042" has a description and a photo
  And deleting the photo from storage fails
  When a technician dismisses it as spam
  Then the problem report is still dismissed, without description and without photo reference
  And the failure is logged without the description or the photo

Scenario: A reason is required
  When a technician dismisses an untriaged problem report without a reason
  Then the action is rejected
  And the problem report stays untriaged

Scenario: Reason "other" needs a free text
  When a technician dismisses an untriaged problem report with the reason other and no free text
  Then the action is rejected

Scenario: Dismissing with the reason "other"
  When a technician dismisses an untriaged problem report with the reason other and the text "Machine was switched off on purpose for an event"
  Then the problem report is dismissed with the reason other and that text

Scenario: "Machine retired" cannot be chosen by hand
  When a technician dismisses an untriaged problem report
  Then only the reasons not a fault, spam and other can be chosen

Scenario: Already triaged problem report
  Given a problem report was triaged by Tom a moment ago
  When a technician tries to dismiss the same problem report
  Then the action is rejected with the message that Tom already triaged it

Scenario: A rejected dismissal keeps what was chosen
  Given a technician dismisses an untriaged problem report with the reason other and no free text
  When they submit it
  Then nothing is dismissed and the problem report stays untriaged
  And the reason for the rejection is shown at the form, with the free text marked
  And the reason other is still chosen

Scenario: After dismissing, the technician is back on the triage list
  When a technician dismisses a problem report of "LG-042" with the reason "not a fault"
  Then the triage list is shown
  And a confirmation names the machine "LG-042"
  And the problem report is no longer listed

Scenario: Dismissing is not offered on a triaged problem report
  Given a problem report for "LG-042" was triaged a moment ago
  When a technician opens that problem report's page
  Then dismissing it is not offered there

Scenario: Dismissing is offered on the problem report's page
  Given a problem report for "LG-042" is untriaged
  When a technician opens that problem report from the triage list
  Then dismissing it is offered there

Scenario: Helpers cannot dismiss
  Given a helper is logged in
  And a problem report for "LG-042" is untriaged
  When the helper opens that problem report from the triage list
  Then dismissing is not offered there
  But if the helper tries to dismiss it anyway, the action is rejected

## Out of Scope
- Automatic dismissal when a machine is retired (ST-039)

## Open Questions
- none
