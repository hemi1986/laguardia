# ST-005 – Security review

Branch `st-005-manage-team-member-accounts`, base `main`, 2026-09-29 (`/security-review` during `/implement`).
Scope: only what this story adds – team member account management on top of Better Auth.

**Result: one medium finding, no high findings. The finding is fixed in this story.**

## Finding 1 (medium, fixed): a password reset left the old sessions alive

`resetPassword` called Better Auth's `setUserPassword`, which only writes the new password hash and never
touches the `session` table – unlike `deactivateAccount`, which deletes the account's sessions. The same gap
existed in `changeOwnPassword`, where `revokeOtherSessions` was not set.

Why it matters here: sessions live 90 days and slide with every request (ST-004), ADR 0004 makes a
technician's reset the only recovery path, and reactivating a deactivated account is out of scope for ST-005 –
so a reset is the only non-destructive remedy a technician has. Whoever held the phone (lost, stolen, or a
password someone outside the team learned) would have kept full privileges after the reset, with no signal in
the UI; a stale *technician* session could have created a further technician account for persistence.

**Fixed** in `src/modules/team/accounts.ts`:

- `resetPassword` deletes the target account's sessions after the password is set.
- `changeOwnPassword` passes `revokeOtherSessions: true`; Better Auth issues a fresh session for the request,
  so the person changing their own password stays logged in while their other devices are logged out.

Both are asserted now: the scenario tests `ST-005: Technician resets a password` and
`ST-005: Team member changes their own password` check that the pre-existing session resolves to
`{ kind: "visitor" }` afterwards.

*Behaviour beyond the story's wording:* the story only says the old password stops working. Logging the old
sessions out is a security decision taken in this story, not a domain decision – it is named here and in the
pull request so it is accepted knowingly.

## Checked and found sound

- **Helpers cannot reach account management.** Every mutating function in `accounts.ts` checks the acting
  person itself (`isTechnician`, resp. `actor.kind === "team-member"`). `requireTechnician()` on the page is
  only a UI convenience – posting the Server Action directly from a helper session still yields
  `not-authorized` (asserted by `ST-005: Helpers cannot manage accounts`).
- **The acting person never comes from form data** – always from the session via `actingPerson()`. The form
  supplies only the target `teamMemberId` and the desired role, and an unexpected role value fails closed to
  `helper`.
- **Deactivation** sets `banned` and deletes the sessions in one transaction; `loggedInTeamMember()` also
  rejects a banned account, and Better Auth blocks new sign-ins at session creation. `ban_expires` stays
  `NULL`, so the plugin's auto-unban branch can never fire.
- **A demotion leaves no stale privileges**: the session cookie cache is off, so the role is re-read from the
  database on every request.
- **The last-technician invariant** could not be bypassed: the advisory lock is held across the read *and* the
  write inside one transaction. The only other writers of `role`/`banned` (`createAccount`,
  `setUpFirstTechnician`) can only increase the count, so leaving them outside the lock is safe.
- **No secret in a URL, a log or the journal**: redirects carry only `?done=`/`?error=` from a closed set,
  passwords stay in the POST body, and account management writes nothing to the event journal.
- **Injection / XSS**: all database access is parameterized Drizzle, usernames are restricted to
  `^[a-zA-Z0-9_.]{3,30}$` and lowercased, and everything rendered goes through React's escaping.
- **CSRF**: both new pages fall under the `src/proxy.ts` Origin check; no new route handler, Better Auth's HTTP
  handler is still not mounted.

## Noted, not a vulnerability

- `teamMemberAccounts` takes no acting person. That follows the read-model convention in the engineering
  conventions (a read model is a query; the page authorizes), the same as `problemReportsOfMachine`. Its only
  caller sits behind `requireTechnician()`.
- The message lookups used `key in catalog`, which walks the prototype chain (`?error=toString` passed the
  guard; React 19 renders nothing for it). Tightened to `Object.hasOwn` in both pages.
