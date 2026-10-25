# Acceptance – ST-081: Act on one account on its own page, and deactivate with one question and a way back
Date: 2026-10-25 · Tests run: `npm test -- -t "ST-081"` → 9 passed (4 files); `npm test -- src/modules/team` → 48 passed; browser tests (`e2e/team-members.spec.ts`) not re-run here, `verify.ts --e2e` was green on the head (1012 unit, 185 browser) · Preview: none (PR not open)

`check-scenarios.ts ST-081`: 16/16 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| The list shows one entry per team member | team-members-list.integration.test.ts | Yes. Real DB accounts, rendered list; name, role label, no form/button, no "Deaktiviert" (literals) | OK |
| Deactivated accounts are behind a filter | same | Yes. Ben deactivated through the module; not listed, checkbox unchecked | OK |
| The filter lists deactivated accounts, marked as such | same | Yes. Only Ben carries "Deaktiviert"; checkbox checked. Page level (GET parameter to read model) is covered only through the e2e `openFromTheList(deactivated)` | OK |
| The actions of an account live on its own page | account-page.integration.test.ts | Yes. Name, username, role, "Konto: aktiv", role/password/deactivate offered (view-level render) | OK |
| A technician changes the role from the account page | e2e/team-members.spec.ts | Yes. Real entry point; URL `?done=role`, confirmation names Anna, role shown, opposite button offered | OK |
| A technician resets a password from the account page | e2e | Yes. Confirmation names Anna; login with the new password is tried | OK |
| A rejected password reset names the reason at the form | e2e | Yes. Alert text, aria-invalid, empty field, old password still logs in | OK |
| Creating a team member happens on its own page | e2e | Yes. Link, own page, list with „Clara Vogt ist angelegt.“ and Clara listed | OK |
| A rejected creation keeps what was typed, never the password | e2e | Yes. Reason, username marked, name and role kept, password empty | OK |
| Helpers do not reach the team members page | e2e | Yes. "Mehr" opened, link absent, both addresses redirect to /team. Module refusal: ST-005/ST-081 module tests ("not-authorized") | OK |
| Deactivating asks once and names the person | e2e | Yes. Question text, both buttons, Anna's session alive until confirm, dead after, confirmation names her | OK |
| Deactivating one's own account says so | e2e | Yes. Own wording, logged out, /team goes to login, cannot log in | OK |
| Going back from the question changes nothing | e2e | Yes. Still active, no confirmation, session still works | OK |
| A deactivated account's page offers only activating it again | account-page.integration.test.ts | Yes (view-level). Role, password, deactivate absent; the Team module also refuses all three (module test) | OK |
| A technician activates an account again | e2e | Yes. Deactivates first, opens via filter, confirmation, "Konto: aktiv", login works | OK |
| The last active technician account offers neither deactivating nor the change to helper | last-technician-page.integration.test.ts | Yes. Isolated DB with Tom as the only technician; both offers missing, reason text, both commands refused with "last-technician". Not walked "from the list" in the browser, but the page is the same view | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e project runs at 360 px; `pageWidth <= 360` asserted on role, create and question pages. Not asserted on the list or the deactivated-account page | OK (minor) |
| List pages fast with realistic data | yes | About ten team members, one query, no N+1 | OK |
| Every command writes its journal entry | no | BC-Team has no events (`events: []`); audit trail is explicitly out of scope; approved decision | OK |
| Texts from message catalogs | yes | `src/platform/messages/team/accounts.ts`; the page uses `teamMessages` | OK |
| No personal data in logs | yes | Password never echoed or kept; no logging added | OK |
| Advisories | n/a | No new dependency | OK |
| Words (G12): "Konto" for account actions, "Teammitglied" for lists | yes | Seen in the catalog and in the e2e literals | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| `?done=role` is shown on any account whatever its state (role has no state guard like the other three), so a crafted URL shows "Rolle von X geändert." | No rule; G3 only. Harmless, nothing is written | question / ignore (fix now if an hour is free: show the confirmation only when it can be true) |
| Two technicians: A opens the question, B deactivates the same person; A confirms | Module refuses with "account-deactivated" (module test). The action returns that error state, but the question page has no error display (`AccountButtonForm` is not shown on this path in the tests) | question: check what the technician sees; fix now if blank |
| A deactivated technician or helper opens the question page directly by address | Page redirects to the account page (code). Not browser-tested | ignore |
| Empty filter result or a very long name at 360 px | None | question; low risk |
| Deactivated technician being the only one left in "active" terms (all technicians deactivated) | Protected: the last active technician cannot be deactivated | covered |
| Other language | Team pages are German only by design | none |
| Unknown or malformed team member id | Page shows `texts.unknown` with a link back (code) | covered, not tested |

Nothing meets the follow-up hurdle; no new story needed.

## Verdict
accepted with remarks

Remarks (all small, fixable in this story): (1) the `done=role` confirmation has no state guard, so a crafted URL can display a false confirmation; (2) the stale-click path "account-deactivated" on the question page is not shown to be user-visible; (3) the 360 px width is not asserted on the list or on the deactivated-account page.

## Resolution (implementer, 2026-10-25)
1. **Fixed:** `?done=role` is confirmed only on an active account, like the other three.
2. **Fixed:** the question page no longer redirects when deactivating is not offered – an action re-renders it, so the redirect swallowed the rejection. The button form shows the refusal in place of the button, or the rejection when it was refused itself („Dieses Konto ist deaktiviert.“). New browser test: „a deactivation another technician made meanwhile is said at the button, not swallowed“.
3. **Fixed:** the filtered list and the deactivated account's page assert 360 px (`openFromTheList` with the filter, the activation scenario).
