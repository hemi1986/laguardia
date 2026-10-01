---
id: ST-081
title: Find a team member and act on one account at a time
type: story
context: BC-Team
priority: must
size: null
risk: null
events: []
depends_on: []
labels: [ui]
status: draft
---

## Story
As a technician, I want to find one team member in the list and act on that one account on its own page, so that I can give a new volunteer access or help someone who is locked out without reading every account in the museum.

## Context
The team members page does three jobs at once today – find a person, change a person, create a person – and does none of them well (G1). Every entry carries a role button, a password field and a destructive button, which turns ten team members into eighteen screens of scrolling and puts "Zugang beenden" under every name (G5). This story splits it.

Words (G12, `CONTEXT.md`): the person is the **team member** (*Teammitglied*), their access is the **account** (*Konto*). Lists, headings and navigation are about team members; resetting a password, changing a role and deactivating act on the account.

- The list shows one entry per team member with what tells them apart – name, username, role, and whether their account is active – and no actions (G5).
- It says how many team members there are and offers a search over name and username (G4).
- **Deactivated accounts are not listed until a filter asks for them**, and are marked as deactivated when they are. The wording stays consistent with the "show retired machines" filter of ST-055.
- Each team member has their own page, and that page carries the actions a technician may take on their account: change the role, reset the password, deactivate (ST-082 adds the confirmation and the undo).
- Creating a team member is reached by a named action under the heading of the list and happens on its own page; on success the technician lands back on the list with a confirmation naming the person (G2a, G3).
- Helpers do not reach this page, and the Team module refuses them anyway (G11, ADR 0004).
- ST-005 is `done` and is not reopened – the rules it established (unique username, at least 10 characters, the last active technician is protected) stay exactly as they are; this story only changes where a technician does these things.

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

## Out of Scope
- The confirmation before deactivating and reactivating an account (ST-082)
- An audit trail of who created, changed or deactivated an account (its own feature after ST-005)
- Deleting accounts – the history keeps the names (ST-005)

## Open Questions
- none
</content>
