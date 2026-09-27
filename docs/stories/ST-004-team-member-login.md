---
id: ST-004
title: Log in as a team member
type: story
context: BC-Team
priority: must
size: M
risk: medium
events: []
depends_on: [ST-003, ST-071]
labels: [mvp, foundation, team]
status: in-progress
---

## Story
As a team member, I want to log in once on my phone with my personal username and password and stay logged in, so that everything I do is recorded under my name without logging in again at every machine.

## Context
- Decision: `docs/adr/0004-team-authentication.md` – own accounts in La Guardia's database, username and password, no e-mail address, no e-mail ever sent; the established authentication library chosen in ST-001, no hand-written password handling.
- Passwords have at least 10 characters.
- Sessions are long-lived, stored server-side and kept in secure, HTTP-only cookies; deactivating an account ends its sessions (ST-005). Sessions expire after 90 days without use.
- The role is read again on every request, so a role change or deactivation applies to the next action.
- Login throttling: after 10 failed attempts within 15 minutes, a username is locked for 15 minutes. That someone could lock out a known username on purpose is a consciously accepted risk (technicians are on site).
- The first technician account is created by a one-off command-line setup script.
- Team pages require login; the visitor machine page, the legal pages and *Report problem* for visitors stay public.
- Schema alignment (story review `docs/reviews/2026-09-27-story-review.md`, decision 3; `docs/reviews/ST-001-code-review.md` finding #2): the `TeamMemberId` is the account ID that Better Auth assigns (its `user` table, ADR 0006). Check Better Auth's ID format, align `problem_report.reporter_team_member_id` (created as `text` by the ST-001 spike) with it, and add the foreign key from that column to the team member account table.

## Acceptance Criteria

Scenario: Team member logs in
  Given a helper account with the username "anna"
  When Anna logs in with her username and correct password
  Then Anna is logged in as helper
  And her subsequent actions are recorded with her as the acting team member

Scenario: Wrong password is rejected without revealing which part was wrong
  Given a helper account with the username "anna"
  When someone logs in as "anna" with a wrong password
  Then the login is rejected
  And the message does not say whether the username or the password was wrong

Scenario: Team member stays logged in on the phone
  Given Anna logged in on her phone 30 days ago
  And she has used La Guardia on that phone within the last 90 days
  When she opens a team page on that phone
  Then she is still logged in without entering her password

Scenario: Session expires after 90 days without use
  Given Anna last used La Guardia on her phone 91 days ago
  When she opens a team page on that phone
  Then the login is requested again

Scenario: Team pages require login
  Given nobody is logged in on a phone
  When a team page such as the machine overview is opened
  Then the login is requested first
  But the visitor machine page opens without login

Scenario: Repeated failed logins are slowed down
  Given 10 failed login attempts for the username "anna" within 15 minutes
  When another login attempt for "anna" is made within the next 15 minutes
  Then the attempt is rejected without checking the password

Scenario: Team member logs out
  Given Anna is logged in on her phone
  When she logs out
  Then her session on that phone ends
  And opening a team page requests the login again

Scenario: First technician account is created at setup
  Given La Guardia has no team member account yet
  When the setup script is run with a name, username and a password of at least 10 characters
  Then a technician account with that name and username exists

Scenario: Setup cannot be repeated once accounts exist
  Given at least one team member account exists
  When the setup script is run again
  Then no account is created or changed

Scenario: Problem reports refer to existing team member accounts
  Given the ID format of team member accounts in the authentication library has been checked
  When the migration for team member accounts is applied
  Then the reporting team member reference of a problem report has the same type as a team member's ID
  And a problem report can only name a reporting team member that has an account

## Out of Scope
- Creating, changing and deactivating accounts (ST-005)
- Passkeys, external identity providers, password reset by e-mail (rejected in ADR 0004)

## Open Questions
- none
