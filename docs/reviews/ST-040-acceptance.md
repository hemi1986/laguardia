# Acceptance – ST-040: Maintenance plan – view and add maintenance tasks
Date: 2026-10-15 · Tests run: `npm test -- -t "ST-040"` → 10 passed, 0 failed (2 files); `npx playwright test e2e/maintenance-plan.spec.ts --workers=2` → 3 passed; `check-scenarios.ts ST-040` → 9/9 covered · Preview: https://laguardia-rekmby4hs-hemi6.vercel.app (not exercised – team pages need an account; e2e ran locally)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician adds a maintenance task | change-maintenance-plan-command.integration.test.ts | Real command layer, technician actor, literal values (1 month, Pinball, 2026-10-01). Asserts the listing (instruction, interval, helpers mark, category) and firstDue "2026-11-01" as literals; journal entry checked, no typed text in it. The page rendering of the same is in maintenance-plan.integration.test.ts and e2e. | pass |
| Restriction to machine category and technology | same | Stores Pinball/EM; `maintenanceTaskAppliesTo` asserted true for Pinball/EM and false for four other models. | pass |
| Restriction must fit (outline, 2 examples) | change-maintenance-plan.test.ts (`it.each`) | Both examples as literals, expects `technology-does-not-fit-machine-category`. Tested at the decision (seam catalog), not through the command; the form-level rejection is covered in the e2e no-JS test. | pass |
| Technology restriction needs a machine category | change-maintenance-plan.test.ts | LCD without category → `technology-without-machine-category`; also through the form runner. | pass |
| Interval must be positive | change-maintenance-plan.test.ts | 0, -3 and missing all rejected; form variants (empty, "1.5") covered at the runner. | pass |
| Instruction is required | change-maintenance-plan.test.ts | Blank instruction rejected. | pass |
| Month-end start date | command integration test | 1 month, 2026-01-31 → firstDue literal "2026-02-28". | pass |
| Start date is required | change-maintenance-plan.test.ts | Missing start date rejected; also wrong format via the form. | pass |
| Helpers cannot change the maintenance plan | command integration test (+ runner test, e2e) | Helper actor → `not-authorized`; the task is absent and the plan version is unchanged. Forged role field is ignored; the e2e checks no nav link and a redirect from `/new`. | pass |

Remark: "rejected" in the decision tests means `ok:false` with an error code. "Nothing is stored" is asserted only for the helper scenario, which is enough because the decision returns no state on rejection.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts `pageWidth <= 360` on the form and on the plan; long text wraps via `overflow-wrap:anywhere` | OK |
| List page fast with realistic data | yes | One version query plus one entity load; about 19 tasks at go-live, no N+1 | OK |
| Command writes its journal entry | yes | `EVT-MaintenancePlanChanged` with `maintenanceTaskId`, `change`, actor; asserted | OK |
| Texts from message catalogs | yes | `teamMessages.maintenancePlan`, error texts in team.de.ts; no hard-coded German in components | OK |
| No personal data in logs/journal | yes | The journal carries IDs only; the test asserts the instruction text is absent | OK |
| Works without JavaScript | yes (ux guideline) | No-JS e2e: rejection keeps input, `aria-invalid`, retry succeeds | OK |
| Roles | yes | `requireTechnician` on the pages and the action; the command's `allowedActors` is the real gate | OK |
| Event/command IDs, traceability | yes | `check-scenarios` OK | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Two technicians add at the same time | HS-16 versioning; covered by the "version-conflict" test and the catalog text | covered, no action |
| Very long name or instruction | none in the story; the layout wraps (360 px) but there is no length limit | question (low) |
| Start date in the future or far past (e.g. year 1900) | none | question: should an obviously wrong date be rejected? |
| Very large interval (e.g. 1200 months) | none; "positive" only | question (low) |
| Duplicate names | none; allowed | question: is a repeated name intended? |
| Plan with removed tasks | RM lists only non-removed; ST-041 | covered by ST-041 |
| Task for a machine in "Not on display" or retired | belongs to the due list (ST-043) | ST-043 |
| English language | team pages are German only | no issue |
| Plan page shown with `?added=` of an unknown ID | no confirmation, no error | fine |

## Verdict
accepted

No finding reaches the follow-up hurdle. The remarks are open questions on input bounds (name/instruction length, date plausibility, maximum interval) for the product owner. No fix is needed in this story.

## Disposition (`/implement`, 2026-10-15)

- Lengths of name and instruction, plausible start dates, very long intervals, duplicate names: product questions – put to the user at acceptance. Technical limits that keep due dates computable were added (interval ≤ 1200 months, start date 1900–2999; code review #1).
- The outline's rejections are asserted at the decision (seam catalog: many cases); the form-level rejection is in the browser test without JavaScript – as intended.
