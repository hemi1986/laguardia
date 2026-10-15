# Acceptance – ST-048: Technician dashboard
Date: 2026-10-15 · Tests run: `npx vitest run -t "ST-048"` → 6 passed (the 7th test in the file is an extra, not a scenario); `npm run test:e2e -- --workers=2 e2e/technician-dashboard.spec.ts e2e/team-login.spec.ts e2e/team-shell.spec.ts` → 11 passed; `check-scenarios.ts ST-048` → 9/9 covered · Preview: not used (team pages need an account; the e2e file skips itself against a preview)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Untriaged problem reports with long waits highlighted | integration | Given: 3 reports at 73 h, ~25 h, 2 h before a fixed clock. When: page data + rendered view. Then: counts {3, 1} and the sentence "3 Meldungen warten … 1 davon länger als 3 Tage." The "highlight" is text (G6a) at section level, as decided on 2026-10-15; the 73 h report is not named individually. | pass |
| Machines without open defects that are not playable | integration | Given uses the real commands (record + resolve defect). Then: LG-042 listed with "Außer Betrieb · kein offener Defekt" and a link to the machine. | pass |
| Machines with open defects are not listed | integration | LG-043 Limited with an open defect is absent in data and view. A playable machine is also checked. | pass |
| Technician returns a machine to play from the dashboard | integration (+ e2e of the same flow) | The integration test uses the `changeMachineStatusCommand`, not the page. It shows LG-042 gone afterwards. The e2e test walks the real UI (select, reason, submit). | pass |
| A technician lands on their dashboard after logging in | e2e | Real login, URL `/team`, h1 "Übersicht", dashboard content, 360 px width. | pass |
| Nothing needs the technician right now | integration | Only a playable machine exists. Exact sentence asserted, and the triage section is absent. | pass |
| The dashboard leads to the triage list | integration | The sentence "3 Meldungen warten auf die Sichtung." and a link to `/team/triage`. The empty-section sentence is also checked. | pass |
| Returning a machine to play happens on the machine | e2e | "Status ändern" goes to the machine's status page, the change is made with a reason, and the confirmation reads "<number> ist jetzt Spielbereit." in the `status` role. The machine is gone from the dashboard. | pass |
| Helpers cannot open the technician dashboard | e2e | A real helper logs in and sees the placeholder only, with none of the technician texts. This is not a redirect or 403, as the user decided. | pass |

Remarks on the tests:
- The "highlighted" scenario is satisfied by a count in words. This fits the story's Context decision, so it is not a gap.
- The 72 h boundary (exactly 72 h is not long) is not tested here. It belongs to the triage-list read model (ST-003/ST-017); the dashboard reuses `triageList().waitingLong`.

Adjusted older tests:
- `team-login.spec.ts` now expects the h1 "Übersicht" instead of "Angemeldet als". This is right: the placeholder is gone for technicians. It is a little weaker, because it no longer asserts that the login lands on a rendered body, but the new ST-048 test covers that.
- `team-shell.spec.ts` uses `exact: true` for "Sichtung". This is right. The dashboard now has a second link, "Zur Sichtung", and the navigation test must name its own link. It does not weaken the "once per destination" check.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts page width ≤ 360. Entries use `overflow-wrap:anywhere`, a one-column layout, small buttons. | OK |
| List page fast with realistic data | yes | Three queries (`triageList`, `machineOverview` ×2) plus one `openDefectCounts` call for the not-playable machines. There is no N+1. Not-playable machines are few. | OK |
| Command writes a journal entry | n/a | The read model writes nothing. The status change is the existing command. | OK |
| Texts from message catalogs | yes | New `technicianDashboard` block in `team.de.ts`. Singular and plural are handled ("1 Meldung wartet"). It reuses `machines.statuses` and `machineRecord.changeStatus`. | OK |
| No personal data in logs | n/a | Nothing is logged. | OK |
| Role check | yes | The role is checked on the server in `page.tsx`. A helper never gets the dashboard data loaded. | OK |

UX guidelines:
- **G5**: the page leads to the triage list instead of repeating it. Each machine entry shows only the number, the title, the state and one action, "Status ändern" (the one thing people come to do). OK.
- **G6 / G6a**: counts and ages are in words ("3 Meldungen warten …, 1 davon länger als 3 Tage"). The state is named in words ("Außer Betrieb · kein offener Defekt"). OK.
- **G7**: an empty section says so in its own sentence. When both sections are empty, only "Gerade braucht nichts deine Aufmerksamkeit." is shown. Remark: this is a statement, not a call to action. That is right for a good empty state and matches the user's decision.
- **G18**: the owner story builds sections 1 and 2 in the required order, with comments that mark where sections 3 to 5 (ST-058) go. No due-maintenance list is repeated. OK.
- **G19**: the page is "Übersicht" (row 1). No navigation destination was added. OK.

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Retired machines that are Limited or Out of order | `machineOverview` excludes retired machines (`isNull(retiredAt)`), so they do not appear. A retired machine should not be offered "return to play". Not tested on the dashboard. | question: no action, the behaviour looks right |
| "Not on display" machines | The story lists only Limited and Out of order. A machine that is not on display is not offered. Nothing contradicts that. | question: confirm this is intended |
| Two technicians open the dashboard and one changes the status | The status change uses a version check (existing command). The other technician is told by the status page. | no action |
| Helper dashboard | Helpers see the placeholder "Angemeldet als" under "Übersicht" until ST-049 (user decision of 2026-10-15). | covered by ST-049 |
| The dashboard says nothing about open defects of other machines | Out of scope (ST-058). | none |
| Long museum numbers or titles at 360 px | `overflow-wrap:anywhere` is set. No test with a long title. | low priority, no story |
| Very many untriaged reports | Only a count is shown, so the page stays short. | OK |
| Playwright with the default 4 workers (2 random browser tests time out, also on `main`) | Not caused by this story. All tests pass with `--workers=2`. | outside ST-048; no new story unless it blocks CI (open question) |
| English texts | The team pages are German only (CLAUDE.md). | OK |

No finding meets the follow-up hurdle.

## Verdict
**accepted**

Remarks: none blocking. The "highlighted" scenario is met by text at section level, as decided. The status-change scenario is also covered in the browser. The e2e specs are not run on the preview until ST-068 provides an account. Local run: all green with 2 workers.

## Disposition (`/implement`, 2026-10-15)

- No gaps to fix; the questions are answered in the report itself (retired and Not-on-display machines, the 72 h boundary in the triage read model).
