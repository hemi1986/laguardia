---
id: ST-081
title: Act on one account on its own page, and deactivate with one question and a way back
type: story
context: BC-Team
priority: should
size: M
risk: medium
events: []
depends_on: [ST-005]
labels: [ui]
status: in-progress
---

## Story
As a technician, I want to act on one team member's account on its own page, be asked once before I deactivate an account and be able to activate it again, so that I can give a new volunteer access or help someone who is locked out without scrolling past every account in the museum, and a mis-tap on a phone does not cost a volunteer their access for good.

## Context
The team members page does three jobs at once today – find a person, change a person, create a person – and does none of them well (G1). Every entry carries a role button, a password field and a destructive button, which turns ten team members into eighteen screens of scrolling and puts the deactivation under every name (G5). This story splits it. About ten people never pass G4's ~20 entries, so the list stays plain – no search, no count.

Words (G12, `CONTEXT.md`): the person is the **team member** (*Teammitglied*), their access is the **account** (*Konto*). Lists, headings and navigation are about team members; resetting a password, changing a role, deactivating and activating again act on the account – every button, question and confirmation of those says *Konto*.

**The list and one account's page**
- The list shows one entry per team member with what tells them apart – name, username, role – and no actions (G5). Only a deactivated entry carries „Deaktiviert“; an active one carries no marker.
- **Deactivated accounts are not listed until a filter asks for them**: the checkbox „Auch deaktivierte Konten anzeigen“, off by default. The wording follows the "show retired machines" filter of ST-055 („Auch ausgemusterte Geräte anzeigen“).
- Each team member has their own page, and that page carries the actions a technician may take on their account: change the role, reset the password, deactivate. **A deactivated account's page offers only „Konto wieder aktivieren“.**
- **Every action on an account lands on the team member's page with a confirmation that names the person** (G3), e.g. „Konto von Anna Berger deaktiviert.“
- A rejected password reset stays at the form, names the reason there with the password field marked, and the field is empty – a password is never echoed (G8).
- Creating a team member is reached by „Neues Teammitglied“ under the heading of the list and happens on its own page with the button „Teammitglied anlegen“; on success the technician lands back on the list with the confirmation „Clara Vogt ist angelegt.“ (G2a, G3, G14).
- Helpers do not reach this page, and the Team module refuses them anyway (G11, ADR 0004).

**Deactivating asks once and can be undone**
- Deactivating ends every session of that account. This part is what makes guideline **G10a** true – "what a person *sets* to manage access or visibility, they can unset" – together with **G10**, the question that names the person and the consequences nobody sees on this screen.
- The question is a page of its own (G10b, amended in the story review 2026-10-17): „Konto von Anna Berger deaktivieren? Anna wird sofort abgemeldet.“ with the buttons „Konto deaktivieren“ and „Zurück“ – no „Endgültig“, because deactivating can be undone (G10a). For the technician's own account it reads „Dein Konto deaktivieren? Du wirst sofort abgemeldet.“
- The account is deactivated only after the technician confirms; „Zurück“ changes nothing at all.
- A technician can **activate a deactivated account again** („Konto wieder aktivieren“), and that team member can log in again with their password (G10a).
- **The last active technician account offers neither deactivating nor the change to helper**, and its page says why: at least one active technician must remain, so the team can never lock itself out (ST-005). The command refuses both anyway (G11).
- The team member's name stays on everything they did, deactivated or not (`CONTEXT.md`, **Account**).

ST-005 is `done` and is not reopened – the rules it established (unique username, at least 10 characters, the last active technician is protected) stay exactly as they are; this story changes where a technician does these things and adds the question and the way back on top.

## Acceptance Criteria

Scenario: The list shows one entry per team member
  Given the active accounts of "Anna Berger" (Helper) and "Tom Keller" (Technician) exist
  When a technician opens the team members page
  Then both are listed with name, username and role
  And no action on an account is offered in the list
  And neither entry is marked as deactivated

Scenario: Deactivated accounts are behind a filter
  Given "Anna Berger" has an active account and "Ben Weber" a deactivated one
  When a technician opens the team members page
  Then "Ben Weber" is not listed

Scenario: The filter lists deactivated accounts, marked as such
  Given "Anna Berger" has an active account and "Ben Weber" a deactivated one
  When a technician turns on the filter for deactivated accounts
  Then "Anna Berger" and "Ben Weber" are listed
  And only "Ben Weber" is marked „Deaktiviert“

