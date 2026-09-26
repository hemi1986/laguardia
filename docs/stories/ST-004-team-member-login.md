---
id: ST-004
title: Log in as a team member
type: story
context: BC-Team
priority: should
size: null
risk: null
events: []
depends_on: [ST-003]
labels: [mvp, foundation, team]
status: review
---

## Story
As a team member, I want to log in once on my phone with my personal username and password and stay logged in, so that everything I do is recorded under my name without logging in again at every machine.

## Context
- Decision: `docs/adr/0004-team-authentication.md` – own accounts in La Guardia's database, username and password, no e-mail address, no e-mail ever sent; an established authentication library, no hand-written password handling.
- Sessions are long-lived and stored server-side, so deactivating an account ends its sessions (ST-005).
- The first technician account is created by a one-off setup step.
- Team pages require login; the visitor machine page and *Report problem* for visitors stay public.
- Sessions expire after 90 days without use.
- Login throttling: after 10 failed attempts within 15 minutes, a username is locked for 15 minutes.

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
  When the one-off setup step is run with a name, username and password
  Then a technician account with that name and username exists

Scenario: Setup cannot be repeated once accounts exist
  Given at least one team member account exists
  When the setup step is run again
  Then no account is created or changed

## Out of Scope
- Creating, changing and deactivating accounts (ST-005)
- Passkeys, external identity providers, password reset by e-mail (rejected in ADR 0004)

## Open Questions
- none
