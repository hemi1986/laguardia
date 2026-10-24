# Acceptance – ST-086: Helper dashboard – my claimed defects and what changed on them
Date: 2026-10-24 · Tests run: `npx vitest run --project integration "src/app/(team)/team/helper-dashboard"` → 22 passed, 0 failed (full integration project: 585 passed); `check-scenarios.ts ST-086` → 14/14 covered · Preview: none (local code and tests only)

## Scenarios
All tests in `src/app/(team)/team/helper-dashboard-changes.integration.test.ts`. They go through the real commands, a fixed clock (NOW, `hoursBefore`) and `loadHelperDashboard` plus the rendered `HelperDashboard`, in an isolated database.

| Scenario | Given/When/Then really checked? | Result |
|---|---|---|
| Helper sees that a claimed defect was taken over | Yes. Ben takes over 2 days ago via the claim command; the literal „Ben hat übernommen · vor 2 Tagen“ is asserted in section 1. | OK |
| A taken-over defect keeps section 1 and the dashboard from saying empty | Yes, with an arrangement (see below). Both empty texts are asserted absent, using the catalog literals. | OK, remark |
| Assigned to someone else | Yes. Literal „Tom hat Ben zugewiesen · vor 1 Tag“. | OK |
| A technician released her claim | Yes. The scenario gives no time; the test uses 5 hours and asserts „… aufgehoben · vor 5 Stunden“, which exercises the under-a-day wording. | OK |
| Removing the mark says why | Yes. The full literal is asserted as a whole `<li>`, so the plain release line is not an accidental match. | OK |
| Someone else resolved it | Yes. Literal „Behoben von Tom · vor 1 Tag“. | OK |
| Stays listed for 7 days | Yes. 7×24 h − 1 h is listed and 7×24 h + 1 h is not, both through real commands. The negative assertion is on the whole page, so it also proves "Display flickers" is not in section 2. | OK |
| Helper sees what changed | Yes. Work log line and title line asserted. | OK |
| Priority changes and resuming | Yes. The three lines are asserted in exact order with literal times. | OK |
| A hold is shown with its reason | Yes. Literal „Pausiert – Wartet auf Ersatzteil · vor 1 Tag“. | OK |
| Newest first, each with when | Yes. Exact adjacent `<li>` sequence. | OK |
| Changes before her claim are not listed | Yes. The title change is journaled before the claim, and the absence of „Titel geändert“ is asserted. | OK |
| No changes, no change lines | Yes. `changes: []` and the markup of the article with nothing under it. | OK |
| Her own actions never listed | Yes. Own work log and own release. It asserts `claimedByYou` equals only the slingshot with `[]` changes, and that "Rubber cracked" is absent from section 1. | OK |

### Judgement on scenario 2's extra step
The test removes the suitable-for-helpers mark one hour ago, after Ben's takeover. This is a faithful reading. The scenario's Given says "no defect suitable for helpers is open", and that cannot hold while the taken-over defect is itself still open and suitable (the user decided at the test plan that it also stays in section 2). Removing the mark is the minimal way to arrange the Given. It does not touch what the Then checks: the Ben line, the section 1 text and the dashboard text. Ben's claim is released as a side effect, but that happens after Anna lost hers and does not change her line (the code ignores events once the claim has left her). Remark: the story text could say "other than this one" to avoid the oddity. No change is required.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | Yes (ui) | Change lines are plain `<ul>/<li>` inside the existing ST-049 card article, with no new width-sensitive layout. The longest line („… nicht mehr für Helfer:innen geeignet · vor 3 Tagen“) wraps like normal text. I did not check it in a browser (no preview). | OK, to confirm on the preview |
| List pages fast with realistic data | Yes | Two journal reads. The first reads all `Claimed/Released/Resolved` entries by others in the last 7 days. The second reads the tracked events of the affected defects only, with one query for the names and one for the machine labels. See the note below. | OK, remark |
| Command writes its journal entry | n/a (read model only) | – | – |
| Texts from the message catalogs | Yes | `src/platform/messages/team/dashboard.ts` (`changes`, `changed`). Hold and priority words are reused from the existing catalogs. | OK |
| No personal data in logs | Yes | No logging added. Names are only rendered on the page. | OK |
| Critical advisories | n/a | No dependency added. | – |
| Traceability / events in code | Yes | 14/14 scenarios; the full integration project is green. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| The machine is retired and the defect is closed with it (`EVT-DefectClosedOnRetirement`) while Anna claims it. | The story lists no such change. The code drops the defect silently, with no line. | Question. Only decide if the user wants "closed with the machine's retirement" shown. Not a follow-up story. |
| Ben takes over, then Tom resolves it within the 7 days. | Not specified. The line stays „Ben hat übernommen“ (the event that made it leave her). This is consistent with "the change that made it leave". | OK as is. |
| Anna reclaims a defect that left her. | The claim resets the changes (`changes = []`) and `leftAt`, so the old lines are gone. Not specified. | Question, low. Looks sensible. |
| Anna claims, loses it, and others keep working on it. | Changes after the loss are not listed, and the story only says "the change that made it leave". | OK. |
| A team member whose name is missing, or a very long name or title. | Covered by the existing `nameOf` fallback and the ST-049 layout. | No action. |
| Many resolved defects museum-wide in the last 7 days. | `leftThem` returns true for every `EVT-DefectResolved` by someone else, because the event names no former claimant. The second query then reads the full tracked journal of each of them on every dashboard open. | Question or later optimisation. It is bounded by 7 days of resolutions and fine at museum scale. It does not meet the follow-up hurdle. |
| Release and mark removal are linked by the equal timestamp of one command (`released.at.getTime() === at.getTime()`). | This works because one command run uses one clock reading (the test shows it). It would silently show the plain release line if the two entries ever got different times. | Remark only. A short comment on the coupling would help. |
| The helper is also a technician, or the other role opens the page. | Out of scope (ST-049 owns the page). | None. |
| English UI. | Team pages are German only. | None. |
| Hour counting at the edge (23 h 59 min against 24 h). | `elapsedHours` floors it, the wording follows the user's decision, and the tests cover 3 and 5 hours. | OK. |

Follow-up hurdle: no finding meets it (nothing is a security or data-loss risk, and none blocks a named story).

## Verdict
accepted with remarks. The remarks are: confirm the 360 px layout on the preview, note the optional journal-read cost, and the optional question about the "closed on retirement" case.

## Resolution (implementer, 2026-10-24)
- Reclaiming and closing on retirement are now tested (see `ST-086-code-review.md`, finding 1 and 2) – both behave as the remarks describe: reclaiming starts the lines again (only changes since her latest claim, as the story says), a retirement removes the defect without a line (not among the story's changes).
- The same-timestamp coupling is commented at the fold (`claimed-defect-changes.ts`, „one point in time, the release journaled first“).
- 360 px: checked by the user on the preview at acceptance.
