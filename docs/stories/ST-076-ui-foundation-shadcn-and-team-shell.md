---
id: ST-076
title: UI foundation – shadcn/ui, the shared phone layout and the team shell
type: tech-task
context: BC-Repair
priority: must
size: L
risk: medium
events: []
depends_on: [ST-004, ST-005]
labels: [foundation, ui]
status: in-progress
---

## Task
ADR 0001 (accepted) decides "one Next.js monolith **with shadcn/ui**", and Tailwind v4 is installed – but shadcn/ui was never initialised: there is no `components.json`, none of the dependencies it pulls in, and no component directory. ST-001's checklist said "no styling required" (`docs/stories/ST-001-walking-skeleton-vercel-eu.md`, `docs/reviews/ST-001-acceptance.md`) and every story since inherited that, so no story in the backlog covers styling. The four existing pages are raw markup (`className="border p-2"` on every input and button), each page carries its own ad-hoc "back to /team" link, and the start page decides the role-dependent navigation itself.

Decided by the user on 2026-09-29: the UI foundation is built **now, before ST-006, ST-008, ST-010 and the dashboard stories (ST-048, ST-049)** – today only four pages have to be converted, while every later story would otherwise write markup that is rewritten afterwards. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

This story delivers the foundation and converts `/login` (`src/app/login/page.tsx`) and `/team` (`src/app/(team)/team/page.tsx`). The forms and the account list of `/team/members` and `/team/password` follow in ST-077 (the slice is described under Notes); this story already takes the ad-hoc navigation links out of those two pages, because the shell renders the navigation for every team page.

**The accessibility contract is the hard constraint.** The existing browser tests find elements by accessible role and label – `getByLabel("Benutzername")`, `getByRole("button", { name: "Anmelden" })`, `getByRole("link", { name: "Teammitglieder" })`, `page.getByRole("main").getByRole("status")`, `page.getByRole("article")` (`e2e/team-login.spec.ts`, `e2e/team-accounts.spec.ts`). That is the contract the rebuild must preserve: labels stay associated with their input, the rejection and confirmation elements keep `role="alert"` / `role="status"` inside the page's `<main>` landmark, and no test is weakened to make the new markup pass.

The German texts keep coming from the message catalogs (`src/platform/messages/team.de.ts`, keys `login`, `team`, `terms`) – no text literal in a page or a component (engineering conventions, "UI texts"). Components receive their texts as props; the catalog stays in the pages.

