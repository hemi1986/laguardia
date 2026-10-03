# Acceptance – ST-012: Change the machine status
Date: 2026-10-03 · Tests run: `npx vitest run -t "ST-012"` → 5 passed (2 files); `npx vitest run` of the command, visitor-page and history test files → 10 passed; `npx playwright test e2e/change-machine-status.spec.ts` → 4 passed (local); `check-scenarios.ts ST-012` → 8/8 covered · Preview: https://laguardia-77ln4te6s-hemi6.vercel.app (not opened – team pages need a team account; no visitor-facing change except the status shown, covered by an integration test)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician changes the machine status | `change-machine-status-command.integration.test.ts` | Given: machine registered Playable. When: through `executeCommand` with a technician. Then: literals "limited", history entry (Playable → Limited, reason, technician, fixed time), journal entry without the reason. Fully asserted. | pass |
| Helper takes an unsafe machine out of play | `src/app/m/[museumNumber]/visitor-machine-page.integration.test.ts` | Given Playable, helper sets Out of order with the reason from the scenario; asserts command result `out-of-order` and the rendered visitor page contains "Status: Außer Betrieb". Does not read the machine record or history for the helper's entry, but both Then lines are covered. | pass |
| Helpers can only set Out of order (outline) | `change-machine-status-command.integration.test.ts` | All three examples looped; asserts rejection `helpers-only-out-of-order`, status stays out-of-order after each, journal still only the registration. The loop reuses `version: 0`, which is right because nothing changes. | pass |
| A reason is required | same | Empty and whitespace-only reason; asserts `reason-required` and history unchanged. | pass |
| Retired machines cannot change status | same | Machine retired through the test-support command, then the change at version 1; asserts `machine-retired`, history unchanged. | pass |
| A helper is offered only Außer Betrieb | `e2e/change-machine-status.spec.ts` | Real helper account created through the team page, logs in, reaches the form via the "Status ändern" link; asserts the only option is Außer Betrieb (preselected), the reason field is there, width at most 360 px. | pass |
| A rejected status change keeps what was chosen | e2e | Technician chooses Limited without reason, submits; asserts the alert text, `aria-invalid` on the reason field, and "limited" still selected. The no-JavaScript variant covers the same without scripts. | pass |
| After the change the team member sees the machine | e2e | Submits Limited with "left flipper weak"; asserts redirect to the machine record, the confirmation "LG-nnn ist jetzt Eingeschränkt.", status Eingeschränkt, history entry and reason. | pass |
| Foundation: insert-only helper (stand-in) | `src/platform/command/history.integration.test.ts` | Not re-read in depth. It runs and passes. | pass |
| Foundation: status history through the helper | `change-machine-status-command.integration.test.ts` | A trigger refuses every UPDATE of `machine_status_change`; two changes leave entries in the expected order, the first equal to before. | pass |
| Foundation: conventions update (third checklist item) | `.claude/skills/engineering-conventions/SKILL.md` | The text is written (histories section and "a form on an existing aggregate"). The item is correctly unticked until the user approves it. | open (by design) |

Extra tests beyond the scenarios: status not chosen and status unchanged are rejected (command level, no `ST-012:` title – fine).

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | The three UI e2e tests assert `scrollWidth <= 360`. | yes |
| List pages fast with realistic data | no | No list page changed. The machine record loads one history list. | n/a |
| Every command writes its journal entry | yes | The journal entry `EVT-MachineStatusChanged` is asserted in the technician test. A rejection writes none (helper outline asserts 1 entry). | yes |
| Texts from the message catalogs | yes | `team.de.ts` holds all new German texts and the four error texts. | yes |
| No personal data in logs / journal | yes | The journal carries only the two statuses. The reason, free text, stays in the history, and a test asserts the journal content. | yes |
| Role check | yes | `allowedActors` is helper and technician. The role rule is in the decision. | yes |
| Works without JavaScript | yes (ST-073 convention) | The e2e test without JavaScript passes. | yes |
| Traceability | yes | 8/8 scenarios are covered. The journal entry carries the ID `EVT-MachineStatusChanged`. | yes |

## Edge cases not covered by the story
Nothing found contradicts a rule in the story. Nothing meets the follow-up hurdle (none is a security or data-loss risk or blocks a named story).

| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| The "Status ändern" action is hidden for a retired machine, and for a helper on a machine already Out of order (decided in Context, G11). No test asserts either. The status page for a retired or unknown number (own text) is also untested. | Yes – Context, "The action is not shown for a retired machine"; "a helper does not see the action on a machine that is already Out of order". | Fix now (small): add a rendering test of `MachineRecordView`/page logic for both hidden cases. They are stated decisions without a test. Not a scenario, so no blocker. |
| Concurrent change: two team members open the form, one saves, the other submits with the old version. The command layer returns `version-conflict` and the catalog has a text for it. The form posts the stale version again after a rejection, so a retry without reload fails again, and the message says to reload. No form-level test. | Partly – HS-16 version handling, the conventions note "keeps posting the version the page loaded". | Question for the user: accept (message says to reload), or a test of the conflict path through the form. |
| The confirmation is driven by `?statusChanged=1`. Anyone can add it to a URL, and a reload after a change shows the confirmation again. The text names the machine's current status, not the status that was set. | No rule. | Question, low value. Fine for now. |
| A helper opens the status page by URL for a machine that is already Out of order: the form offers Außer Betrieb, and submitting is rejected with "Das Gerät hat diesen Status schon." | Yes – the Context decision (rejected, no history entry). | Accepted. A clearer message for this case could come later. |
| A very long reason, or a reason with only special characters. There is no length limit, and the history list wraps text (`overflow-wrap:anywhere`). | No rule. | Question: does a reason need a maximum length? |
| Visitor page after Not on display or Out of order: the visitor page shows the status (tested for Out of order). Whether Not on display should hide the page for visitors is not in this story. | Not here. | Question for the visitor stories. |
| English texts: the team area is German only. | Yes – CLAUDE.md, only visitor pages are bilingual. | None. |

Remarks on the process:
- The preview could not be checked (no team account before ST-068); the visitor effect is covered by an integration test.
- The foundation checklist item 3 stays unticked until the user approves the conventions text, so the story cannot go `done` before that.

## Verdict
**accepted with remarks** – every scenario has a real test whose Given, When and Then are checked with literals, all tests pass, and the definition of done holds. Remarks: no test for the hidden "Status ändern" action (retired machine, helper on an Out of order machine) and for the retired-machine status page, which are decisions in the story; open questions on the form-level version conflict and a maximum reason length; the conventions item awaits the user's approval.

## Resolution (main session, 2026-10-03)
- Hidden "Status ändern": the rule now lives in `machineStatusesToChangeTo` with a table test (retired, helper on Out of order). The pages only render its result – no separate page rendering test (skipped minor: the branches are a direct read of the tested list).
- Form-level version conflict: skipped minor – the layer's conflict path is tested (`problem-report-version.integration.test.ts`), the convention now says the person reloads. Questions on a maximum reason length and the URL-driven confirmation go to the user with the pull request.
