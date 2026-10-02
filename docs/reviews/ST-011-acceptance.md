# Acceptance – ST-011: QR sticker leads visitors and team members to the machine
Date: 2026-10-02 · Tests run: `npx vitest run -t "ST-011"` → 4 passed (2 files, 3 scenario tests + 1 retired-machine integration test); `npx playwright test e2e/qr-sticker.spec.ts` → 6 passed · Preview: https://laguardia-2xod5taqf-hemi6.vercel.app (not opened by me; behind protection, no data; CI reported green). `check-scenarios.ts`: 9/9 covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician prints a QR sticker | qr-sticker.test.ts (render of `StickerSheet`) + e2e (choose, print page) | Then: QR img, "LG-042" text, both prompts asserted as literals. E2E walks the real path (overview link, search, check, print) and asserts the page has no navigation. The real print dialog is not exercised. | OK |
| The QR code contains the stable address | qr-sticker.test.ts | The sticker's own PNG is decoded with jsQR and compared to the literal `https://eschbach.michaelschempp.de/m/LG-042`. | OK |
| Several stickers on one label sheet | qr-sticker.test.ts | One `sticker-page`, three label positions as literal mm values (L7160), three numbers present. Only at component level (no browser test of three at once). The "second page after 21" test is a bonus. QR and prompt per sticker are not asserted for each of the three (only number) – minor. | OK (remark) |
| Visitor scans the sticker | e2e | Phone-sized context without session opens `/m/<n>`; model title and "Problem melden" link asserted. | OK |
| Team member scans the sticker | e2e | Logged in, `/m/<n>` ends at `/team/machines/<n>`, heading and status history asserted. | OK |
| Visitor and team member scan one after the other | e2e | Two browser contexts, team first, then visitor sees visitor page, no status history. This tests session separation in the app, not a shared cache (see DoD). | OK |
| No machine chosen for printing | e2e | Submit with nothing checked: URL `?error=none`, German alert text, no QR image. Also holds for a direct `print` request (server redirects when no sticker). | OK |
| Finding the machines to print for | e2e | Search by title narrows (other machine gone), search by number part works, count "1 Gerät gewählt" (JS). The Given "60 machines" is not set up (two machines are enough to prove narrowing, but not list size). 360 px overflow checked. No-JS fallback text not tested. | OK (remark) |
| Retired machines get no sticker | stickers.integration.test.ts | Real DB, LG-013 retired: not in the choice, not printed even when requested directly via `stickersFor`. | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px usable | yes (choice page) | e2e asserts no horizontal overflow on the choice page; checkboxes 20 px (`size-5`). The print page is 210 mm wide by design (a print page, technician on a desktop). | OK |
| List pages fast with realistic data | partly | Choice page lists all active machines, unpaginated, as in overview; fine for tens to a few hundred machines. | OK |
| Command writes journal entry | no | Printing is a read; no command. | n/a |
| Texts from message catalog | yes | `teamMessages.stickers`; the visitor-facing prompt is in the team catalog (`team.de.ts`) – acceptable since it is printed in both languages, noted in a comment. | OK |
| No personal data in logs | yes | Nothing logged. | OK |
| Never from a shared cache (context) | yes | `/m/` reads the session so Next sends `private, no-store`; `e2e/visitor-machine-page.spec.ts` checks the header against the preview (skipped on local dev). That test is run without a session, which is the case that matters for the shared cache. | OK |
| Prompt in DE and EN | yes | Asserted. | OK |
| A4 label sheet | yes | L7160 constants, `@page A4 margin 0`, 297 mm pages; positions tested. | OK |
| Technician only | yes | `requireTechnician` on both pages; helper goes to `/team`. Not tested (helper scenario not in the story). | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Deactivated team member (banned) scans at `/m/` | ST-005/ST-069: "acts as nobody". `loggedInTeamMember` returns undefined for banned users, so the visitor page is shown, no redirect, no error. Correct, but no test for it. | question: optional test, not blocking |
| Team member logs out on the same phone, then scans | Session cookie is gone, same code path as "nobody logged in"; no cache involved. | no action |
| Team member scans an unknown or retired number | Redirect goes to the machine record, which shows "Kein Gerät mit der Museumsnummer …" for unknown. A visitor gets not-found. No rule violated. | question |
| Real print preview (margins, blank last page, scale 100 %) | Story says only "sized for A4 label sheet". CSS sets `@page` margin 0 and `break-after: page` on every page section including the last, which can add an empty trailing page in some browsers; browser "Fit to page"/scale or a printer's own margins can shift labels. Only checked in code and units, not on paper. | question: user should do one test print on a plain A4 sheet held against the label sheet before the first real print (matches "team names label product before first print") |
| Very many machines chosen (e.g. all 300) | None. Selection goes in the URL (`?m=…&m=…`, about 9 chars each, so the 8 KB limit is reached at about 900 machines) and every sticker embeds a ~480 px PNG data URL in the HTML (several MB at hundreds of stickers). Fine for the museum's expected size. | question, not a gap |
| Chosen machine disappears (retired) between choice and print | Silently left out; if all are gone, the "choose at least one" message appears. Count on the print page shows what is actually printed. | no action |
| Duplicate/odd `m` values, unknown numbers | Passed over (tested). | no action |
| Long machine model titles in the choice list | `label` wraps; 360 px overflow only checked with short titles. | question |
| No-JS: count not shown, plain-text fallback | User decision; fallback text exists, not tested. | question, optional test |
| Domain constant is "provisional until first print" | `qr-address.ts` comment; ST-060 says no sticker before the custom domain exists. The domain is a constant, so it will have to be confirmed before real printing. | question for the user before printing |

## Gaps against the follow-up hurdle
None qualify for a new story. No scenario is without a real test, no test fails, no rule in the story or context pack is violated.

## Verdict
**accepted with remarks** – remarks: (1) multi-sticker scenario verified at component level only (numbers asserted for all three, QR and prompt only once); (2) one physical test print recommended; (3) optional tests for a deactivated session at `/m/` and the no-JS fallback.