Scenario: The actions of an account live on its own page
  Given the team member "Anna Berger" has an active account
  When a technician opens "Anna Berger" from the list
  Then her name, username, role and whether her account is active are shown
  And changing the role, resetting the password and deactivating the account are offered there

Scenario: A technician changes the role from the account page
  Given the team member "Anna Berger" has an active account with the role Helper
  When a technician changes her role to Technician on her page
  Then her account has the role Technician
  And the technician is on Anna's page with a confirmation that names "Anna Berger"

Scenario: A technician resets a password from the account page
  Given the team member "Anna Berger" has an active account
  When a technician resets her password to a new password of 12 characters on her page
  Then Anna can log in with the new password
  And the technician is on Anna's page with a confirmation that names "Anna Berger"

Scenario: A rejected password reset names the reason at the form
  Given the team member "Anna Berger" has an active account
  When a technician resets her password to a new password of 6 characters
  Then the password reset is rejected because a password needs at least 10 characters
  And the reason is shown at the form, with the password field marked and empty
  And Anna's old password still works

Scenario: Creating a team member happens on its own page
  When a technician creates the team member "Clara Vogt" with the username "clara", an initial password and the role Helper
  Then the team members page is shown with "Clara Vogt" in it
  And the confirmation reads „Clara Vogt ist angelegt.“

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
  Then a question page names "Anna Berger" and says that she is logged out immediately
  And it offers „Konto deaktivieren“ and „Zurück“
  And her account is deactivated only after the technician confirms
  And the technician is on Anna's page with a confirmation that names "Anna Berger"

Scenario: Deactivating one's own account says so
  Given the technicians "Tom Keller" and "Eva Roth" have active accounts
  When Tom chooses to deactivate his own account
  Then the question reads „Dein Konto deaktivieren? Du wirst sofort abgemeldet.“
  And after he confirms, his account is deactivated and he is logged out

Scenario: Going back from the question changes nothing
  Given a technician was asked whether to deactivate the account of "Anna Berger"
  When the technician goes back instead of confirming
  Then Anna's account is still active
  And her session on her phone still works

Scenario: A deactivated account's page offers only activating it again
  Given the account of "Ben Weber" is deactivated
  When a technician opens "Ben Weber" from the filtered list
  Then „Konto wieder aktivieren“ is offered
  And changing the role, resetting the password and deactivating are not offered

Scenario: A technician activates an account again
  Given the account of "Anna Berger" is deactivated
  When a technician activates her account again
  Then her account is active
  And Anna can log in again with her password
  And the technician is on Anna's page with a confirmation that names "Anna Berger"

Scenario: The last active technician account offers neither deactivating nor the change to helper
  Given "Tom Keller" has the only active technician account
  When Tom opens his own page from the team members list
  Then neither deactivating the account nor changing its role to Helper is offered
  And the page says that at least one active technician must remain
  And deactivating it or changing its role to Helper anyway is refused

## Out of Scope
- Searching the team members and counting them (dropped in the backlog grooming of 2026-10-17, G4)
- An audit trail of who created, changed, deactivated or activated an account again (dropped by the user in the backlog grooming of 2026-10-17)
- Deleting accounts – the history keeps the names (ST-005)

## Open Questions
- none

## Notes
- History: one story since the backlog grooming of 2026-10-11 (user decision of 2026-10-12) – ST-082 ("Deactivating a team member asks once, and can be undone") was merged into it. Shrunk in the backlog grooming of 2026-10-17 (user, section 9 item 4): no search and no count; deactivating asks once, an account can be activated again, deactivated accounts are behind a filter; *Konto* wording; `priority: should` (conflict 3 decided for the PO: a mis-tapped deactivation is a dead end today); size M and risk medium (lead dev); retitled without "Find" – the file name keeps its original slug. Activating an account again was out of scope in ST-005. Revised after the story review of 2026-10-17 (`docs/reviews/2026-10-17-story-review.md`).
- ST-080 is not built as a story (backlog grooming 2026-10-11): the team members page is rebuilt here, on the house pattern (G8, G9), instead of being converted first.
- Plan notes (lead dev, story review 2026-10-17): the filter for deactivated accounts is a GET parameter of the list, so it works without JavaScript; the question before deactivating is a page (G10b), not a dialog; the page's forms move to shadcn's `Field`.
