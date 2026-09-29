# Acceptance – ST-073: Server Action runner – the one way from a form to a command
Date: 2026-09-29 · Tests run: `node .claude/skills/implement/scripts/verify.ts --e2e` (run twice) → vitest 25 files / 154 tests passed; Playwright 19 passed; lint, boundaries, types, traceability OK · Preview: none (Vercel MCP not enabled; browser tests ran locally)

Tech task without Gherkin scenarios (check-scenarios: 0/0, OK). The checklist items take the place of the scenarios.

## Checklist (evidence)
| Checklist item | Test / evidence | Really checked? | Result |
|---|---|---|---|
| Problem report form runs CMD-ReportProblem through the runner; report is stored and listed | `e2e/report-problem.spec.ts` (happy path, unchanged assertions) + `report-problem-form.tsx` and `actions.ts` use `formAction` | Yes: submit, report text visible in the list | OK |
| Rejection shows the `description-required` text and keeps input, 360 px | `e2e/report-problem.spec.ts` "only spaces … 360 px" | Yes: literal "Bitte beschreibe das Problem." (literal), value "   " kept, alert in viewport, width ≤ 360 | OK |
| Same without JavaScript | `e2e/report-problem.spec.ts` "with JavaScript disabled" | Yes: literal text, kept value, width | OK |
| Result `{ error, values }`; not-authorized / not-found / version-conflict have texts; every error of the command has a text | `command-errors.test.ts`, `form-runner.integration.test.ts` (1st test) | Yes: de and en, four codes; `CommandError<…>` type test ties the command's errors to the catalogue | OK |
| Runner has no actor/role/ID parameter; person only from `currentPerson()`; visitor in journal | `form-runner.integration.test.ts` ("has no parameter" with `@ts-expect-error`, "runs the command as the person currentPerson() gives" reads the journal actor) | Yes. Note: the real `formAction` (bound to the session) is not itself exercised by a test that reads the journal, except via e2e (which does not check the actor). Story accepts "the acting person it is given". | OK |
| `executeCommand` outside `_actions/` fails verify with a message naming the runner | `module-boundaries.test.ts` (alias, relative path, runner, test file, other names) | Yes; message contains `src/app/_actions/` | OK |
| Forged `actor`/`role`/`teamMemberId` ignored | `form-runner.integration.test.ts` (3rd test) | Yes: journal actor stays visitor; only declared fields come back | OK |
| Typed input function per action; missing field is an empty value, no exception | `report-problem-input.test.ts` | Yes | OK |
| Non-free-text stand-in (enum + ID): "no value given", decision rejects, code has a text | `stand-in-input.test.ts`, integration test 4 | Yes: `undefined` for both, `machine-required` with catalogue text | OK |
| Conventions state the empty-field rule (ST-007 example) | `.claude/skills/engineering-conventions/SKILL.md` diff (+50 lines) | Present in diff; not re-read in depth | OK |
| Runner in `src/app/_actions/`, part of the app element | `module-boundaries.test.ts` "treat the runner as part of the app element" | Yes, both directions | OK |
| 360 px | e2e (both rejection tests and the happy path) | Yes | OK |
| Converts existing code, no test weakened, `verify --e2e` green | Green. `git diff main...HEAD` on `*.test.ts`/`*.spec.ts`: the only removed lines are the old e2e test title and its inline `scrollWidth` line, replaced by the helper `pageWidth` with the same assertion and the same title kept in the happy-path test (title line is re-added identically after the `enterSpike` helper) | No assertion dropped | OK |
| Conventions update (SKILL.md) x2 | Unticked on purpose, awaiting user approval | – | Pending (user) |
| Typed acting person (type test) | `actor-types.test.ts`: team-only gets team member with `TeamMemberId` and `Role`; visitor-allowing gets the union; mismatch is a type error | Yes | OK |
| `Role`/`Reporter` defined once, checked in verify | ESLint `no-restricted-syntax` + `module-boundaries.test.ts` (duplicate rejected, home allowed); `Role` in builders.ts now imported | Yes | OK |
| `problem-reports.integration.test.ts` sets up through `executeCommand(reportProblemCommand)` | File already does (unchanged vs main; only `executeCommand` used, no persistence calls) | Yes | OK |
| Every existing assertion still asserted | see "no test weakened" above | Yes | OK |
| Reworded item: acting person only via `currentPerson()` (user decision 2026-09-29) | `members/actions.ts` now uses `currentPerson` from `_actions`; `actingPerson()` removed from `team-session.ts` | Yes | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | Yes | e2e width assertions, alert in viewport | OK |
| List pages fast with realistic data | No (no new list) | – | n/a |
| Every command writes its journal entry | Yes (unchanged command layer) | Integration test reads journal actor | OK |
| Texts from the message catalogs | Yes | `commandErrors` in `visitor.de.ts` / `visitor.en.ts`; form uses `commandErrorText`; old `descriptionRequired` removed with no remaining users | OK |
| No personal data in logs | Yes | Description text is not journaled or logged by the new code; `values` go only back to the client | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Visitor page in English: the spike form is hard-wired to the German catalogue in the e2e; the English texts are unit-tested only, not shown in a browser | Visitor pages are DE and EN (CLAUDE.md), but the spike page has no locale switch | Question, decide with the first real visitor form (no new story) |
| Team-only pages: the catalogue used for `not-authorized` etc. is `visitorMessages`; the runner offers no `teamMessages` helper yet, and `commandErrorText` takes `VisitorMessages` only. ST-007 (first team form) will need it | Story Q9 names `teamMessages`; no scenario | Question / fix in ST-007 (small, within one hour, existing story can take it). Not a follow-up |
| Error text for `machine-required` exists in the visitor catalogue, but it belongs to the test stand-in only (no real command uses it) | – | Remark: harmless unused text; remove or keep when ST-007 lands |
| `version-conflict` on a form: the state keeps the typed values, but the text says "reload the page", which would lose the input. The story fixes no behaviour | No | Question for ST-007 or the first form with a version check |
| Double submit: `pending` disables the button with JS; without JS nothing prevents a double post (two reports) | No rule | Question, low risk |
| Forged post: unknown fields are dropped; a forged non-string (file) for `description` becomes "no value given" and is rejected. Not tested with a file part | No | Optional test, not required |
| Real `formAction` bound to `currentPerson()` with a logged-in team member is not tested end to end (the e2e report is made as a visitor; the journal actor is not checked) | Checklist item asks for the runner "with the acting person it is given" – satisfied | Remark; ST-069 changes `currentPerson()` and adds session tests |
| A team member deactivated during a session still acts as a visitor here | Explicitly ST-069 | Out of scope |
| `formRunner` is exported and only lint-protected; the ESLint rule is the only barrier (dynamic `import()` or a `require` would not be caught) | Story: "cannot call `executeCommand`" via verify | Remark; ESM with TypeScript makes it unlikely; no story |

## Verdict
**accepted with remarks**

All checked items have real, literal-value tests and everything is green (154 unit/integration, 19 browser tests, `verify --e2e`). Remarks: (1) the two SKILL.md items stay open until the user approves the engineering-conventions update; (2) `commandErrorText` is visitor-only, so ST-007 has to add the team-catalogue variant (fixable inside ST-007); (3) the real session-bound `formAction` is only covered indirectly. No gap meets the follow-up hurdle, so no new story is proposed.
