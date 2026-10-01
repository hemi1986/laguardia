---
id: ST-080
title: Move the four pre-runner forms onto the house pattern
type: tech-task
context: BC-Team
priority: must
size: S
risk: low
events: []
depends_on: [ST-007]
labels: [ui, follow-up]
status: draft
---

## Task
Four forms were built before the house pattern existed: the **login**, the **team members** page, the **own password** page and the **machine models** page. ST-007 builds the first form on the new pattern – shadcn's `Field` with `data-invalid`/`aria-invalid`, an icon from `lucide-react` on `Confirmation` and `Rejection`, and the Server Action runner's `{ error, values }` contract. This task moves the four older forms onto it, so only one form pattern is left in the application (G15; two patterns side by side is the one thing that must not spread, `docs/reviews/_change-list-2026-10-01.md`).

Scope (backlog grooming 2026-10-01, section 7):
- The hand-rolled `Field` is replaced by shadcn's `Field` on all four pages, so a rejection marks the field it belongs to (**G8**).
- `Confirmation` and `Rejection` carry their icon, so a rejection is recognisable without colour (**G9**).
- **Only** `logInAction` and `createAccountAction` are converted to the runner's `{ error, values }` contract. That fixes two UX majors: the login throws away a username that was typed correctly (finding L1, UX review of the existing screens), and a rejected account creation loses every value (finding M4). A password is never echoed back (G8).
- `changeRole`, `resetPassword`, `deactivateAccount` and `changeOwnPassword` **deliberately stay on their current mechanism**: ST-081 moves that page anyway, and converting them twice is waste.

This absorbs proposal **New A** of `docs/reviews/2026-10-01-ux-review-existing-screens.md` ("the login keeps the username when it rejects"). ST-004 and ST-005 are `done` and are not reopened – this is new work on top of them.

## Acceptance Criteria
- [ ] The login, the team members page, the own password page and the machine models page use shadcn's `Field`; a rejected submit marks the field that caused it (`data-invalid` on the field, `aria-invalid` on the control) – one browser test per page at 360 px.
- [ ] `Confirmation` and `Rejection` carry a `lucide-react` icon (tick, warning) that is announced to screen readers; no message relies on colour alone (G9).
- [ ] A login rejected because of a wrong password keeps the username, empties only the password and shows the reason immediately above the submit button; reloading the login page afterwards shows no rejection; the locked-out message of ST-004 is unchanged (browser test, also with JavaScript disabled).
- [ ] A rejected account creation keeps name, username and role, never the password, and shows the reason at the form.
- [ ] No hand-rolled `Field` is left under `src/`; `npm run verify` is green and no existing test is weakened or deleted.
- [ ] `changeRole`, `resetPassword`, `deactivateAccount` and `changeOwnPassword` are untouched, and that is stated in the pull request with the reason (ST-081 moves the page).

## Out of Scope
- The account list, its search and the account's own page (ST-081)
- Confirming and undoing a deactivation (ST-082)
- The machine model's own page (ST-036)

## Open Questions
- [OPEN] Login and account creation are **not** `aggregateCommand`s – they call Better Auth-backed Team module functions – so they cannot use `formAction`. Either `formRunner` is generalised to wrap a non-command async function with the same `{ error, values }` shape, or a hand-rolled `useActionState` wrapper mirrors its contract. This is an engineering decision and belongs in the implementation's test plan (`.claude/skills/engineering-conventions/SKILL.md`); it is not decided here.
</content>
