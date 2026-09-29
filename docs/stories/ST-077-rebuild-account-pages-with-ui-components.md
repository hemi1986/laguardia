---
id: ST-077
title: Rebuild the account pages with the shared UI components
type: tech-task
context: BC-Repair
priority: should
size: null
risk: null
events: []
depends_on: [ST-076]
labels: [foundation, ui]
status: review
---

## Task
Second half of the UI foundation (see ST-076 for the background and the user's decision of 2026-09-29). ST-076 initialises shadcn/ui, builds the shared components, the shared phone container and the team shell with its navigation, and converts `/login` and `/team`. This story converts the two pages that carry the most markup:

- `src/app/(team)/team/members/page.tsx` – the account list of ST-005: the new-account form (name, username, initial password with its hint, role select) and one card per account with three inline forms (change role, reset password, deactivate), plus the rejection and confirmation messages from `src/platform/messages/team.de.ts` (`accounts`, `accountErrors`).
- `src/app/(team)/team/password/page.tsx` – the own-password form (`ownPassword`, `accountErrors`).

No new kind of component is created here: the pages use the components from ST-076. Where a page needs a shape ST-076 did not build (e.g. the card that holds one account), it is added in the same place and under the same rules as the components of ST-076 (`components.json`, no domain logic, no import of a module or of the message catalogs).

**The accessibility contract is the hard constraint**, as in ST-076: `e2e/team-accounts.spec.ts` finds the fields by label (`"Name"` exactly, `"Benutzername"`, `"Anfangspasswort"`, `"Aktuelles Passwort"`, `"Neues Passwort"`, and per account `"Neues Passwort – <name>"`), the buttons by name, one account by `page.getByRole("article")` filtered by its username, and the messages with `page.getByRole("main").getByRole("status")` / `getByRole("alert")`. All of that keeps working, and no test is weakened to make the new markup pass.

The texts stay in the catalogs – no text literal in a page or a component.

## Acceptance Criteria
- [ ] `/team/members` and `/team/password` are built from the shared components and the shared page container of ST-076: no input, select or button on them carries ad-hoc utility classes such as `border p-2`, and neither page sets its own padding, width or column layout.
- [ ] Every field keeps a programmatically associated label, and on each page every label text resolves to exactly one field: `getByLabel("Name", { exact: true })`, `"Benutzername"`, `"Anfangspasswort"` and the role field on `/team/members`, `"Aktuelles Passwort"` and `"Neues Passwort"` on `/team/password` (browser test, Playwright strict mode).
- [ ] Each account stays one `article` with the account's name as its heading, and the role change, password reset and deactivate controls of an account stay inside that account's `article` – `page.getByRole("article").filter({ hasText: username })` keeps selecting exactly one account with its own controls.
- [ ] The per-account password field keeps its unique accessible name `Neues Passwort – <name>`, so the fields of two accounts are still told apart.
- [ ] The role select keeps a label and both options in the `_UI (de)_` wording of `CONTEXT.md` (Helfer:in, Techniker:in), submits the chosen role with the form, and does so **without JavaScript** as well (browser test with JavaScript disabled) – the forms are Server Actions and must keep working without it.
- [ ] Rejections keep `role="alert"` and confirmations `role="status"`, both inside the page's `<main>` landmark, with exactly one of each visible at a time: creating an account shows "Konto angelegt.", a wrong current password shows "Das aktuelle Passwort stimmt nicht." (`e2e/team-accounts.spec.ts` stays green unchanged).
- [ ] A deactivated account is still recognisable as deactivated on the list, and its controls stay hidden (ST-005).
- [ ] 360 px: a browser test asserts `document.documentElement.scrollWidth <= 360` on `/team/members` (with at least one account listed) and on `/team/password` (with a rejection shown).
- [ ] A long account name does not break the phone layout: with an account whose name is 60 characters without spaces, `/team/members` still has `document.documentElement.scrollWidth <= 360` (browser test; the risk was raised in `docs/reviews/ST-005-acceptance.md`).
- [ ] Every text comes from `src/platform/messages/team.de.ts`; a text a component needs is passed in as a prop, and a new text is added to the catalog first.
- [ ] No existing test is weakened or deleted: `npm run verify -- --e2e` is green, and every selector change in `e2e/*.spec.ts` is named in the pull request with the reason.

## Out of Scope
- Initialising shadcn/ui, the component set, the shared phone container and the team shell with its navigation (ST-076)
- New behaviour on the account pages – this story changes how they look, not what they do (ST-005 is `done`; a change to its behaviour would be a new story)
- An audit trail of account changes (its own feature after ST-005, `docs/stories/OPEN_QUESTIONS.md`)
- `useActionState` and the `{ error, values }` form state (ST-073) – the pages keep the `?error=…` / `?done=…` flow they have today
- Visitor pages, the dashboards and a visual identity beyond shadcn's defaults (see ST-076)

## Open Questions
- none

## Notes
- Requirements engineer's estimate: **S**, risk **low** – no new component kind, no new behaviour; the work is markup plus the browser-test contract. The lead dev sets `size` and `risk` in the story review.
- **Order.** Directly after ST-076 and, like it, before ST-006 (user decision of 2026-09-29), so that no later story writes markup that is rewritten afterwards.
