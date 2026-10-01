---
id: ST-082
title: Deactivating a team member asks once, and can be undone
type: story
context: BC-Team
priority: must
size: null
risk: null
events: []
depends_on: [ST-081]
labels: [ui]
status: draft
---

## Story
As a technician, I want to be asked once before I end a team member's access, and to be able to give it back, so that a mis-tap on a phone does not cost a volunteer their access for good.

## Context
Deactivating is one tap, it ends every session of that account, and nothing in La Guardia undoes it today. This story is what makes guideline **G10a** true – "what a person *sets* to manage access or visibility, they can unset" – together with **G10**, the question that names the person and the consequences nobody sees on this screen.

- The question names the team member by name and says that they are logged out immediately ("Zugang für Anna Berger beenden? Anna wird sofort abgemeldet.", G10, G13).
- The account is deactivated only after the technician confirms; cancelling changes nothing at all.
- A technician can **activate a deactivated account again**, and that team member can log in again with their password (G10a). Reactivating was out of scope in ST-005.
- The last active technician account still cannot be deactivated, so the team can never lock itself out (ST-005). The confirmation is never shown for a change that would be refused anyway (G11).
- The team member's name stays on everything they did, deactivated or not (`CONTEXT.md`, **Account**).
- Both actions live on the team member's own page (ST-081), not on the list entry (G5).
- ST-005 is `done` and is not reopened; this is new behaviour on top of it.

## Acceptance Criteria

Scenario: Deactivating asks once and names the person
  Given the team member "Anna Berger" has an active account and is logged in on her phone
  When a technician chooses to end her access
  Then it asks once, naming "Anna Berger" and saying that she is logged out immediately
  And her account is deactivated only after the technician confirms

Scenario: Cancelling the deactivation changes nothing
  Given a technician was asked whether to end the access of "Anna Berger"
  When the technician does not confirm
  Then Anna's account is still active
  And her session on her phone still works

Scenario: A technician gives access back
  Given the account of "Anna Berger" is deactivated
  When a technician activates her account again
  Then her account is active
  And Anna can log in again with her password

Scenario: The last active technician still cannot be deactivated
  Given exactly one active technician account exists
  When a technician chooses to end the access of that account
  Then the change is refused because at least one active technician must remain
  And no question is asked

## Out of Scope
- The account list, its search and the team member's own page (ST-081)
- An audit trail of who deactivated or reactivated an account (its own feature after ST-005)
- Deleting accounts – the history keeps the names (ST-005)

## Open Questions
- none
</content>
