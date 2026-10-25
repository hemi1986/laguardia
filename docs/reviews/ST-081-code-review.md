# Code review – ST-081: Act on one account on its own page, and deactivate with one question and a way back
Base: main · Commits: 6 · Date: 2026-10-25

Checked: `git diff main...HEAD`, the context pack, ADR 0002/0004, `CONTEXT.md`, the engineering conventions.
`check-language.ts`: no warning in the diff (all 14 warnings are in files this story does not touch).
`vitest run src/modules/team src/app/(team)/team/members`: 12 files, 54 tests green.
The three decisions approved in the test plan are implemented consistently: the address-based confirmations
(`?done=…`, `?created=<id>`) are checked against the account's state and documented as the second exception in the
conventions; `changeRefusal` is the one rule both `applyChange`/`resetPassword` and the read model `teamMemberAccount`
ask, so the page and the question page (`deaktivieren/page.tsx` redirects when `actions.deactivate` is false) carry no
rule of their own (G11); the old browser specs and `aHelper` were rewritten to the new pages. The exception: part of
the old helper spec's intent was lost (finding 2).

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Domain rules / design | `src/modules/team/accounts.ts:180`, `:206`, `:216` | `Change` now includes `{ resetPassword: true }` so that `changeRefusal` can be asked about a reset. But `applyChange` takes the same type, and its update falls through to `{ banned: "deactivate" in change }`. So `applyChange(db, id, { resetPassword: true })` would type-check and **activate a deactivated account** without resetting anything. Nothing calls it that way today. Still, the function that guards the BC-Team invariant accepts a change it can't carry out, and the next caller can fall into it. | Speculative Generality / Refused Bequest; ST-005 invariant, G10a | Split the type: the question `changeRefusal` answers (all four kinds) and the changes `applyChange` makes (role, deactivate, activate). Or make the update an exhaustive switch that rejects `resetPassword`. |
| 2 | major | Test quality / scope of decision 3 | `e2e/team-accounts.spec.ts` (deleted test "a helper cannot reach the technician pages"), `e2e/team-members.spec.ts:142` | The rewritten helper scenario covers only `/team/members` and `/team/members/new`. The deleted ST-005 spec also checked that a helper sees no „Modelle“ link and is sent away from `/team/machine-models` (ST-006), and that „Passwort ändern“ is offered to a helper. Nothing else covers the ST-006 page guard in the browser (`machine-models.spec.ts` and `team-shell.spec.ts` only run as a technician). Decision 3 said the rewrite would keep the old specs' intent. | Decision 3 (test plan); tdd: scenario coverage | Put the ST-006 and „Passwort ändern“ checks back – in `team-accounts.spec.ts` or next to the ST-081 helper test. Optionally also check `/team/members/<id>` and `/team/members/<id>/deaktivieren` for helpers. |
| 3 | minor | Consistency of decision 1 | `src/app/(team)/team/members/[teamMemberId]/page.tsx:19` | `?done=role` is confirmed unconditionally. `?done=password` is confirmed only on an active account, because both are refused on a deactivated one (`account-deactivated`). So a deactivated account's page with `?done=role` says „Rolle von … geändert.“ for a change the module would refuse. | Conventions: "the page confirms it only when the account's state agrees" | `role: (account) => (account.active ? texts.roleChanged(account.name) : undefined)`, the same as `password`. |
| 4 | minor | Domain rules (race) | `src/modules/team/accounts.ts:110-112` | `resetPassword` asks `changeRefusal` outside the advisory lock and outside any transaction. A deactivation that commits between the check and `setUserPassword` gives a deactivated account a new password. That is harmless, because the account stays banned and its sessions are gone, and Better Auth's own connection rules out one transaction anyway. Separately, the magic `0` passed as `activeTechnicians` reads as "no technicians left". | Mysterious Name (argument) | Leave the race and say so in a comment. Make the count optional, or add a `refusalOnDeactivated(target)`, instead of passing a dummy `0`. |
| 5 | minor | Duplicated code / primitive obsession | `src/app/(team)/team/members/[teamMemberId]/actions.ts:29`, `src/app/(team)/team/members/new/actions.ts:26`, `src/app/(team)/team/members/[teamMemberId]/account-forms.tsx:29` | The form value → `Role` parse is written twice (one copy with an `as Role` cast). `AccountButtonForm`'s `role` prop is a bare `string`, though only a `Role` is ever posted. | Duplicated Code, Primitive Obsession | One `roleOf(formData)` helper next to the actions, and `role?: Role` on the button form. |
| 6 | minor | Duplicated code | `src/modules/team/accounts.ts:256`, `:315` | `teamMemberAccounts` and `teamMemberAccount` repeat the same five-column select that `accountOf` maps. | Duplicated Code | One `accountColumns` constant used by both queries. |
| 7 | minor | Design | `src/modules/team/accounts.ts:254`, `:224` | `includeDeactivated` defaults to `true`, the opposite of what the only production caller wants. The default exists only for the older tests. `accountStates` returns the rows of one account but has a plural name. | Mysterious Name; interface defaults | Make `includeDeactivated` required (or default it to `false` and update the tests). Rename to `accountState` and return the single row. |
| 8 | minor | Design (judgement) | `src/app/(team)/team/members/[teamMemberId]/deaktivieren/page.tsx:28` | The question page works out the first name from the name itself (`trim().split(/\s+/)[0]`). That is a small piece of wording logic in the page. It is fine as long as this is the only place – the glossary has no "first name" term. | Feature Envy (mild) | Leave it, or move it into `texts.question(name)` in the message catalog so the catalog owns the wording. |

Not flagged:
- CSRF: Server Actions check the Origin.
- Authorization: `requireTechnician` guards all three pages, and every module function checks `isTechnician` again.
- The bound `teamMemberId` can be tampered with only to name another account, which a technician may act on anyway.
- No personal data in logs. No visitor pages touched.
- The command layer (ADR 0002) doesn't apply, because BC-Team has no commands or events. BC-Team has no `RM-` IDs in `events.yaml`.
- Nothing from "Out of Scope" was added: no search, no count, no audit trail.

Verdict: ready to merge
Most important finding: #1 – `applyChange` accepts `{ resetPassword: true }` and would silently activate a deactivated account; narrow its type to the changes it can carry out.

## Resolution (implementer, 2026-10-25)
- **Major 1 fixed:** `applyChange` takes `StoredChange` (role, deactivate, activate) only; a reset can no longer reach the row update. `changeRefusal` has an overload for the reset without a technician count – no magic `0`.
- **Major 2 fixed:** `e2e/team-accounts.spec.ts` has the helper checks back – „Passwort ändern“ offered, no „Teammitglieder“ and no „Modelle“, `/team/members` and `/team/machine-models` send a helper to `/team`.
- **Minor fixed:** `?done=role` is confirmed only on an active account; the role a form posts is read in one place (`members/role-field.ts`) and `AccountButtonForm`'s `role` is a `Role`; the two read models share `accountColumns`; `accountStates` became `accountState` and returns the one state.
- **Minor skipped:** `includeDeactivated` defaulting to `true` – it keeps the module's earlier answer (every account) for its existing callers; the page always says what it wants. The first name on the question page – the story's question says „Anna wird sofort abgemeldet.“, a team member has one name field, and its first word is what the question needs; revisit if a name field for the first name ever comes.
