# Acceptance – ST-049: Helper dashboard – sections, landing after login and the empty case
Date: 2026-10-24 · Tests run: `npm test -- -t "ST-049"` → 6 passed, 0 failed (scenario 4 is a browser test, not run by me; the caller reports a green full `verify.ts --e2e`: 910 unit/integration, 173 browser) · Preview: https://laguardia-j9lsgoo03-hemi6.vercel.app (not exercised; the browser test needs a local technician account)

Traceability: `check-scenarios.ts ST-049` → 7/7 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Helper sees open defects suitable for helpers | helper-dashboard.integration.test.ts | Given: two real defects via `reportProblemAndTriageCommand`. When: `loadHelperDashboard` plus render of `HelperDashboard`, the same pair `page.tsx` uses. Then: asserts section 2 data is exactly ["Rubber cracked"] and the HTML omits "Display flickers". The HTML check for "Rubber cracked" is not tied to a section, but the data assertion covers that. | pass |
| Helper sees her claimed defects first | same | Anna really claims (version 0). Then: heading "Von dir übernommen" comes before the title, and the title before the "Für Helfer:innen geeignet" heading. Title appears exactly once (decision 1). "LG-042 · Medieval Madness" is asserted. "As claimed by her" is implied by the section heading. | pass |
| Helper sees due maintenance tasks suitable for helpers as counts | same | 3 machines, 1 registered before the start date so it is overdue. The fixed clock is used. Literals: 3 / 1, the German sentence, the non-suitable task absent, and a link to `/team/maintenance?helpers=1` (decision 2). The target does honour `helpers=1` (`due-maintenance-data.ts:72`). | pass |
| A helper lands on their dashboard after logging in | e2e/helper-dashboard.spec.ts | Real helper account, real login. URL is `/team`, h1 "Übersicht", and the helper-dashboard text is present. Local only. Assertion is an either/or (empty-section text or "nothing open") because other tests' defects may exist. 360 px width is also checked. | pass (per caller's run) |
| Nothing is open for a helper | integration | Isolated DB. The distractors are a defect not suitable for helpers and a task not yet due. Then: html equals exactly `<p>Gerade ist nichts für dich offen.</p>`, which is "only". | pass |
| An empty section says so next to a filled one | integration | Asserts the sentence for section 1, the order of the section 2 heading and the title, and the empty section 3 text with no link. | pass |
| Resolved defects leave the dashboard | integration | The defect is claimed, then resolved with the real `resolveDefectCommand`. Both sections are empty and the HTML lacks the title. A before-check shows the defect was there. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e checks `pageWidth <= 360`. Lists use `overflow-wrap:anywhere`. Only the empty or new-helper state is measured, not a filled dashboard with long titles. | OK (see remarks) |
| List pages fast with realistic data | partly | The data is three parallel queries plus `shownOpenDefects`. No limit on section length. Not measured. | OK, no evidence |
| Every command writes its journal entry | no | Read model only, no command. | n/a |
| Texts from message catalogs | yes | `messages/team/dashboard.ts`. Old `start`/`loggedInAs` removed and no leftover references (grep). | OK |
| No personal data in logs | yes | No logging added. | OK |
| Advisories | n/a | No dependency change. | n/a |
| ST-048 test change | yes | Only the one line changed, as decided. Negative assertions are unchanged. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| A defect claimed by another person and suitable for helpers stays in section 2 (decision 1) | Decision 1 of the test plan; no test pins it | Optional: add an assertion in this story. Not a gap against the scenarios. |
| A claimed defect that is not suitable for helpers appears in section 1 | Story: section 1 = "defects the helper claims right now" | Behaviour looks right (the claim query ignores suitability). Untested, optional line. |
| Machine not on display or retired with an open defect | None in this story | Question: shown the same as any other machine? Fine for now. |
| Long defect or task titles, filled dashboard at 360 px | DoD | Optional: a filled-state width check, if cheap. |
| Many suitable defects (long section) | None | Question: no cap or pagination. Accept for now. |
| A technician-only user in `?helpers=1` view | n/a | The maintenance list filters; a helper may open it (ST-043). OK. |
| English texts | UI of team pages is German only | n/a |
| Section 3 with a task due on all machines and overdue everywhere | Wording logic in `due()` ("– an allen überfällig", "– überfällig") | Pure wording variants without a test; only the 3/1 case is asserted. Optional unit test. |

No finding meets the follow-up hurdle.

## Verdict
**accepted with remarks.** All 7 scenarios have real tests that check Given, When and Then, and all pass. Remarks, none blocking:
- The `due()` wording branches (all overdue, single machine) are untested.
- Decision 1's "claimed by others stays in section 2" is not pinned by a test.
- Scenario 4's e2e assertion is an either/or on two texts. I did not run it myself; it relies on your green `verify.ts --e2e`.
- The preview was not exercised.
