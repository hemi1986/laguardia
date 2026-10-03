# Acceptance – ST-017: Triage list of untriaged problem reports
Date: 2026-10-03 · Tests run: `npm test -- -t "ST-017"` → 9 passed (4 files); `npx playwright test e2e/triage-list.spec.ts` → 3 passed; `check-scenarios.ts ST-017` → 10/10 covered · Preview: only "Visitors cannot open the triage list" is visible there (no team account before ST-068); not exercised by me, local tests are the evidence.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician sees untriaged problem reports | triage-list.integration.test.ts | Real DB, real commands (register, report as visitor and helper). Times are 12:05/13:10 UTC = 14:05/15:10 local, shown as literals. Data and rendered HTML asserted: museum number, title, description, reporter, time, and order (the later one is created first, so the order is really tested). | pass |
| Problem reports waiting longer than 72 hours are highlighted | same | 73 h / 71 h with a fixed clock. Flag asserted and the words "Wartet länger als 3 Tage" appear only in the LG-042 entry. The 72 h boundary itself is not tested (see edge cases). | pass |
| Helpers see the triage list without technician actions | e2e/triage-list.spec.ts | Real helper account created through the page, logged in, opens "Sichtung", sees the report. The "not offered" check looks for buttons and links named "Defekt erfassen/Verknüpfen/Verwerfen", but no such action exists yet, so it passes vacuously today. It becomes meaningful with ST-018/020/022, which must keep it or sharpen it. The helper's access to the page itself is really proven. | pass (weak "But") |
| Triaged problem reports leave the list | integration test | A triaged report is created through a test stand-in command; data and HTML no longer contain it, the untriaged one remains. | pass |
| Nothing waits for triage | triage-list.test.ts | Unit render of the view with an empty list; the German sentence is a literal and no `<li>` is present. Fine for a view-only state. The page's data path for an empty DB is not run, which is acceptable. | pass |
| How many problem reports wait | integration test | 12 reports created, "12 Meldungen warten auf die Sichtung." asserted. The singular form is not tested. | pass |
| The long wait is said in words | integration test | 73 h → "wartet seit 3 Tagen" asserted. | pass |
| Triaging happens on the problem report's own page | problem-report.integration.test.ts | Opened through the data loader and the view, not by clicking a link. The click-through from the list is covered by the e2e test "a technician opens a problem report…" (not scenario-titled). Machine, description, reporter "Anna", time and waiting time are asserted as literals. | pass |
| Report text is never interpreted | integration test | Asserts the escaped literal and the absence of `<script>`. | pass |
| Visitors cannot open the triage list | e2e (also runs on preview) | Real entry point, redirected to /login. The detail page `/team/triage/[id]` is guarded the same way (`requireTeamMember`) but has no logged-out test. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e checks `scrollWidth <= 360` on the problem report page; the list uses `overflow-wrap:anywhere`. The list page's own width is not measured at 360 px in e2e. | OK, small gap |
| Texts from the catalog | yes | All texts come from `teamMessages.triage` / `terms`. Navigation "Sichtung" is in the catalog as well. | OK |
| G5 (list entry plus one way to open) | yes | One link per entry, no outcome buttons. | OK |
| G6 / G6a (counts and waits in words, not only colour) | yes | Count sentence and "wartet seit …" are text; the long wait is its own text line. | OK |
| G7 (empty state said) | yes | Empty sentence is present. | OK |
| List fast with realistic data | yes | A single query plus two batched lookups (machineLabels, teamMemberNames), no N+1. Tested with 12 entries; no pagination, which is acceptable for a list that should be near empty. | OK |
| Journal entry per command | no | Read-only story; the test stand-in `triageForTest` is test support. Migration 0008 adds the triage columns. | n/a |
| No personal data in logs | yes | No logging added. | OK |
| Permissions | yes | Pages require a team member; helpers included (G19). | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Exactly 72 h is not highlighted ("more than 72 hours") | Yes, Context: more than 72 hours. Only 71 h and 73 h are tested. | Optional: add a 72 h boundary test (a unit test of `elapsedMoreThanHours` exists in `time.test.ts`, which covers part of it). Fix now, minutes. |
| The helper "But" is vacuous until the actions exist | Scenario text | Remark: ST-018/020/022 must ensure helpers do not get these actions. They already carry notes (the diff touches ST-019/020/022). No new story. |
| Singular "1 Meldung wartet…" and the day singular ("1 Tag") | Catalog implements them, untested | Optional unit test. |
| A machine retired or "Not on display" after reporting; museum number missing, falls back to "" | No rule | Question: the list would show " · " for a vanished machine. Machines are probably never deleted, so low risk. |
| A reporting team member who was deactivated or removed shows "unknown team member" | Handled by the fallback `machineRecord.unknownTeamMember` | OK. |
| The triaged-report detail page says "already triaged" and hides waiting time | Reasonable, no rule | OK. |
| Visitor, English language | Team pages are German only (CLAUDE.md) | OK. |
| Two technicians open the same report at once | No rule yet | Question for ST-018 ff.: the version check (triage `version`) exists in the stand-in. |
| Very long descriptions | `overflow-wrap:anywhere` is set; the list shows the full text | Question: should the list truncate long descriptions? No rule. |
| Detail page for a logged-out visitor | Same guard as the list | Optional e2e. |

None of the findings meets the follow-up hurdle; all are fixable in this story or belong to the existing stories ST-018 to ST-022.

## Verdict
**accepted with remarks** – all 10 scenarios have real tests and pass. Remarks: (1) the helper "But" line is only vacuously verified until the outcomes exist, so ST-018/020/022 must keep that e2e test meaningful; (2) the 72 h boundary and the singular wording are untested; (3) the list page's 360 px width is not measured directly.

## Resolution (main session, 2026-10-03)
- 1: by decision – ST-018/020/022 carry the check (their Context says so).
- 2: singular wording tested (`triage-list.test.ts`); the 72 h boundary stays at `elapsedMoreThanHours`' own test.
- 3: the list page's width is now measured in e2e.
- 4: skipped – the click from the list is in the untitled e2e.
- 5: missing machine label unreachable (foreign key); long descriptions wrap (`overflow-wrap:anywhere`), not truncated – question for the user if wanted; concurrent triage belongs to ST-018.
- User, 2026-10-03: accepted („abgenommen“) after migrating the local database; long descriptions stay unshortened (recommendation, no objection).
