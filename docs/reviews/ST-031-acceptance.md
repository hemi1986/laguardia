# Acceptance – ST-031: Change a defect's title or suitable-for-helpers mark
Date: 2026-10-18 · Tests run: `npm test -- -t "ST-031"` → 9 passed, 0 failed (3 files); `check-scenarios.ts` → 8/8 covered; browser test e2e/change-defect-details.spec.ts passed locally per the implementer (not re-run) · Preview: none (checked locally)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician changes the title | change-defect-details-command.integration.test.ts | Real command layer; title asserted as "Left flipper weak"; visitor page checked through `openDefectTitles` (the read model behind it), not the rendered page | pass |
| Technician marks a defect as suitable for helpers | same | Given: Anna's claim is first refused. Then: a helper claims and resolves it. Literals used | pass |
| Title is required | same | Rejected with `title-required`; title and journal unchanged | pass |
| Resolved defects cannot be changed | same | Real resolve in the Given; `defect-not-open`; nothing journaled | pass |
| Helpers cannot change defect details | same | `not-authorized` through the command layer; title unchanged | pass |
| Removing the mark releases a helper's claim | command test (journal: release, then change) and defect-details.integration.test.ts (page) | Mark removed, claim gone, both events journaled. Confirmation text "…nicht mehr für Helfer:innen geeignet. Die Übernahme von Anna ist aufgehoben." asserted on the rendered page | pass |
| The form says that removing the mark releases the helper's claim | change-defect-details.integration.test.ts | Renders the real form with the page's data; asserts the sentence naming Anna, the title hint and the submit text | pass |
| Removing the mark keeps a technician's claim | command test | Tom's claim is still there and only the change event is journaled | pass |

The e2e test also covers the whole path at 360 px: Verwalten, the link, the form with its hint, an empty title rejected with the input kept, then the confirmation. It shows both changes and the released claim.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | e2e asserts page width ≤ 360 on the form and on the confirmation | OK |
| List pages fast | no | no list page | n/a |
| Journal entry per command | yes | EVT-DefectDetailsChanged (+ EVT-DefectClaimReleased) asserted; the title is not in the journal, only the booleans and the mark | OK |
| Texts from message catalogs | yes | team.de.ts has the new keys and the `details-unchanged` error | OK |
| No personal data in logs | yes | no logging added; the title stays in the aggregate | OK |
| Advisories | not touched | no dependency change in the diff | n/a |
| User decision "unchanged is rejected" | yes | `details-unchanged` is tested in the command test, and is in events.yaml and the catalog | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| "details-unchanged" has no Gherkin scenario in the story (only an extra unnumbered test) | Per user decision 2026-10-18; the rule is in events.yaml | Add a scenario to the story text so the rule is traceable (small remark; the story is in-progress) |
| The visitor machine page is checked via `openDefectTitles`, not the rendered page | Scenario 1 says "visitor machine page shows" | Question: the read model is probably shared; fine unless the page maps titles differently |
| Two technicians editing at once | Version check (HS-16) is in the command; the form carries the version | Question: is the stale-version message shown in the form? No test seen |
| A claimant whose account is deactivated | `claimantRole` is none, so the claim is not released | Question: confirm that this is intended |
| Retired machine or defect closed on retirement | `defect-not-open` is covered by `changeDetailsRefusal`, but only the resolved case is tested | Optional extra test |
| Very long title | none (no max length, per memory) | no action |
| Helper opens the form URL directly | the page returns `whyNot: not-authorized` (tested at data level) | OK |
| Title trimmed on save; the user sees the trimmed title | implemented | OK |

Verdict: **accepted with remarks** (no failing test, no violated rule; the remarks are the missing scenario for the user-decided "unchanged" rejection, and the visitor page assertion being at read-model level).

## Resolution (2026-10-18)
- Remark 1 (no scenario for `details-unchanged`): kept as a rule on CMD-ChangeDefectDetails in `events.yaml` with its command test; adding a scenario would be a story change through discovery – not done.
- Remark 2 (`openDefectTitles` instead of the rendered page): the read model behind the visitor machine page is the agreed seam, as in ST-030.
- Deactivated claimant: changed after the code review (#1) – a deactivated helper's claim is released too.
- Closed on retirement: the state arrives with ST-039 and cannot be set up yet.
