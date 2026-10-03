---
id: ST-020
title: Triage – dismiss a problem report, removing spam content
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-ProblemReportDismissed]
depends_on: [ST-017, ST-016]
labels: [mvp, triage, ui]
status: review
---

## Story
As a technician, I want to dismiss a problem report with a reason when it describes no fault or is spam, so that the triage list stays clean and spam text or photos are not kept.

## Context
Command `CMD-DismissProblemReport` (technicians only). Rules and invariants:
- The problem report has not been triaged yet.
- A reason is required, chosen from *not a fault*, *spam* or *other*; *other* requires a free text.
- Dismissing as spam removes the description and the photo – a problem report dismissed as spam has no description and no photo.
- The stored photo is deleted from object storage after the dismissal is committed; if that deletion fails, the failure is logged (without the photo or text) and can be retried. A short delay until a cached copy disappears from the storage provider's delivery network is acceptable, because photos are team-only anyway.
- In the MVP this is the only protection against spam (decision D3).
- The reason "machine retired" is set only automatically by `POL-RetirementDismissesProblemReports` (ST-039).
- Its triage outcome is offered on the problem report's own page, which ST-017 builds and owns (G18); the assertion that the outcome is offered there – and, for technician-only outcomes, not to helpers – belongs to this story (moved from ST-017, user 2026-10-03).

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
  Given a problem report was resolved on the spot a moment ago
  When a technician tries to dismiss the same problem report
  Then the action is rejected with the message that it was already triaged

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
