---
id: ST-081
title: Find a team member, and deactivate with one question and a way back
type: story
context: BC-Team
priority: could
size: S
risk: null
events: []
depends_on: []
labels: [ui]
status: draft
---

## Story
As a technician, I want to find one team member in the list, act on that one account on its own page, be asked once before I end a team member's access and be able to give it back, so that I can give a new volunteer access or help someone who is locked out without reading every account in the museum, and a mis-tap on a phone does not cost a volunteer their access for good.

## Context
One story since the backlog grooming of 2026-10-11 (user decision of 2026-10-12): ST-082 ("Deactivating a team member asks once, and can be undone") was merged into this one – 10 to 15 people need no story of their own for the search.

The team members page does three jobs at once today – find a person, change a person, create a person – and does none of them well (G1). Every entry carries a role button, a password field and a destructive button, which turns ten team members into eighteen screens of scrolling and puts "Zugang beenden" under every name (G5). This story splits it.

Words (G12, `CONTEXT.md`): the person is the **team member** (*Teammitglied*), their access is the **account** (*Konto*). Lists, headings and navigation are about team members; resetting a password, changing a role and deactivating act on the account.

**Finding a team member and acting on one account**
- The list shows one entry per team member with what tells them apart – name, username, role, and whether their account is active – and no actions (G5).
- It says how many team members there are and offers a search over name and username (G4).
- **Deactivated accounts are not listed until a filter asks for them**, and are marked as deactivated when they are. The wording stays consistent with the "show retired machines" filter of ST-055.
- Each team member has their own page, and that page carries the actions a technician may take on their account: change the role, reset the password, deactivate – and, for a deactivated account, activate it again.
- Creating a team member is reached by a named action under the heading of the list and happens on its own page; on success the technician lands back on the list with a confirmation naming the person (G2a, G3).
- Helpers do not reach this page, and the Team module refuses them anyway (G11, ADR 0004).

**Deactivating asks once and can be undone** (from ST-082)
- Deactivating is one tap today, it ends every session of that account, and nothing in La Guardia undoes it. This part is what makes guideline **G10a** true – "what a person *sets* to manage access or visibility, they can unset" – together with **G10**, the question that names the person and the consequences nobody sees on this screen.
- The question names the team member by name and says that they are logged out immediately ("Zugang für Anna Berger beenden? Anna wird sofort abgemeldet.", G10, G13).
- The account is deactivated only after the technician confirms; cancelling changes nothing at all.
- A technician can **activate a deactivated account again**, and that team member can log in again with their password (G10a). Reactivating was out of scope in ST-005.
- The last active technician account still cannot be deactivated, so the team can never lock itself out (ST-005). The confirmation is never shown for a change that would be refused anyway (G11).
- The team member's name stays on everything they did, deactivated or not (`CONTEXT.md`, **Account**).
- Both actions live on the team member's own page, not on the list entry (G5).

ST-005 is `done` and is not reopened – the rules it established (unique username, at least 10 characters, the last active technician is protected) stay exactly as they are; this story changes where a technician does these things and adds the question and the way back on top.

ST-080 is not built as a story (backlog grooming 2026-10-11): the team members page is rebuilt here, on the house pattern (G8, G9), instead of being converted first.

## Acceptance Criteria

Scenario: The list shows one entry per team member
  Given the active accounts of "Anna Berger" (Helper) and "Tom Keller" (Technician) exist
  When a technician opens the team members page
  Then both are listed with name, username and role
  And no action on an account is offered in the list

Scenario: How many team members there are
  Given 10 team members have an active account
  When a technician opens the team members page
  Then it says that there are 10 team members

Scenario: Finding a team member by name or username
  Given the team members "Anna Berger" (username "anna") and "Tom Keller" (username "tom") exist
  When a technician searches for "berger"
  Then only "Anna Berger" is listed
  And searching for "tom" lists only "Tom Keller"

Scenario: No team member matches the search
  When a technician searches the team members for "schmidt" and nobody matches
  Then no team member is listed
  And it says that no team member matches this search
  And clearing the search is offered

Scenario: Deactivated accounts are behind a filter
  Given "Anna Berger" has an active account and "Ben Weber" a deactivated one
  When a technician opens the team members page
  Then "Ben Weber" is not listed
  And when the technician asks for deactivated accounts as well, "Ben Weber" is listed and marked as deactivated

Scenario: The actions of an account live on its own page
  Given the team member "Anna Berger" has an active account
  When a technician opens "Anna Berger" from the list
  Then her name, username, role and whether her account is active are shown
  And changing the role, resetting the password and deactivating the account are offered there

Scenario: Creating a team member happens on its own page
  When a technician creates the team member "Clara Vogt" with the username "clara", an initial password and the role Helper
  Then the team members page is shown with "Clara Vogt" in it
  And a confirmation names "Clara Vogt"

Scenario: A rejected creation keeps what was typed, never the password
  Given an account with the username "anna" exists
  When a technician creates a team member with the name "Anna Bauer", the username "anna" and the role Helper
  Then the creation is rejected because the username is already taken
  And the reason is shown at the form, with the username marked
  And the name and the role are still filled in, and the password field is empty

Scenario: Helpers do not reach the team members page
  Given a helper is logged in
  When the helper looks at the team navigation
  Then the team members page is not offered
  And opening it anyway is refused

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
- An audit trail of who created, changed, deactivated or reactivated an account (its own feature after ST-005)
- Deleting accounts – the history keeps the names (ST-005)

## Open Questions
- none

## Notes
- Merged with ST-082 and set to size S, `priority: could`, `status: draft` by the backlog grooming of 2026-10-11 (user decision of 2026-10-12). The merged story has not been through `/review-stories`.
