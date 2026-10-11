# Acceptance – ST-028: Resolve a defect with a closing note
Date: 2026-10-11 · Tests run: `npx vitest run src/modules/repair "src/app/(team)/team/defects"` → 24 files, 172 passed, 0 failed · `check-scenarios.ts ST-028`: 6/6 covered · Browser test `e2e/resolve-defect.spec.ts` read, not rerun (local only; verify was green before the push) · Preview: not exercised (deployment protection, no team account on the preview database)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician resolves a defect | `resolve-defect-command.integration.test.ts` | Given: defect recorded through the real triage command, claimed by Tom through the real claim command. When: `resolveDefectCommand` with the literal note (surrounding blanks trimmed). Then: result, state `resolved`, note/resolvedBy/resolvedAt as literals, `claim` undefined, `openDefects` empty and `openDefectTitles` (the visitor machine page's read) empty, journal entry with actor, machineId and `resolvedBy` only (no free text). All lines asserted. "Visitor machine page" is checked at the read-model seam, not rendered – acceptable. | pass |
| Helper resolves a defect suitable for helpers | same file | Given: suitable for helpers. When: Anna resolves without having claimed. Then: resolved by Anna, note, gone from the open list, journal. Complete. | pass |
| Helpers cannot resolve defects not suitable for helpers | same file | Rejected with `not-suitable-for-helpers`; state still open, no resolution, still listed (list and visitor read), journal empty. Complete. | pass |
| A closing note is required | same file | Empty and whitespace-only note both give `closing-note-required`; defect open, listed, journal empty. Complete (whitespace case covered). | pass |
| A resolved defect cannot be resolved again | same file | Given: resolved by real command. Tom and Anna both rejected `defect-not-open`; original resolution and journal unchanged. Complete. | pass |
| Machine status stays unchanged | same file | Given: machine registered Out of order, only open defect (asserted before). When: resolve. Then: defect gone from open list, `machineForReporting` still `out-of-order`, and the machine journal since the first call gained only `EVT-DefectResolved` (no status change). Strong; the "only open defect" Given is really set up. | pass |

Additional tests read: `defect-details.integration.test.ts` ("resolving it"), `beheben/resolve-defect-rejection.integration.test.ts` (kept note, catalog text, actor from session, version conflict), `e2e/resolve-defect.spec.ts` (incl. a without-JavaScript variant). The "Then" lines are not asserted a second time in the UI, which is fine.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Scenario tests titled exactly, verify green | yes | check-scenarios 6/6; vitest 172 passed; verify reported green by the implementer | OK |
| Command via `aggregateCommand`, ID from events.yaml, journal without free text | yes | `resolve-defect-command.ts`; journal `data: { resolvedBy }`, the test asserts that | OK |
| No `new Date()` / `randomUUID()` in domain code | yes | `resolve-defect.ts` uses `clock.now()` and `newId()` | OK |
| Server Action only via `formAction`, actor from the session | yes | `actions.ts` uses `formAction`; the rejection test posts a foreign resolver and expects the signed-in one | OK |
| Texts from the catalogs | yes | `team.de.ts`: button, title, submit, confirmation, error, "Closing note" term. `CONTEXT.md` gets the term | OK |
| Only `index.ts` imported across modules | yes | page code imports `@/modules/repair` | OK |
| Migration generated and committed | yes | `0016_defect_resolution.sql`, snapshot and journal; hand-written FK to team_member documented | OK |
| Usable at 360 px | yes | e2e spec (not rerun by me); form is a single textarea and button on its own page (G21) | OK (taken from the spec) |
| Lists fast | partly | Open defects list is unchanged except for the resolutions join; no concern | OK |
| Journal entry per command | yes | asserted; rejected resolves leave the journal empty | OK |
| No personal data in logs | yes | closing note is kept out of the journal | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Closing note of only whitespace | Rule "closing note is required"; trimmed in `resolveDefect`, tested | covered, no action |
| Very long closing note | No limit in the story or in the data model (`text` column); no maximum length in the form or command | question: should the closing note have a maximum length (like other free-text fields)? Minor |
| Resolving a defect closed on retirement | AGG-Defect invariant: only an open defect; `resolveRefusal` returns `defect-not-open` for any state other than `open` | rule enforced; no test, since closing on retirement does not exist yet – add the scenario to the retirement story. Minor |
| Helper opens `/team/defects/<id>/beheben` for a defect not suitable for helpers | G11 and the story rule | the form is rendered with `whyNotResolvable` (page code passes it to the form); the command rejects in any case. Fine |
| Defect resolved by someone else while the form is open | Version check (HS-16) and `defect-not-open` | the form is kept with the note and a rejection text (page comment, rejection test covers the version conflict). Fine |
| Version conflict | HS-16 | covered by `resolve-defect-rejection` test |
| `?resolved=1` typed by hand on an unresolved defect or on someone else's resolved defect | no rule | the confirmation shows only to the resolver of that defect (`resolution?.you`). Fine, deliberate |
| Resolved-by account deactivated | none | name from `teamMemberNames`, fallback `unknownTeamMember` if absent; FK `ON DELETE RESTRICT` keeps the row. Question: does a deactivated member's name still resolve? (probably yes, it is a stored account) – minor |
| Resolving ends a hold | Story Context, but Out of Scope here (ST-029) | ST-029 must end the hold on resolve; add to its notes. Minor, line only |
| Helper-visible closing note on visitor page | none | not shown to visitors, only on the team defect page; the story only asks that the defect is gone from the visitor page |
| English visitor pages | not applicable | no visitor change |

## Findings
Blockers: none. Majors: none. Minors: (1) no maximum length for the closing note (question); (2) "resolve a defect closed on retirement" has no test yet, because the closing command does not exist – cover it in that story; (3) ST-029 must carry "resolving ends the hold".

Verdict: accepted with remarks

## Resolution (implementation, 2026-10-11)

- **Maximum length of the closing note:** not built – the story names none; a question for the user at acceptance.
- **Resolving a defect closed on retirement:** refused by `resolveRefusal` (`defect-not-open`); its test comes with ST-039, which first makes that state reachable.
- **Resolving ends the hold:** scenario of ST-029.
