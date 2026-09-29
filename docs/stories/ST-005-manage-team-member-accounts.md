---
id: ST-005
title: Manage team member accounts
type: story
context: BC-Team
priority: must
size: M
risk: low
events: []
depends_on: [ST-004]
labels: [mvp, foundation, team]
status: in-progress
---

## Story
As a technician, I want to create accounts for helpers and technicians, set their role, reset their passwords and deactivate accounts, so that every team member acts under a personal account and people who leave lose access immediately.

## Context
- `docs/product/vision.md`: team members have personal accounts; technicians manage them. `docs/adr/0004-team-authentication.md`: no e-mail address, passwords are reset by a technician on site.
- An account has a name (shown as "claimed by", reporter, "logged by", …), a unique username and a role: *Helper* or *Technician*.
- Deactivating ends all sessions of that account; the team member's name stays on everything they did.
- The last active technician account cannot be deactivated or changed to Helper, so the team can never lock itself out.
- This also holds when two technicians change each other at the same time: at least one active technician always remains.
- Team members can change their own password when logged in, by entering their current password.
- Every password (initial, reset or own change) has at least 10 characters (same rule as ST-004).

## Acceptance Criteria

Scenario: Technician creates a helper account
  Given a technician is logged in
  When the technician creates an account with the name "Anna Berger", the username "anna", an initial password and the role Helper
  Then Anna can log in with that username and password
  And she acts with the role Helper

Scenario: Username must be unique
  Given an account with the username "anna" exists
  When a technician creates another account with the username "anna"
  Then the account is rejected because the username is already taken

Scenario: Technician changes a role
  Given Anna has the role Helper
  When a technician changes her role to Technician
  Then Anna's next action is checked against the role Technician

Scenario: Technician resets a password
  Given Anna has forgotten her password
  When a technician sets a new password for Anna's account
  Then Anna can log in with the new password
  And the old password no longer works

Scenario: Deactivating an account ends its sessions
  Given Anna is logged in on her phone
  When a technician deactivates Anna's account
  Then Anna's session ends at her next action
  And Anna can no longer log in
  And work log entries Anna wrote still show her name

Scenario: Helpers cannot manage accounts
  Given a helper is logged in
  When the helper tries to create, change or deactivate an account
  Then the action is rejected

Scenario: The last technician cannot lock the team out
  Given exactly one active technician account exists
  When that account is deactivated or its role is changed to Helper
  Then the change is rejected

Scenario: Two technicians demote each other at the same time
  Given Tom and Eva are the only active technicians
  When Tom changes Eva's role to Helper and Eva changes Tom's role to Helper at the same time
  Then exactly one of the two changes is stored
  And one active technician remains

Scenario: Passwords need at least 10 characters
  When a technician creates an account or resets a password with a password of 9 characters
  Then the change is rejected

Scenario: Team member changes their own password
  Given Anna is logged in
  When she changes her password, entering her current password and a new one
  Then she can log in with the new password
  And the old password no longer works

Scenario: Own password change needs the current password
  Given Anna is logged in
  When she changes her password with a wrong current password
  Then the change is rejected

## Out of Scope
- Reactivating a deactivated account
- Deleting accounts (history must keep the names)

## Open Questions
- none
