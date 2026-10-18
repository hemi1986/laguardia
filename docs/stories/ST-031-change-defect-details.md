---
id: ST-031
title: Change a defect's title or suitable-for-helpers mark
type: story
context: BC-Repair
priority: should
size: S
risk: low
events: [EVT-DefectDetailsChanged, EVT-DefectClaimReleased]
depends_on: [ST-025]
labels: [mvp, defect-work, ui]
status: done
---

## Story
As a technician, I want to change the title or the suitable-for-helpers mark of an open defect, so that visitors see an understandable title and helpers get the defects they can handle once more is known.

## Context
Command `CMD-ChangeDefectDetails` (technicians only, HS-18). Rules and invariants:
- The defect is not resolved (and not closed on retirement).
- The title is required and stays understandable for visitors; it is shown untranslated on the visitor machine page.
- Only defects suitable for helpers can be claimed by, assigned to or resolved by helpers.
- Removing the suitable-for-helpers mark while a helper holds the claim releases that claim in the same step (rule on `CMD-ChangeDefectDetails`); the helper dashboard shows the release (ST-049).

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G21, G22):
- The action sits behind „Verwalten“ as „Titel und Eignung ändern“ (G22) and leads to its own form page with the title field – carrying the title hint of ST-018's form (understandable for visitors) – and the suitable-for-helpers mark; submit „Defekt ändern“.
- While a helper holds the claim, the form says next to the mark that removing it releases that helper's claim.
- The confirmation names the change and, when a claim was released, the released claim and its helper.

## Acceptance Criteria

Scenario: Technician changes the title
  Given the open defect "EOS sw. L fl." of "LG-042"
  When a technician changes its title to "Left flipper weak"
  Then the defect has the title "Left flipper weak"
  And the visitor machine page of "LG-042" shows "Left flipper weak"

Scenario: Technician marks a defect as suitable for helpers
  Given the open defect "Rubber cracked" is not suitable for helpers
  When a technician marks it as suitable for helpers
  Then helpers can claim and resolve "Rubber cracked"

Scenario: Title is required
  When a technician changes the title of an open defect to an empty title
  Then the change is rejected

Scenario: Resolved defects cannot be changed
  Given the defect "Coin door jammed" is resolved
  When a technician tries to change its title
  Then the change is rejected

Scenario: Helpers cannot change defect details
  Given a helper is logged in
  When the helper tries to change the title of a defect
  Then the change is rejected

Scenario: Removing the mark releases a helper's claim
  Given the defect "Rubber cracked" is suitable for helpers and claimed by the helper Anna
  When a technician removes the suitable-for-helpers mark
  Then "Rubber cracked" is no longer suitable for helpers
  And Anna's claim is released in the same step
  And "Rubber cracked" is not claimed
  And the confirmation names that Anna's claim was released

Scenario: The form says that removing the mark releases the helper's claim
  Given the defect "Rubber cracked" is suitable for helpers and claimed by the helper Anna
  When a technician opens the form to change its title and suitability
  Then the form says that removing the suitable-for-helpers mark releases Anna's claim

Scenario: Removing the mark keeps a technician's claim
  Given the defect "Rubber cracked" is suitable for helpers and claimed by the technician Tom
  When a technician removes the suitable-for-helpers mark
  Then "Rubber cracked" is still claimed by Tom

## Out of Scope
- Priority (ST-027)

## Open Questions
- none
