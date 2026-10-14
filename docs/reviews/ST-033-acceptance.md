# Acceptance – ST-033: Repair history on the machine record
Date: 2026-10-14 · Tests run: `npm test -- -t "ST-033"` → 8 passed (4 files); `npx playwright test e2e/repair-history.spec.ts --workers=2` → 1 passed · Preview: https://laguardia-c2p2vl7z3-hemi6.vercel.app (not exercised: team pages need an account)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Machine record shows open defects | machine-record.integration.test.ts | Given built through real commands (record, claim by Tom); When = real data loader + view; Then priority, claimant, absence of claimant on the unclaimed one, links by defect id all asserted with literals | pass |
| A machine without open defects says so | machine-record.integration.test.ts | Uses a resolved defect (stronger than none); literal text asserted in section 4 | pass |
| Repair history shows defects with work log entries | reparaturhistorie/repair-history.integration.test.ts | Two entries by two people, parts, closing note, who/when asserted; year chosen first (as agreed) | pass |
| Problems resolved on the spot ... | modules/repair/repair-history.integration.test.ts (+ page tests) | Module test asserts note, who, when via toEqual; page test asserts "Direkt behoben", "Anna · 01.05.2026, 10:10" and "Ball freed" | pass |
| Dismissed problem reports ... not shown | modules/repair/repair-history.integration.test.ts | Dismissal and an untriaged report both excluded (module level; not re-asserted in the rendered page, but the page only renders this data) | pass |
| A machine with no repair history | machine-record.integration.test.ts | Literal text; link correctly absent | pass |
| Status and history directly from the QR address | machine-record-load.integration.test.ts + e2e/repair-history.spec.ts | 144 defects / 87 on the spot / 29 dismissed, asserted. Timing (< 2 s) measured on data + render, slower of two runs, as agreed with the user; the e2e opens `/m/<number>`, checks redirect, status, section 4 and 7, 360 px width | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts page width <= 360 on record and history page | OK |
| List pages fast with realistic data | yes | load test for record and for a year of the history, both < 2 s | OK |
| Journal entry per command | no (read-only story) | no command added | n/a |
| Texts from message catalogs | yes | new strings in `team.de.ts` | OK |
| No personal data in logs | yes | no console/log calls in the new code | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Photos on work log entries | story says "if any"; ST-032 not built | nothing now; ST-032 must show them here (the context bullet already says later stories add their own scenario) |
| Invalid or unknown `?jahr=` | no rule; code falls back to the year list | fine, question only |
| Retired machine's repair history | record stays reachable (ST-009); history page loads for any museum number | works by construction, not tested; fine |
| Team member account removed | names become undefined | check the view shows a neutral fallback; question |
| Dismissed report not asserted on the rendered page | no | optional |
| Helper role opening the history | page uses requireTeamMember (every role) | consistent with the page comment |
| Defect recorded 31.12. 23:30 UTC lands in the next Berlin year | tested ("New Year's Eve") | OK |
| Year grouping by recorded date, not by resolution date | decided by user 2026-10-14 | OK; a defect resolved years later sits in the year recorded |
| Known flake: 2 browser tests time out with 4 workers, also on main | no | not this story's |

No gaps meet the follow-up hurdle.

Verdict: accepted

## Disposition (`/implement`, 2026-10-14)

- Photos: asked in `docs/stories/OPEN_QUESTIONS.md` (ST-032, ST-033).
- A removed team member: the views show „unbekannt“ (`machineRecord.unknownTeamMember`) wherever a name is missing.
- Unknown `?jahr=` falls back to the year list; the year is the one a defect was recorded in (user, 2026-10-14) – both as intended.
