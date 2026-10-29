---
id: ST-088
title: Edit an account on one page, and deactivate or activate it with one tap
type: story
context: BC-Team
priority: should
size: M
risk: medium
events: []
depends_on: []
labels: [ui, feature:member-pages]
status: done
---

## Story
As a technician, I want to change a team member's name, username, role and password on one edit page, and deactivate or activate their account with one tap, so that a typo in a name or a forgotten password is fixed in one place and switching someone's access off and on again costs no detour through a question.

## Context
Changes the done story **ST-081** (team member's page with separate role button, password form and a question page before deactivating) and builds on the rules of the done story **ST-005**. Neither is reopened. Decided by the user in the `/feature` grilling of 2026-10-25 and the story review of 2026-10-25 (`docs/reviews/2026-10-25-story-review.md`, decisions 1 and 4); yardstick `docs/product/ux-guidelines.md` **G28**, **G33**, **G34**, with G3, G8, G10a, G11, G14, G17, G30.

BC-Team is generic and not modelled (`docs/domain/events.yaml`, `docs/domain/context-map.md`): no command, event or read model ID exists for accounts, so `events` stays empty – as in ST-005 and ST-081. **Changing a team member's name is a new capability** (ST-005 had no rename). The **account** is the person's access (`CONTEXT.md`, **Account**); the name belongs to the team member, so a changed name shows on everything they did – claims, work log entries, problem reports, maintenance records, status changes – because those refer to the team member by ID, never by a copy of the name.

**The team member's page** (G28)
- Shows only the details – name, username, role, whether the *Konto* is active – and the buttons. The role button and the password form of ST-081 leave the page.
- An active account offers „Konto bearbeiten“ and „Konto deaktivieren“. A deactivated account offers only „Konto wieder aktivieren“ (as in ST-081).
- „Konto deaktivieren“ and „Konto wieder aktivieren“ are **one tap, without a question page** – ST-081's question page („Konto von Anna Berger deaktivieren? Anna wird sofort abgemeldet.“ / „Konto deaktivieren“ / „Zurück“) goes away; its old address leads to the team member's page and deactivates nothing. Deactivating is reversible (G10a); the confirmations stay as they are: „Konto von Anna Berger deaktiviert.“, „Konto von Anna Berger wieder aktiviert.“
- „Konto deaktivieren“ is not red – it is reversible and looks like any other secondary button (G30).
- **One's own page offers no „Konto deaktivieren“** – a technician who deactivated themselves would be logged out at once and could not undo it. The Team module refuses it anyway (G11). Since a technician who opens someone else's page is an active technician themselves, the last active technician account is only ever seen as one's own page – so this rule also covers it, and the page needs no sentence of its own about the last technician.

**The edit page** (G28, G34, G14)
- Heading „Konto bearbeiten · Anna Berger“ (G34); fields name, username, role and „Neues Passwort“ (with the hint „Mindestens 10 Zeichen.“); button „Konto speichern“; back link „Zurück zum Teammitglied“ to the team member's page (G17). The fields are filled in with the account's current values; „Neues Passwort“ is empty, and left empty the password stays as it is.
- **One's own edit page** (decision 1): the role is shown without a choice, with „Die eigene Rolle kann nur eine andere Techniker:in ändern.“ where the choice would be; there is no „Neues Passwort“, only a link to „Passwort ändern“ (ST-005, needs the current password). The Team module refuses a change of one's own role and a new password for one's own account sent anyway. This also covers the last active technician, who can only ever edit their own account.
- Rules of ST-005, unchanged: a name is required; the username keeps its format and is unique among all accounts; a new password has at least 10 characters; at least one active technician account always remains – also when two technicians demote or deactivate each other at the same time.
- **Every rejection is decided before anything is written**: a change is stored completely or not at all – a valid new password is not set when the username of the same change is rejected.
- After saving: the team member's page with „Konto von Anna Berger gespeichert.“ – with the name as saved (G3). Sending the form without any change is not a rejection (G33): it lands the same way with the same confirmation.
- **Sessions:** only deactivating and a password change end a team member's sessions – at their next action. A changed name, username or role keeps them running (sessions belong to the team member, not to the username); the next login uses the new username.
- A rejection stays on the edit page, names the reason above „Konto speichern“, marks the field and keeps every value – except „Neues Passwort“, which is empty (G8). Nothing of the rejected change is stored.
- Only technicians reach the edit page; helpers do not reach the team members pages at all (ST-081, G11).
- A deactivated account is not edited (its page offers only „Konto wieder aktivieren“); its edit page opened anyway shows „Dieses Konto ist deaktiviert.“ and „Zurück zum Teammitglied“, without fields.

## Acceptance Criteria

Scenario: The team member's page and the edit page show the account
  Given the team member "Anna Berger" has an active account with the username "anna" and the role Helper
  When a technician opens Anna's page
  Then her name, username, role and that her account is active are shown
  And „Konto bearbeiten“ and „Konto deaktivieren“ are offered, and no role button and no password field
  And „Konto bearbeiten“ leads to a page headed „Konto bearbeiten · Anna Berger“, with name, username and role filled in with her current values, „Neues Passwort“ empty and „Zurück zum Teammitglied“ leading back to her page

Scenario: A technician changes name, username and role on the edit page
  Given the team member "Anna Berger" has an active account with the username "anna" and the role Helper
  When a technician opens „Konto bearbeiten“ on her page
  And changes the name to "Anna Schmidt", the username to "anna.s" and the role to Technician, leaving „Neues Passwort“ empty
  And saves with „Konto speichern“
  Then her account has the name "Anna Schmidt", the username "anna.s" and the role Technician
  And she can log in with "anna.s" and her old password, and no longer with "anna"
  And the technician is on her page with the confirmation „Konto von Anna Schmidt gespeichert.“

Scenario: A changed username keeps the sessions running
  Given "Anna Berger" with the username "anna" is logged in on her phone
  When a technician changes her username to "anna.s"
  Then Anna's next action on her phone still runs in her session

Scenario: A new password replaces the old one and ends the sessions
  Given the team member "Anna Berger" has an active account and is logged in on her phone
  When a technician saves her account with a new password of 12 characters
  Then Anna can log in with the new password and the old password no longer works
  And her session on the phone ends at her next action

Scenario: Saving without a change is confirmed
  Given the team member "Anna Berger" has an active account
  When a technician opens „Konto bearbeiten“ on her page and saves with „Konto speichern“ without changing anything
  Then nothing is rejected
  And the technician is on her page with the confirmation „Konto von Anna Berger gespeichert.“

Scenario: A renamed team member's name shows on everything they did
  Given "Anna Berger" wrote a work log entry on the defect "Left flipper weak" and recorded maintenance on "LG-042"
  When a technician changes her name to "Anna Schmidt"
  Then the work log entry and the maintenance record show "Anna Schmidt"
  And the defect's page, the machine record of "LG-042" and the team members list do not show "Anna Berger" any more

Scenario: A password that is too short is rejected and the input kept
  Given the team member "Anna Berger" has an active account
  When a technician changes her name to "Anna Schmidt" and enters a new password of 6 characters
  Then the change is rejected because a password needs at least 10 characters
  And the reason is shown above „Konto speichern“, with „Neues Passwort“ marked and empty
  And "Anna Schmidt" is still filled in as the name
  And her account still has the name "Anna Berger" and her old password still works

Scenario: A username already taken is rejected and the new password not set
  Given accounts with the usernames "anna" and "tom" exist
  When a technician changes the username of "anna" to "tom" and enters a new password of 12 characters in the same change
  Then the change is rejected because the username is already taken
  And the reason is shown above „Konto speichern“, with the username marked and "tom" still filled in
  And her account keeps the username "anna" and her old password still works

Scenario: An empty name is rejected
  When a technician empties the name of an account and saves it
  Then the change is rejected because a name is required
  And the username and the role are still filled in as they were sent
  And the account keeps its name

Scenario: One's own edit page fixes the role and has no new password
  Given the technicians "Tom Keller" and "Eva Roth" have active accounts
  When Tom opens „Konto bearbeiten“ on his own page
  Then his role is shown without a choice, with „Die eigene Rolle kann nur eine andere Techniker:in ändern.“
  And no „Neues Passwort“ is offered, only a link to „Passwort ändern“
  And changing his own role to Helper or setting a new password for his own account anyway is rejected, and his account stays as it was

Scenario: The last active technician changes their own name
  Given "Tom Keller" has the only active technician account
  When Tom changes his own name to "Tom Keller-Roth" on his own edit page
  Then his account has the name "Tom Keller-Roth" and still the role Technician

Scenario: Two technicians demote or deactivate each other at the same time
  Given Tom and Eva are the only active technicians
  When Tom saves Eva's account with the role Helper and Eva taps „Konto deaktivieren“ on Tom's page at the same time
  Then exactly one of the two changes is stored
  And one active technician remains

Scenario: Deactivating is one tap without a question
  Given the team member "Anna Berger" has an active account and is logged in on her phone
  When a technician taps „Konto deaktivieren“ on her page
  Then her account is deactivated without a question page in between
  And Anna's session ends at her next action
  And the technician is on her page with the confirmation „Konto von Anna Berger deaktiviert.“
  And „Konto wieder aktivieren“ is offered

Scenario: Activating again is one tap
  Given the account of "Anna Berger" is deactivated
  When a technician taps „Konto wieder aktivieren“ on her page
  Then her account is active and she can log in with her password
  And the technician is on her page with the confirmation „Konto von Anna Berger wieder aktiviert.“

Scenario: The old address of the question page leads to the team member's page
  Given the team member "Anna Berger" has an active account
  When a technician opens the address of ST-081's question page for Anna
  Then the technician is on Anna's page, and no question is asked
  And Anna's account is still active

Scenario: One's own page offers no deactivation
  Given the technicians "Tom Keller" and "Eva Roth" have active accounts
  When Tom opens his own page
  Then „Konto deaktivieren“ is not offered
  And deactivating his own account anyway is rejected

Scenario: A deactivated account is not edited
  Given the account of "Ben Weber" is deactivated
  When a technician opens Ben's page
  Then only „Konto wieder aktivieren“ is offered
  And his edit page opened anyway shows „Dieses Konto ist deaktiviert.“ and „Zurück zum Teammitglied“, without fields
  And a change of his account sent anyway is rejected and changes nothing

Scenario: Helpers do not reach the edit page
  Given a helper is logged in
  When the helper opens the edit page of an account
  Then it is refused
  And no way to the team members pages is offered to the helper

## Out of Scope
- Changing one's own password under „Passwort ändern“ (ST-005, unchanged – needs the current password)
- An audit trail of account changes (dropped by the user, backlog grooming 2026-10-17)
- Deleting accounts
- Changing the team members list or creating a team member (ST-081, unchanged)

## Open Questions
- none – both open points answered as recommended (user, 2026-10-25, story review): a changed username keeps the sessions (only deactivating and a password change end sessions); saving without a change is accepted and confirmed.

## Notes
- Lead dev (story review 2026-10-25): Better Auth keeps the username three times – normalised, as `displayUsername` and in the placeholder e-mail `<username>@users.invalid`; a rename changes all three. The password cannot share the account's transaction, so every rejection is decided before the first write (scenario "A username already taken is rejected and the new password not set").
- Built after the maintenance chain ST-094–ST-098 (`must`) and before ST-089–ST-093 (user, story review 2026-10-25, decision 3).
- `docs/reviews/2026-10-25-ux-audit-consistency.md` lists the question page's G1 slip; it goes away with this story.
