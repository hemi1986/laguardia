# Acceptance – ST-058: Technician dashboard – recent changes, stale claims and overdue maintenance
Date: 2026-10-24 · Tests run: `npm test -- -t "ST-058|technician dashboard"` → 16 passed, 0 failed (1 file; 7 ST-058 scenario tests, 6 ST-048 tests, 3 extra tests) · `check-scenarios.ts ST-058` → 7/7 covered · Preview: none (browser tests not run; the only e2e change is the adjusted ST-048 assertion in `e2e/technician-dashboard.spec.ts`)

All tests are in `src/app/(team)/team/technician-dashboard.integration.test.ts` (page data function plus rendered view, isolated database, fixed clock NOW = 2026-06-10T10:00Z), as agreed in the test plan.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Stale claims are singled out | integration test, same title | Given: defect claimed by Ben 15 days before NOW via the real commands, no work log. When: `loadTechnicianDashboard` plus rendered `TechnicianDashboard`. Then: exact stale-claim record with title, machine, claimant "Ben"; link to the defect; the reason text "Von Ben vor mehr als 14 Tagen übernommen, seitdem kein Arbeitsschritt."; "still claimed by Ben" checked through `openDefects({claimedBy})`. All asserted with literals. | pass |
| A work log entry by someone else keeps a claim from being stale | same | Given: claim by Ben 15 days ago, Tom logs work 3 days ago (real commands). Then: `staleClaims` is empty and the title is absent from the HTML. | pass |
| Overdue maintenance tasks are counted, not listed by machine | same | Given: real maintenance plan task, overdue on two machines. Then: count 2, text "„Wax playfield“ ist an 2 Geräten überfällig.", no "LG-042" in the HTML, link to /team/maintenance "Zur Wartung". | pass |
| Machine status changes and resolved or reopened defects | same | Given: Anna sets LG-007 Out of order yesterday, defect reopened today (a resolve step is added, which is harmless). Then: the whole `recentChanges` array is asserted exactly (order, actor, time), plus rendered lines and links. Anna's name and "wieder geöffnet" are asserted. | pass |
| Older changes drop off after 7 days | same | Given: change 8 days ago, plus one 7 days minus 1 second ago (boundary). The "visited since then" Given is deliberately not set up (user decision 2026-10-24; the last visit is recorded from ST-050 on). Then: only the newer change remains, and the old one is not in the HTML. | pass (as approved) |
| An empty section says so next to a filled one | same | Given: no claim, one overdue task. Then: "Kein Defekt ist liegengeblieben.", the task is named, and the all-empty sentence is absent. | pass |
| Recent changes are shown below the all-empty sentence | same | Given: nothing needs attention, Tom changes LG-007 to Playable yesterday. Then: the all-empty sentence is present and the status-change line comes after it (index comparison), with Tom's name. Sections 3 and 4 are absent. | pass |

Extra tests beyond the scenarios: the 336 h boundary and the "work logged before the claim does not count" rule, the "no changes in the last 7 days" sentence, and the section 1/2 empty sentences. These are useful.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes (ui) | Cards are in the existing single-column layout, `[overflow-wrap:anywhere]` on user texts, a button as the only action. No browser check at 360 px was run (no preview). | OK by reading; verify visually on the preview |
| List pages fast with realistic data | yes | Queries are set-based (open defects with a work-log subselect, joins with a time filter); there are no per-row queries. The stale-claims query loads all open claimed defects and filters in memory, which is fine at museum scale. | OK |
| Every command writes its journal entry | no | Read model only, no new command. | n/a |
| Texts from the message catalogs | yes | All new texts are in `src/platform/messages/team/dashboard.ts`; the status names come from `machines.statuses`. | OK |
| No personal data in logs | yes | No logging added. Names are shown only on a team-only page. | OK |
| Critical Next.js / React advisories | not touched | No dependency change in the diff. | n/a |
| Module boundaries | yes | The page composes Repair, Collection, Maintenance and Team through their `index.ts` files (ST-009). | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Machine retired or "Not on display": its status changes are shown (the query includes retired machines, per the code comment) | Story is silent on it | question – probably fine for a log of changes, but a retired machine's link /team/machines/<no> may lead to a page that does not show it as expected |
| A defect resolved and reopened within the window appears twice (once as "behoben", once as "wieder geöffnet") | Story says "resolved or reopened", so both events | OK as is, documented in the code |
| Two stale-claim entries when the claimant's name is unknown (deleted or deactivated team member): `nameOf` fallback | None | question – check that the fallback text is neutral |
| Stale claims are only visible on the technician dashboard, and the helper dashboard (ST-049) is unaffected | Story: technician only | OK |
| The "since the last visit if longer than 7 days" part has no implementation or test until ST-050 | Story Context, user decision 2026-10-24 | The ST-050 story should carry this: it must extend `RECENT_HOURS` with the last visit. Add a line to ST-050 notes if not already there. |
| Overdue maintenance for a machine with the status Not on display or retired: counted or not depends on `machinesForMaintenance` and the ST-043/ST-056 rules | ST-043 / ST-056 | OK, reused as is |
| Very long defect titles or maintenance task names on 360 px | None | Handled by `overflow-wrap:anywhere` |
| Time zone of the shown times: `formatDateTime` renders 12:00Z as 14:00 (Europe/Berlin summer time), and the tests assert this | UX guidelines | OK |
| A claim exactly 336 h old is not stale, and 336 h plus one is | Story: "more than 336 hours" | Covered by the boundary test |

## Verdict
accepted with remarks

Remarks (none blocks, none reaches the follow-up hurdle):
1. The Given "the technician visited the dashboard since then" of "Older changes drop off after 7 days" is not set up. This was agreed by the user on 2026-10-24, and it is noted here only for traceability.
2. Visual check at 360 px and the full browser run are still open (no preview URL). The ST-048 e2e assertion was adjusted correctly (the changed machine now appears under "Letzte Änderungen"), but I did not run it.
3. Make sure ST-050 picks up the "since the previous visit" extension of the window.
