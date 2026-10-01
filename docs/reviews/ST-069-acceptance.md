# Acceptance – ST-069: The acting person comes from the session in one place
Date: 2026-10-01 · Tests run: `npx vitest run --project integration src/app/_actions/current-person.integration.test.ts` → 7 passed, 0 failed (plus `tsc --noEmit` and eslint on `src/app/_actions`, `src/modules/team`: clean) · Preview: https://laguardia-n5a50lb1d-hemi6.vercel.app (not exercised; no browser test in this story)

Tech task: the checklist is the acceptance criteria. `check-scenarios.ts`: 0 scenarios, traceability OK.

## Checklist
| Item | Evidence (file) | Really checked? | Result |
|---|---|---|---|
| 1. `currentPerson()` reads the session; runner unchanged; diff = `currentPerson()` + tests + conventions | `src/app/_actions/current-person.ts`; `git diff main...HEAD -- src` touches only that file, its test, `team/login.ts` and `team/index.ts` (export of `DeactivatedAccount`). `form-runner.ts` and its lint rule untouched. | Holds with a remark: the literal wording "only `currentPerson()`" is stretched. The session lookup behind it (`team/login.ts`) had to change to expose the deactivated state. The change is small and behaviour-neutral for `loggedInTeamMember` (shared `sessionOf`/`roleOf`). Acceptable. | OK |
| 2. Helper journaled with team member ID + role helper | test 1, via `formRunner` + `currentPersonOf`, real login headers, `journalOf`, `toEqual` with literal | Yes | OK |
| 3. Technician journaled with role technician | test 2 | Yes | OK |
| 4. No session: visitor journaled; team-only command `not-authorized`, nothing stored | test 3: journal actor visitor; `createMachineModel` returns literal `not-authorized`; `machineModelsToChooseFrom` empty | Yes (stores nothing checked via read model, not via journal – the journal of a never-created aggregate has no ID to query; acceptable) | OK |
| 5. Expired / unknown / tampered cookie = no session, no leak | test 4: three variants, each journaled as visitor, and the rejection `toEqual` the no-session rejection (reveals nothing); nothing stored | Yes. Expired is built with a faked `Date` at login; the test would fail if expiry were ignored only if sessions get a past expiry, which the fake clock gives. | OK |
| 6. Role change applies to the next command without new login | test 5: `changeRole` through ST-005 interface, same headers, journal shows technician | Yes | OK |
| 7. Deactivated account: rejected, nothing stored, also visitor-allowed `CMD-ReportProblem`, login requested | test 7: account banned by SQL with session kept; the runner throws a redirect with digest to `/login`; no problem report and no journal entry; afterwards the session is ended and a report goes through as a visitor | Yes. Redirect target and "ends the session" are both asserted. Marking by raw SQL is what the story asks for ("marked deactivated in the test data"). | OK |
| 8. Forged post fields (`role`, team member ID, `actor`, `kind`) change nothing | test 6: technician-only command by helper → `not-authorized`, nothing stored; a report with forged fields journaled with the helper's own ID and role | Yes | OK |
| 9. Conventions state it | `.claude/skills/engineering-conventions/SKILL.md`: actor paragraph in "Writing a command" (reads session, role read again each command, deactivated → `DeactivatedAccount` → session ended + `/login`, system actor never from a session) and a new seam catalog row | Yes | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px / list speed | no (no UI) | – | n/a |
| Journal entry per command | yes, indirectly | actor in the journal asserted for helper, technician, visitor | OK |
| Texts from message catalogs | no new texts (redirect only) | – | n/a |
| No personal data in logs | yes | `DeactivatedAccount` message carries no name or ID; `roleOf` error carries the team member ID only (existing behaviour, an ID, not a name) | OK |
| Lint, types | yes | `tsc` and eslint clean | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Real deactivation (`deactivateAccount`, ST-005) already deletes the account's sessions, so the "banned session" branch is reached only in a race (session created between ban and delete) or after a manual DB change. The test covers the branch, but not the end-to-end path "deactivate through ST-005 → next command acts as a visitor". | Story says "after the session has ended they can report as a visitor"; the path is indirectly covered by ST-005's own tests. | question – no action; the defensive branch is correct per the task |
| Clearing the cookie while redirecting inside a real Server Action (`logOut` with `inNext: true` before `redirect("/login")`): the integration test passes headers directly and cannot see whether the browser gets the deleting `Set-Cookie`. If it is lost, the deactivated person is redirected to `/login` again on every command until the cookie expires, and cannot report as a visitor. | Story: "after the session has ended they can report as a visitor". | question / fix now if cheap: one manual or browser check on the preview with a banned-but-kept session. Not a security risk (command is rejected either way), so no new story. |
| `redirect("/login")` fires from public pages' forms (e.g. the problem report form on a visitor page) with no message explaining why. | Story only says "the login is requested". | question (UX) |
| Pages using `loggedInTeamMember` show a banned session as nobody without ending the session; only commands end it. | Consistent with ST-005 ("acts as nobody"). | question – harmless |
| Unknown role value on a user row throws a plain Error (500) from `currentPerson()`, for every command including visitor-allowed ones, for that session. | Pre-existing behaviour in `loggedInTeamMember`. | question – harmless |
| Concurrent use: role change or deactivation between `currentPerson()` and `executeCommand` of the same request. | ST-004: "applies to the next action" – one request is a unit. | no action |

No gap meets the follow-up hurdle.

## Verdict
**accepted with remarks** – all nine checklist items have real, non-tautological evidence and pass. Remarks: (a) check once on the preview that the session cookie is actually removed when a deactivated account's command is redirected to `/login`; (b) item 1's "only `currentPerson()`" is met in spirit – the Team module change in `login.ts`/`index.ts` is the minimal lookup behind it.
