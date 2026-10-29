# Acceptance – ST-088: Edit an account on one page, and deactivate or activate it with one tap
Date: 2026-10-29 · Tests run: `npm test -- -t "ST-088"` → 9 passed (4 files), 0 failed; `check-scenarios.ts ST-088` → 18/18 covered. Browser tests (`e2e/team-members.spec.ts`, `e2e/account-pages.spec.ts`) not re-run by me; the caller reports them green locally. · Preview: none checked

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| The team member's page and the edit page show the account | account-page.integration.test.ts | Yes: name, username, role, "Konto: aktiv", edit link and deactivate button, no select/password/role button; edit page heading, prefilled values, empty "Neues Passwort", hint, back link | OK |
| A technician changes name, username and role on the edit page | e2e/team-members.spec.ts | Yes: real form, confirmation text, new values on the page, login with new username and old password works, old username fails | OK |
| A changed username keeps the sessions running | edit-account.integration.test.ts | Yes: session cookie still resolves to the same team member after rename | OK |
| A new password replaces the old one and ends the sessions | edit-account.integration.test.ts | Yes: 12-character password, session becomes visitor, new works, old fails | OK |
| Saving without a change is confirmed | e2e/team-members.spec.ts | Yes: no alert, `?done=saved`, confirmation text | OK |
| A renamed team member's name shows on everything they did | renamed-team-member.integration.test.ts | Yes (work log via defect page, maintenance record via machine record, list; "Anna Berger" absent from all three after the rename; isolated database) | OK |
| A password that is too short is rejected and the input kept | e2e + edit-account.integration.test.ts | Yes: reason above save, field marked and empty, name kept, heading still old name, old password works | OK |
| A username already taken is rejected and the new password not set | e2e + edit-account.integration.test.ts | Yes: reason, marked field, "tom" kept, old password works, new password does not | OK |
| An empty name is rejected | e2e/team-members.spec.ts | Yes: whitespace name goes past the browser check to the Team module; username and role kept; the module test checks the name stays | OK |
| One's own edit page fixes the role and has no new password | account-page.integration.test.ts | Yes: hint text, no select or password field, link "Passwort ändern"; own-role and own-password rejections; account unchanged | OK |
| The last active technician changes their own name | last-technician.integration.test.ts | Yes: name changed, role and active unchanged | OK |
| Two technicians demote or deactivate each other at the same time | last-technician.integration.test.ts | Yes: concurrent `Promise.all`, exactly one ok, one `last-technician`, one active technician left | OK |
| Deactivating is one tap without a question | e2e/team-members.spec.ts | Yes: one click, confirmation, "Konto wieder aktivieren" offered, her phone's session ends | OK |
| Activating again is one tap | e2e/team-members.spec.ts | Yes: confirmation, "Konto: aktiv", login works | OK |
| The old address of the question page leads to the team member's page | e2e/team-members.spec.ts | Yes: lands on her page, still active, no confirmation | OK |
| One's own page offers no deactivation | account-page.integration.test.ts | Yes: button absent, command refuses with `own-deactivation`, account still active | OK |
| A deactivated account is not edited | account-page.integration.test.ts | Yes: only one button (activate), edit page shows the message and back link without form, `account-deactivated` rejection, nothing changed | OK |
| Helpers do not reach the edit page | e2e/team-members.spec.ts | Yes: redirected to `/team`, no "Teammitglieder" link in the opened menu; Team module test checks `not-authorized` | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | Yes | e2e `pageWidth <= 360` on the edit page, the rejected edit and after deactivating | OK |
| List pages fast with realistic data | No new list; the team members list is unchanged | – | n/a |
| Every command writes its journal entry | No: BC-Team has no commands or events (`events: []`) | story Context | n/a |
| Texts from the message catalogs | Yes | `src/platform/messages/team/accounts.ts` changed; actions return error codes, not texts | OK |
| No personal data in logs | Yes | no `console`/logger calls in `actions.ts` or `accounts.ts` | OK |
| Security advisories | Not affected by this story | – | n/a |
| Verify | Yes | caller reports `verify.ts` green | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| A technician opens an edit page, another technician deactivates the account meanwhile, and the first one saves | Yes: "A deactivated account is not edited" (`account-deactivated` rejection) | covered by the module; the rejection's text on the edit page is not browser-tested; fine as is |
| A very long name or username | No rule on maximum length (memory: do not raise it) | ignore |
| Unknown or missing `role` posted by the form | Handled in `postedRole` (the role is kept) | fine |
| Two technicians edit the same account at once (last write wins, no version check) | No rule | question; low risk, because an edit changes small, reversible fields |
| English or German: the pages are team pages, German only | `ux-guidelines` / story | n/a |

## Verdict
**accepted**

Every one of the 18 scenarios has a correctly titled test that asserts its Given/When/Then with literal expectations. The ST-088 tests run green, and the story's rules (rejections decided before any write, own-role/own-password/own-deactivation refusals, sessions only ended by deactivation or a new password, old question address redirecting) are all covered. No gaps need a follow-up story.
