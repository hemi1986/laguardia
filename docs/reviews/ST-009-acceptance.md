# Acceptance – ST-009: Machine record with machine status history
Date: 2026-10-02 · Tests run: `npx vitest run -t "ST-009|RM-MachineRecord"` → 4 passed; `npx playwright test e2e/machine-record.spec.ts` → 1 passed (local, 360 px) · Preview: https://laguardia-btb2xikj6-hemi6.vercel.app (not exercised: behind deployment protection, no technician account before ST-068; the e2e test skips itself when BASE_URL is set)

`check-scenarios.ts ST-009`: 4/4 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Team member opens a machine record | `e2e/machine-record.spec.ts` | Given: model Williams/1997/Pinball/DMD and machine with serial and "Hall 2, row 3" created through the real forms (title made unique per run, so not literally "Medieval Madness"/LG-042; the museum number is assigned by the system – acceptable). When: opens the record by clicking the overview link (search, then click) – the real entry point. Then: h1, and each detail (serial number, model, manufacturer, year, category, technology, location, status) asserted per dt/dd with literals; 360 px width has no horizontal overflow. | pass |
| Machine status history is shown newest first | `machine-record.integration.test.ts` | Given: registered as Playable by Eva, changed to Out of order with the reason "flipper coil burnt" by Tom, fixed clocks. When: the page's real data loader and the real view. Then: order asserted by indexOf (change before registration); literals "flipper coil burnt · Tom · 20.01.2026, 14:30" (Berlin, winter +1) and "Eva · 15.01.2026, 10:00". Not tautological. The change goes through a test stand-in command (`changeMachineStatusForTest`) until ST-012 – acceptable. | pass |
| Unknown museum number | same | When: loader and view for "LG-999" (another machine exists). Then: loader returns undefined, text "Kein Gerät mit der Museumsnummer LG-999." | pass |
| Retired machine keeps its record | same | Given: retired via stand-in (until ST-039, as the story says). Then: "Ausgemustert am 01.03.2026, 12:00 – Sold" (Berlin time asserted), serial number, location, registration entry. Mark and details asserted. The history is only checked via the registration entry (there is no retirement entry yet). | pass |

Additional: read-model test "has every detail of the machine and its machine model, by museum number" (`machine-overview.integration.test.ts`) asserts the full record with literals, including the machine model's manufacturer, category, technology, and `undefined` for the absent year/serial number.

Remark on the "Then" of scenario 1: the story names "machine model details"; the e2e test covers all of them (the integration tests don't re-check them, which is fine).

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e runs at 360x800, scrollWidth ≤ 360; the dl grid is `auto/1fr` | OK. See edge case on long texts |
| List pages fast with realistic data | n/a (single record) | The overview is unchanged apart from the link. The record does 3 small queries (record, history, names) | OK |
| Command writes journal entry | n/a (read only) | – | OK |
| Texts from message catalogs | yes | `teamMessages.machineRecord`, `terms`, `machines`, `machineModels`; no literal UI text in the view | OK |
| Times in Europe/Berlin | yes | `formatDateTime`; asserted in the winter case (CET, +1 h) | OK. No test in summer time (CEST) |
| No personal data in logs | yes | No logging added; names are only rendered | OK |
| Reachable from the overview | yes | the overview title is a link; e2e clicks it | OK |
| Access | yes | `requireTeamMember()`: every team member sees it, as intended by the page's comment. Not tested (neither that a guest is redirected nor that a non-technician role can open it) | OK with remark |
| Module boundaries / lint change | yes | The page composes Collection and Team's public queries; the lint rule allows tests to import another module's test support (user decision) | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Retired machine still shows "Status: Spielbereit" (or whatever it was) next to the "Ausgemustert" line | No rule; the story only says "marked as retired" | Question: should the machine status be hidden/overridden for retired machines? Probably retirement (ST-039) will settle it |
| Retirement is not in the status history | Story context lists only status changes | Question for ST-039 |
| Team member who made a change is unknown (no row) | Not in the story; view shows "unbekannt" | Fine; no test for the fallback – low priority, fix now if cheap |
| Deactivated account's name | CONTEXT.md, Account: the team member keeps their name | Covered by the design (`teamMemberNames` reads the team member table); no test |
| Long texts (location, reason, model title, serial number) in the `dd` / history lines | Definition of done: 360 px | Question: the `dd` and history lines have no `break-words`; one long word without spaces could overflow. Verify in the UI; fix now if so |
| Museum number in the URL with different case or spaces ("lg-042") | No rule | Question; "not found" is shown, which is acceptable |
| Unknown number answers 200 with a message in the page (no HTTP 404) | Story only requires the message | Fine for the story; note for QR scanning (ST-011) |
| Unknown-number page title is the generic "Gerät" | – | Fine |
| Guest (not logged in) opens `/team/machines/LG-042` | `requireTeamMember` redirects; existing platform behaviour | No test in this story; covered by the platform's session tests I presume – question |
| Summer time (CEST) display | Time convention, ST-003 | Covered by `formatDateTime` tests presumably; no gap here |
| Machine with a very long history | – | Not a problem for the base; later stories add sections |
| Concurrent status change while open | – | Read-only page; no issue |

No gap meets the follow-up hurdle (no security or data-loss risk, nothing blocks a named story).

## Verdict
accepted with remarks

Remarks (none blocking): (1) the status line for a retired machine (question for ST-039); (2) check long unbroken texts at 360 px; (3) no test for the "unknown" team-member fallback or for access by a guest; (4) the preview was not walked through (protected, no account) – the user's acceptance on the preview must be done with an account.
