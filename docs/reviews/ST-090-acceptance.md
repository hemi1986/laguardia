# Acceptance – ST-090: Dark design on every page, with a switch to light per device
Date: 2026-10-29 · Tests run: `npx playwright test e2e/dark-design.spec.ts` → 11 passed, 0 failed (plus `check-scenarios.ts ST-090` → 11/11 covered; `src/app/design.test.ts` read, 17 table rows) · Preview: none (branch just pushed)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Pages open dark although the device is set to light | `e2e/dark-design.spec.ts` | Yes. `colorScheme: "light"` for the whole file; team overview and visitor page `/m/<number>` (fresh device) both read as computed `color-scheme` dark. | pass |
| A team member switches the device to light | same | Yes. Starts on the machine record, uses the real „Mehr“ button, checks URL and heading, light design, and that „Mehr“ lists the same entries with „Dunkles Design“ in the old place. | pass |
| Switching on a filtered list keeps the filter | same | Yes. Real search, switch, URL is identical, field value kept, exactly one machine listed. | pass |
| The switch sits between „Passwort ändern“ and „Abmelden“ | same | Yes. Real helper login; last three entries compared as literals. | pass |
| Switching works without JavaScript | same | Yes. `javaScriptEnabled: false`, open defects list, URL and light design checked. | pass |
| The choice belongs to the device | same | Yes. Light on the PC page; second browser context (phone) is dark; after logout and login the PC is still light. | pass |
| The login and the team not-found page follow the device's choice | same | Yes. Light after logout on the login, via the link from the start page (client-side navigation), and on a 404 team address; a second device without a choice sees both dark. | pass |
| Visitor and legal pages are always dark and offer no switch | same | Yes. Device is light and logged out; visitor page, legal page, visitor not-found page and the start page are dark and have no button named /Design/. | pass |
| The sticker print page stays light | same | Yes. Page and the three controls (Drucken, Zurück, count) read light on a dark device; background is rgb(255,255,255); in print media the label text is rgb(0,0,0) on white. Also checks that going back to the selection returns to the dark design. | pass |
| Native controls follow the design | same | Yes. Model choice, its option, a checkbox, date field and file chooser read dark, then light after the switch. The opened list's background equals the page's. The "opened" list is checked through the `option` element's colour scheme and background, not a screenshot; this is acceptable under the story's "computed colour scheme" rule. | pass |
| Every fold looks the same | same | Yes. In both designs the `::before` marker of „Mehr“ and „Verwalten“ is equal when closed, equal when open, differs between closed and open, uses the text colour, and the browser marker is off. Gap: the `GroupedChoice` fold (G27) also uses the class but is not asserted (ST-094 builds the groups; the story names only „Mehr“ and „Verwalten“ in the scenario). | pass |

Also read: the proxy sets the path header on every request except `api/`, static files and the favicon, so Server Action re-renders (POST to the page route) and 404 pages are decided the same way. `DesignFollowsPage` corrects `<html>` on client-side moves between page groups; the test covers start page → login and print → selection.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes (one extra entry under „Mehr“) | The "other device" context uses 360x800; the entry is a plain list item with the `link` style. | OK |
| List pages fast with realistic data | no new queries | Only a cookie and a header are read. The root layout was already per-request (`connection()`). | OK |
| Every command writes its journal entry | no | The switch is a browser cookie, not a domain command; no event (story `events: []`). It is documented in the action as being like the visitor's language switch. | OK |
| Texts from the message catalogs | yes | `team.switchTo` in `src/platform/messages/team/shared.ts`. | OK |
| No personal data in logs | yes | The cookie holds only "dark" or "light", nothing is logged. | OK |
| Security / CSP | yes | No inline script (design is a server-rendered class); the cookie is httpOnly + SameSite=Lax; the redirect target goes through `sameSitePath`; the Server Action passes through the proxy's Origin check; the path header is overwritten by the proxy so a browser cannot inject it. | OK |
| Conventions paragraph named in the PR | yes | Added under *Shared UI components*: "The design of a page" and "Every fold is a native `<details>` whose `<summary>` has the class `fold`". The PR description must name them (not yet opened). | OK (remind) |
| No colour of its own | yes | grep over `src`: only `text-black` in the sticker sheet (printed text, allowed by the convention) and white flattening in photo code (image processing, not UI). No `prefers-color-scheme` anywhere. | OK |
| Traceability | yes | 11/11 scenarios covered by `check-scenarios.ts`. | OK |
| Critical advisories | not touched | No dependency change in the diff. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Cookie `design` has an invalid value (e.g. "blue") | Not stated; `deviceDesign` ignores it and the page is dark; unit-tested | none |
| Switch tapped on a page whose address carries a long query string or an encoded character | Story: "same address" – the hidden `back` field is rebuilt from `usePathname` and `useSearchParams().toString()`, which re-encodes; the result is equal in form but not necessarily byte-for-byte | question – low risk, no action |
| Switching right after a Server Action rejection (the form's result state is lost) | Story Context: unsent form text is lost, accepted | none |
| `GroupedChoice` fold is not asserted by a browser test | G31 names the G27 groups; ST-094 owns them | add the assertion in ST-094 |
| Logged-in team member opens a visitor page (/m/…) in the light design | Story: visitor pages are always dark, no switch – this is the behaviour | none |
| Two tabs: switch in tab A, tab B stays the old design until the next navigation | Not stated; normal for a cookie-based choice | question – accept |
| Long German label or other language | Team UI is German only (G26); "Helles Design" / "Dunkles Design" are short | none |
| Print preview from a dark device by browser menu (not the page button) | Print page is light on screen and paper (story) – covered by the print-media check | none |

No finding reaches the follow-up hurdle.

## Verdict
**accepted with remarks.** All 11 scenarios have tests that check Given, When and Then through the real pages, and all 11 pass. The Definition of done is met. Remarks: (1) the pull request must name the conventions paragraph "The design of a page" and "Every fold …" as the story's Notes require; (2) the `GroupedChoice` fold marker should get its browser assertion in ST-094.
