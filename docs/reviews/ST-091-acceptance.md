# Acceptance – ST-091: Headings, buttons and instructions say the job in one pattern
Date: 2026-10-30 · Tests run: `npx vitest run -t "ST-091"` → 4 passed (unit 1, integration 3); `npx playwright test e2e/job-first.spec.ts` → 5 passed; `check-scenarios.ts ST-091` → 10/10 covered · Preview: none (team specs would skip there)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| 1 Form pages of a machine name the job first | `e2e/job-first.spec.ts` | Real machine; opens all six form addresses; level-1 heading compared with literal texts (only the number is dynamic). 360 px width also checked | OK |
| 2 Question before removing a file | `e2e/remove-file.spec.ts` | Machine with file "Manual", clicks the real „entfernen“ link, heading literal. Needs Blob upload, so it cannot run locally (quota until 2026-11-27) | OK by reading; not run (environment) – see remarks |
| 3 Maintenance task and model change forms | `e2e/job-first.spec.ts` | Task created through the form, model reached via the list and „Modell korrigieren“ link; both headings asserted | OK |
| 4 Recording for several machines | `e2e/job-first.spec.ts` | Task with two machines, page opened at the address the button has (documented deviation, precedent `due-maintenance.spec.ts`); heading literal. The button's own link is not clicked here | OK (remark) |
| 5 Buttons say what they do | `e2e/job-first.spec.ts` | Password page (sole button), task change form, retire form (sole button) and that it leads to „Endgültig ausmustern“; the old name is asserted absent | OK |
| 6 No vague button texts | `src/platform/messages/messages.test.ts` | Scans every string of the team catalog for the three exact texts; sanity-checks that `ownPassword.submit` is scanned | OK |
| 7 „Endgültig entfernen“ | `e2e/job-first.spec.ts` | Real flow; asserts exactly the buttons „Endgültig entfernen“, „Zurück“, then carries it out | OK |
| 8 Version conflict in the infinitive | `src/modules/repair/claim-defect-concurrency.integration.test.ts` | Two actors, same version 0; second claim rejected with `version-conflict`; literal text via the catalog. "Typed input unchanged" is covered by the existing e2e (`claim-defect.spec.ts`, text updated) and the claim being a one-tap button | OK |
| 9 Status hint when linking | `.../triage/[problemReportId]/problem-report.integration.test.ts` | Open defect plus recently resolved one (amended Given, approved 2026-10-30); renders the real link form and reads the `machineStatus-hint` element; literal text | OK |
| 10 Status rejection when linking | `.../verknuepfen/link-to-defect-rejection.integration.test.ts` | Open defect only; goes through `formRunner` with the real command; error code, literal text and kept values asserted | OK |

Changed existing tests (diff checked): only the old text replaced by the new one (headings, button names, „Entfernen“ → „Endgültig entfernen“, the conflict text); no assertion removed or loosened. The `claim-defect-concurrency` refactor only extracted helpers.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | Yes (headings longer) | Width assertions in scenarios 1, 3, 4 | OK |
| List pages fast | No | no list changed | n/a |
| Journal entry per command | No | no command changed | n/a |
| Texts from the catalogs | Yes | all changes in `src/platform/messages/team/*`; pages use the catalog functions | OK |
| No personal data in logs | No | nothing logged | n/a |
| Advisories | No | no dependency change | n/a |
| Conventions (shared page frames, domain language) | Yes | Pages still use `<Page title=…>`; wording follows CONTEXT.md (Not on display, maintenance task) | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| `forms.conflict` („Deine Eingabe ist noch da – bitte noch einmal senden.“) still in *du* in the team catalog | G13 (team instructions in the infinitive); the story names only the three texts, Out of Scope does not list it | Remark: sits in the same flow as the conflict text just changed, but a rewrite is a one-line catalog change. Fix now if the user wishes, else a later text pass; not a new story (fails the follow-up hurdle) |
| Long task name in the heading „Wartungsaufgabe ändern · <name>“ / „Wartung erfassen · <name>“ at 360 px | G1 | Question; width asserted only with ordinary names |
| `mehrere` page without valid task falls back to `recordMaintenance.record` heading | none | Question; harmless |
| English / visitor pages | story: visitor keeps *du* | None |
| Aria-label of the plan's „Ändern“ link stays „„X“ ändern“ (intentional) | story context | None |
| Dashboard texts still *du* | G13 allows it | None |

## Minors (conventions, light lane)
- Scenario 4 does not click the „Für mehrere Geräte erfassen“ button itself (documented, precedent exists).
- Scenario 2 has no local evidence run; CI with a working Blob store should run it.

## Verdict
**accepted with remarks** – all 10 scenarios have a real test that asserts the literal texts; the story's tests ran green. Remarks: scenario 2 was not executed locally (Blob quota, environment; test read and sound), and `forms.conflict` still speaks *du* (recommend rewriting it as a small follow-up text change, e.g. „Deine Eingabe ist noch da“ → infinitive wording, decided by the user).
