# Acceptance – ST-027: Prioritize a defect
Date: 2026-10-14 · Tests run: `npm test -- -t "ST-027|G22|CMD-PrioritizeDefect|prioritize"` → 10 passed, 0 failed (4 files); `npm run test:e2e -- e2e/prioritize-defect.spec.ts --workers=1` → 1 passed · Preview: https://laguardia-r70uu6sd9-hemi6.vercel.app (not exercised: no e2e account there)

check-scenarios.ts: 4/4 scenarios covered, traceability OK.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician raises the priority | `prioritize-defect-command.integration.test.ts` | Given: open defect "Display flickers" at default normal, asserted before. When: `executeCommand(prioritizeDefectCommand)` as technician. Then: priority is "high", `openDefects(priority: high)` lists it, normal list is empty, journal entry EVT-DefectPrioritized with actor and `{priority:"high"}`. All literals. UI path additionally in `e2e/prioritize-defect.spec.ts`. | pass |
| Filter by priority | `open-defects.integration.test.ts` | Given: two defects, high and low, set via the real command. When: `loadOpenDefects` with priority high, and the rendered page. Then: only "Display flickers" in entries and in the HTML, "Rubber cracked" absent. | pass |
| Resolved defects cannot be prioritized | `prioritize-defect-command.integration.test.ts` | Given: defect really resolved via `resolveDefectCommand`. Then: `defect-not-open`, priority still normal, journal length unchanged. | pass |
| Helpers cannot prioritize | `prioritize-defect-command.integration.test.ts` | Helper actor gets `not-authorized`, priority unchanged, no journal entry. The page hiding the control for helpers is in the supporting page tests. | pass |

Supporting (not required): same priority → `priority-unchanged`, none chosen → `priority-required`, stale version → `version-conflict`; form page tests; the "G22" block in `defect-details.integration.test.ts`; the e2e at 360 px (priority option list "Bitte wählen / hoch / niedrig", confirmation text, list filter).

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts page width ≤ 360 on the form page and defect page; passes locally | OK |
| List pages fast with realistic data | marginal (filter only) | Filter is a query on the existing open-defects list; no separate performance test seen | OK (remark: not measured) |
| Command writes its journal entry | yes | Journal asserted for success; none written on rejections | OK |
| Texts from message catalogs | yes | Page uses `teamMessages` (`defects`, `recordDefect.priorities`) | OK |
| No personal data in logs/journal | yes | Journal data holds only `{priority}`; the actor is the acting person | OK |
| Concurrency (HS-16 version) | yes | version-conflict tested | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Defect closed on retirement | Story context: "not resolved (and not closed on retirement)"; the decision refuses every non-open state as `defect-not-open`, but only "resolved" has a test | Fix now, optional: one test for a retired-machine defect (small) |
| Helper filters the list by priority | Scenario says "a team member"; the test uses a technician | Question / low risk; the filter has no role check seen |
| Helper opening the form URL directly | Rule: technicians only; page shows `whyNot` instead of the form (supporting tests) | Covered, no action |
| Two technicians setting the same priority at once | Version conflict handles it (tested) | Covered |
| Offering only the other priorities (user decision) | Agreed with user; e2e asserts options | Covered; remark: the story text doesn't mention `priority-unchanged`, consider noting it in the story's Context |
| English/visitor view | Team pages are German only | No issue |
| Playwright flakiness with 4 workers (2 timeouts, also on `main`) | Not a story rule | Question: existing infrastructure issue, outside this story; not a hurdle-passing finding |
| Preview verification of team pages | No e2e account on preview until ST-068 | Known limitation, verified locally only |

## Verdict
accepted with remarks. All 4 scenarios have real, passing tests; no rule is violated. Remarks: (1) no test for a defect closed on retirement (the code covers it through `state !== "open"`), (2) the filter scenario is tested as a technician only, (3) `priority-unchanged` could be recorded in the story context, (4) team-page browser test ran locally only, the preview wasn't exercised. None passes the follow-up hurdle; all can be fixed in this story.

## Disposition (`/implement`, 2026-10-14)

- **1 skipped – revisit in ST-039**: no command can close a defect on retirement yet, so the state cannot be arranged through the commands (Q3); the rule is covered by `state !== "open"` and ST-039 adds the test with the first closed defect.
- **2 skipped**: RM-OpenDefects takes no acting person – the list and its filter are the same for every team member, so a helper's run would test nothing new.
- **3 fixed** – the rules of `CMD-PrioritizeDefect`, including `priority-unchanged`, are listed in `docs/domain/events.yaml`.
- **4** – the preview is checked by the user at acceptance; the team-page browser tests run locally until ST-068.