## Acceptance Criteria
- [ ] shadcn/ui is initialised on the installed Tailwind v4: `components.json` is committed, the dependencies it pulls in (Radix primitives, `class-variance-authority` and the `cn` helper's dependencies) are in `package.json`, and `npm run verify` is green with them.
- [ ] The components are owned in the repository (ADR 0001: "copied into the repo, so no UI library upgrades"): the component directory (`src/components/ui` unless the import rules demand another place), the `cn` helper's place and the rule that a component carries no domain logic are written into the module layout of `.claude/skills/engineering-conventions/SKILL.md`, together with how a further component is added later (the shadcn command, then review the copied file).
- [ ] The import rules cover the new directory through a boundary element of its own: `eslint.config.mjs` gets a new `ui` element for the component directory **and its own disallow policy**, following the pattern of the existing `module`, `platform`, `app` and `spike` policies. Classifying the directory as the existing `shared` element is not enough – `shared` (`src/(photo|test-support)`) appears in no `disallow` policy as `from:`, so the rule below would silently not be enforced (story review 2026-09-29, finding 5).
- [ ] The rule that element carries is proven, not just configured: a page may import a component, and a component that imports a module, the message catalogs or the platform is a lint error – demonstrated with a deliberate violation in `src/platform/module-boundaries.test.ts` like the existing cases, and the violation fails the check.
- [ ] The recurring pieces the existing pages need exist as components and are used by them: a form field with a label, a text input, a password input, a select, a button, and the two message elements for a rejection (`role="alert"`) and a confirmation (`role="status"`).
- [ ] **The select works without JavaScript, verified against the real copied component.** shadcn's `Select` wraps Radix, which renders a JavaScript-driven listbox; whether its visually-hidden native bridge submits the chosen value and is keyboard-operable with JavaScript disabled is implementation-specific and is **not** assumed. This story checks it on the component it actually copied (browser test with JavaScript disabled: the field has a label, the chosen value is submitted with the form, and the field is reachable and operable by keyboard). If it does not hold, the house component for any field that must submit without JavaScript is a plain Tailwind-styled native `<select>`; which of the two the house component is, is recorded with the component set in the engineering conventions, because ST-077 and every later form consume it.
- [ ] The phone rules live in one place: a shared page container holds the 360 px rules (single column, page padding, maximum width, wrapping of long words); `/login` and `/team` use it and set no padding, width or column layout of their own.
- [ ] `/login` and `/team` are rebuilt with these components: no input, button or select on them carries ad-hoc utility classes such as `border p-2`.
- [ ] The `(team)` layout (`src/app/(team)/layout.tsx`) renders one shared navigation for every team page; the ad-hoc "back to /team" links in `src/app/(team)/team/members/page.tsx` and `src/app/(team)/team/password/page.tsx` and the hand-built navigation in `src/app/(team)/team/page.tsx` are gone.
- [ ] The navigation respects the role: "Teammitglieder" is shown only to a technician, and a helper finds no link with that name on any team page – the browser test "a helper cannot reach the account pages" (`e2e/team-accounts.spec.ts`) stays green unchanged.
- [ ] Each destination appears exactly once per page, so `getByRole("link", { name: "Teammitglieder" })` and `getByRole("link", { name: "Passwort ändern" })` each resolve to exactly one element (browser test, Playwright strict mode).
- [ ] Logging out stays reachable from every team page and keeps the button name "Abmelden" (`e2e/team-login.spec.ts`).
- [ ] Every text of the rebuilt pages, the navigation and the landmarks comes from `src/platform/messages/team.de.ts`; a text a component needs is passed in as a prop, and a new text (e.g. a navigation label) is added to the catalog first.
- [ ] Accessibility does not regress: every input on `/login` and `/team` has a programmatically associated label (`getByLabel` finds it), the page has exactly one `<main>` landmark, the navigation is a `<nav>` landmark, and the rejection and confirmation elements stay **inside** `<main>` (the tests scope with `page.getByRole("main")`).
- [ ] Links, buttons, inputs and the select are operable by keyboard and show a visible focus indicator (browser test: tabbing through `/login` reaches every control, and the focused control is the one the test expects).
- [ ] 360 px: a browser test asserts `document.documentElement.scrollWidth <= 360` on `/login` and on `/team`, with the login rejection text shown.
- [ ] The create-next-app leftovers are gone: `src/app/globals.css` and `src/app/layout.tsx` carry the shadcn theme tokens instead of the generated `--background`/`--foreground` boilerplate (`docs/reviews/ST-001-code-review.md` finding #13).
- [ ] No existing test is weakened or deleted: `npm run verify -- --e2e` is green, and every selector change in `e2e/*.spec.ts` is named in the pull request with the reason (a text or a role this story deliberately changed).

## Out of Scope
- The forms and the account list of `/team/members` and `/team/password` (ST-077 – this story only removes their back links)
- Visitor pages and their components (ST-010, ST-013, ST-064) and the second language of the visitor UI
- The dashboards and their layout (ST-048, ST-049)
- A visual identity beyond shadcn's defaults: museum colours, logo, typography, icons
- `useActionState` and the `{ error, values }` form state (ST-073) – the rebuilt pages keep the `?error=…` / `?done=…` flow they have today
- Removing the spike scaffolding and the test page on `/` (ST-078)
- Making the team UI usable on a desktop beyond what a single-column phone layout gives

## Open Questions
- none – the dark scheme was decided in the story review (user, 2026-09-29): **light only for now**, `prefers-color-scheme` is not followed. The unused dark colours in `src/app/globals.css` go out with the create-next-app boilerplate this story already removes. Easily reversible later by filling in shadcn's dark tokens.

## Notes
- Requirements engineer's estimate: **M**, risk **medium** (the risk is the accessibility and browser-test contract, not the styling). Lead dev in the story review of 2026-09-29: **L / medium**; the user decided to keep it as one story and carry the uncertainty inside it – no spike and no further split. The two risks that uncertainty covers are written into the acceptance criteria above: the `ui` boundary element with its own policy, and the no-JavaScript select verified against the real copied component.
- If the select turns out to need a native control, and that turns out to be a general rule – Radix only where the presentation requires JavaScript anyway, a native control wherever a form must work without it – the rule belongs in the engineering conventions or in an ADR, because it affects every future form. That decision is **not** taken here and no ADR is written in this story.
- **Slice.** The whole UI foundation (initialise shadcn, the component set, the shell, and all four pages) came out larger than M, so it is split by page group: this story builds the foundation, the shell and the two small pages; **ST-077** rebuilds the two account pages, which carry the most markup (new-account form, one card per account with three inline forms, own-password form). The split is safe because ST-077 adds no new component kind – it uses the ones built here.
- **Order.** ST-076 → ST-077, both before ST-006; ST-078 (spike removal) is independent of both and waits only for ST-073, which itself can run in parallel with the UI stories (see ST-078).
- **Priority `must`** (user, 2026-09-29): `BACKLOG.md` is generated in priority order, so at `should` this story would sort behind ST-006 and every other `must` – the opposite of the decision to build the UI foundation before ST-006.
