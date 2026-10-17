---
id: ST-081
title: Act on one account on its own page, and deactivate with one question and a way back
type: story
context: BC-Team
priority: should
size: M
risk: medium
events: []
depends_on: []
labels: [ui]
status: review
---

## Story
As a technician, I want to act on one team member's account on its own page, be asked once before I deactivate an account and be able to activate it again, so that I can give a new volunteer access or help someone who is locked out without scrolling past every account in the museum, and a mis-tap on a phone does not cost a volunteer their access for good.

## Context
One story since the backlog grooming of 2026-10-11 (user decision of 2026-10-12): ST-082 ("Deactivating a team member asks once, and can be undone") was merged into this one. **Shrunk in the backlog grooming of 2026-10-17** (user, section 9 item 4): no search and no count – about ten people never pass G4's ~20 entries, so the list stays plain; deactivating asks once, an account can be activated again, deactivated accounts are behind a filter. `priority: should` (conflict 3 decided for the PO: a mis-tapped deactivation is a dead end today).

The team members page does three jobs at once today – find a person, change a person, create a person – and does none of them well (G1). Every entry carries a role button, a password field and a destructive button, which turns ten team members into eighteen screens of scrolling and puts the deactivation under every name (G5). This story splits it.

Words (G12, `CONTEXT.md`): the person is the **team member** (*Teammitglied*), their access is the **account** (*Konto*). Lists, headings and navigation are about team members; resetting a password, changing a role, deactivating and activating again act on the account – every button, question and confirmation of those says *Konto*.

**The list and one account's page**
- The list shows one entry per team member with what tells them apart – name, username, role, and whether their account is active – and no actions (G5). No search and no count (G4: the list cannot pass ~20 entries).
- **Deactivated accounts are not listed until a filter asks for them**: the checkbox „Auch deaktivierte Konten anzeigen“, off by default; listed, they are marked as deactivated. The wording follows the "show retired machines" filter of ST-055 („Auch ausgemusterte Geräte anzeigen“).
- Each team member has their own page, and that page carries the actions a technician may take on their account: change the role, reset the password, deactivate – and, for a deactivated account, „Konto wieder aktivieren“.
- Creating a team member is reached by a named action under the heading of the list and happens on its own page; on success the technician lands back on the list with a confirmation naming the person (G2a, G3).
- Helpers do not reach this page, and the Team module refuses them anyway (G11, ADR 0004).

**Deactivating asks once and can be undone** (from ST-082)
- Deactivating is one tap today, it ends every session of that account, and nothing in La Guardia undoes it. This part is what makes guideline **G10a** true – "what a person *sets* to manage access or visibility, they can unset" – together with **G10**, the question that names the person and the consequences nobody sees on this screen.
- The question names the team member and says that they are logged out immediately: „Konto von Anna Berger deaktivieren? Anna wird sofort abgemeldet.“ (G10, G13).
- The account is deactivated only after the technician confirms; going back changes nothing at all.
- A technician can **activate a deactivated account again** („Konto wieder aktivieren“), and that team member can log in again with their password (G10a). Reactivating was out of scope in ST-005.
- The last active technician account still cannot be deactivated, so the team can never lock itself out (ST-005). The question is never shown for a change that would be refused anyway (G11).
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

Scenario: Deactivated accounts are behind a filter
  Given "Anna Berger" has an active account and "Ben Weber" a deactivated one
  When a technician opens the team members page
  Then "Ben Weber" is not listed

Scenario: The filter lists deactivated accounts, marked as such
  Given "Anna Berger" has an active account and "Ben Weber" a deactivated one
  When a technician turns on the filter for deactivated accounts
  Then "Anna Berger" and "Ben Weber" are listed
  And "Ben Weber" is marked as deactivated

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
  When a technician chooses to deactivate her account
  Then it asks once, naming "Anna Berger" and saying that she is logged out immediately
  And her account is deactivated only after the technician confirms

Scenario: Going back from the question changes nothing
  Given a technician was asked whether to deactivate the account of "Anna Berger"
  When the technician goes back instead of confirming
  Then Anna's account is still active
  And her session on her phone still works

Scenario: A technician activates an account again
  Given the account of "Anna Berger" is deactivated
  When a technician activates her account again
  Then her account is active
  And Anna can log in again with her password

Scenario: The last active technician still cannot be deactivated
  Given exactly one active technician account exists
  When a technician chooses to deactivate that account
  Then the change is refused because at least one active technician must remain
  And no question is asked

## Out of Scope
- Searching the team members and counting them (dropped in the backlog grooming of 2026-10-17, G4)
- An audit trail of who created, changed, deactivated or reactivated an account (dropped by the user in the backlog grooming of 2026-10-17)
- Deleting accounts – the history keeps the names (ST-005)

## Open Questions
- none

## Notes
- Merged with ST-082 and set to size S, `priority: could`, `status: draft` by the backlog grooming of 2026-10-11 (user decision of 2026-10-12). Revised in the backlog grooming of 2026-10-17: shrunk (no search, no count), *Konto* wording, `priority: should` (user decision 4), size M and risk medium (lead dev), retitled without "Find". The story has not been through `/review-stories` yet; the file name keeps its original slug.
