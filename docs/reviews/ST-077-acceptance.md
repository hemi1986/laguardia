# Acceptance – ST-077: Rebuild the account pages with the shared UI components
Date: 2026-09-29 · Tests run: `npx playwright test e2e/account-pages.spec.ts e2e/team-accounts.spec.ts e2e/no-js-form.spec.ts e2e/team-shell.spec.ts` → 11 passed, 0 failed · `check-scenarios.ts ST-077` → OK (tech task, 0 scenarios) · Preview: none (browser tests are local-only, they skip when BASE_URL is set)

Tech task: the checklist items are the acceptance criteria. `git diff main` shows `e2e/team-accounts.spec.ts` and `e2e/no-js-form.spec.ts` unchanged.

## Checklist
| Item | Evidence | Really checked? | Result |
|---|---|---|---|
| Built from shared components and page container; no ad-hoc classes on inputs/selects/buttons; no page padding/width/column layout | Read `members/page.tsx`, `password/page.tsx`: `Page`, `Input`, `NativeSelect`, `Button`, `Field`, `Card` are used and none of them gets a `className`. Remaining classes are `flex flex-col gap-4` on `ul`, `section` and `form`, plus `text-base font-medium` on the "new account" `h2`. | Non-tested, checked by reading. Those classes are spacing between blocks, not padding, width or a page column, and not on inputs, selects or buttons. Remark: the `h2` styling and the form gaps are ad hoc; `CardTitle` has the same styling. | OK, with remark |
| Each label resolves to one field (incl. role, both password fields); hint as accessible description | `account-pages.spec.ts` "every label ... exactly one field" | Yes: `toHaveCount(1)` for Benutzername, Anfangspasswort, Rolle, Name (exact), Aktuelles Passwort, Neues Passwort; hint asserted with the literal "Mindestens 10 Zeichen." | OK |
| One article per account, heading, controls inside | "each account is one article ..." (two accounts, `filter({hasText})` count 1, heading, three buttons inside the article) | Yes. Card renders `<article>`, and `CardTitle` renders `<h2>`. | OK |
| Unique `Neues Passwort – <name>` | same test, page-wide and within the article, count 1 each | Yes. Implemented by `aria-label` on the input, so the visible label text is only "Neues Passwort" while the accessible name is longer. This is the same accessibility contract as before. | OK |
| Role select works without JS, label + both options | `no-js-form.spec.ts` (unchanged) passes with `NativeSelect`; "Rolle" label covered above | Yes. The option wording comes from `terms.Helper` and `terms.Technician`; I did not check that the options are asserted by their literal text. | OK |
| alert/status inside `<main>`, one of each | `team-accounts.spec.ts` unchanged and green | Yes | OK |
| Deactivated account recognisable, no controls | "a deactivated account stays recognisable ..." | Yes: text "deaktiviert" is present, 0 buttons and 0 textboxes in the article | OK |
| 360 px on both pages | `team-accounts.spec.ts` unchanged and green | Yes (existing test, per the test plan) | OK |
| 60-char name, no spaces, ≤ 360 px | "a 60-character name ..." | Yes: name length asserted to be 60 (literal), scrollWidth ≤ 360 | OK |
| Every text from `team.de.ts` | Read both pages: all texts come from `teamMessages`. | The only inline literal is the separator " · " (and the template around `texts.deactivated`) in the card description. That is punctuation, not a text. | OK |
| No test weakened; `verify --e2e` green; selector changes named in the PR | The two existing specs are unchanged. `verify.ts --e2e` was not re-run by me (the four e2e specs are green). | There are no selector changes. This item is intentionally unticked until the PR states that. | Open, as planned |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | see the 360 px items above | OK |
| List pages fast with realistic data | partly: the account list has a handful of team members, no pagination, no new query | `teamMemberAccounts` is unchanged | OK |
| Every command writes its journal entry | no, no behaviour change | Actions are untouched | n/a |
| Texts from message catalogs | yes | see above | OK |
| No personal data in logs | no change | none | n/a |
| Playwright loads local E2E credentials | side change in `playwright.config.ts` (`process.loadEnvFile`) and `.env.example` | Guarded by `existsSync`; absent in CI, where the environment variables apply | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| A long name is checked only for `scrollWidth`, not that the name is visible or wrapped (it could be clipped) | No rule beyond "no horizontal scroll" | Question – acceptable |
| Long username or a long name on the password page/nav | ST-005 review named only the name | Question |
| Deactivated recognisability rests on the text "deaktiviert" in a muted description, with no visual distinction | Story: "still recognisable" | Fine as is; a style cue could be a later polish |
| Two accounts with the same name: `Neues Passwort – <name>` would then be identical for both | No rule in ST-077 (was already so in ST-005) | Question: is the name unique? It is not asserted in the UI |
| `Field` clones its child for `aria-describedby` and needs the child to be a single element; a passed fragment would silently lose the description | None | Fine; `Field` documents it |
| Empty account list state (impossible while a technician is logged in) | None | none |
| Helper on the account pages | Covered by the existing "a helper cannot reach the account pages" test, green | none |
| Rejection plus confirmation together via the URL (`?error=…&done=…`) can show both | Story requires exactly one of each visible "at a time", meaning one alert and one status, which holds | none |
| Preview run of the account tests is impossible (no technician account before ST-068) | Known and documented in the spec | none |

No finding reaches the follow-up hurdle; nothing needs a new story.

## Verdict
**accepted with remarks.** All ticked items have real evidence and all 11 browser tests pass. The remarks are the ad-hoc spacing/heading classes on the pages, which do not break the rule as written, and the last checklist item, which stays open until the PR states "no selector changes". Before `done`: tick that item and run `verify.ts --e2e` once (I ran the four e2e specs, not the full gate).
