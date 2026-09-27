# Acceptance – ST-071: Commands as load, decide, save
Date: 2026-09-27 · Tests run: `npx vitest run` → 95 passed / 0 failed (local, PostgreSQL on :5433) · `node .claude/skills/implement/scripts/verify.ts` → green (lint, typecheck, tests, events.yaml, stories, scenario traceability, domain-ID traceability, glossary language) · CI (branch `st-071-commands-load-decide-save`, head `c5473a4`): `CI` → success, `Browser tests on preview` → success · Preview: none (protected; relied on the CI browser run, which is green)

Note on process: during this review the branch received two more pushes (`1ede7e3`, then `c5473a4`) – a parallel code review (`docs/reviews/ST-071-code-review.md`) found two **major** findings (version optional for every changing command, not just policies; a policy's error type erased) and several minor ones, and the main session fixed them while I was testing. Everything below is evaluated against the final, pushed commit `c5473a4`, which is what CI ran green against.

This is a tech task: the checklist items are the unit of acceptance (no Gherkin scenarios; `events: []`). `check-scenarios.ts` reports 0/0, as expected.

## Checklist (`docs/stories/ST-071-commands-load-decide-save.md`)

| Item | Evidence checked | Really holds? |
|---|---|---|
| CMD-ReportProblem is a creating command, no load, version 0 | `report-problem-command.integration.test.ts:14` stores at version 0, shown by a change at version 0 succeeding and a second at version 0 conflicting; `aggregate.ts`'s `creates: true` path skips `store.load` entirely; `report-problem.test.ts` unit-tests the decision table (trim, empty → `description-required`, reporter from actor) | Yes |
| Journal entry has no description | `report-problem-command.integration.test.ts:51` asserts `data: {}` and that the raw JSON never contains the description string; `execute-command.integration.test.ts:20` (platform) asserts the same via `journalOf` | Yes |
| A command on an existing aggregate: load → decide → save one version higher | `problem-report-version.integration.test.ts:28` ("loads the problem report, decides and saves it one version higher") does two sequential changes and checks the final description; version bump is exercised (0→1→ conflict) throughout the file | Yes |
| Domain rejection before version conflict (Q11) | `problem-report-version.integration.test.ts:50` ("returns the domain rejection, not a version conflict, when the fresh state explains it") – same input against a stale version 0: `description-unchanged` when the fresh state already has that text, `version-conflict` when it doesn't; both paths assert nothing was stored/journaled | Yes, and matches Q11 precisely: `aggregate.ts` calls `definition.decide(loaded.state, …)` on the freshly loaded state before comparing `expectedVersion` |
| Concurrency test and not-found test kept | `problem-report-version.integration.test.ts:37` (exactly one of two concurrent same-version commands succeeds, journal shows exactly one applied change) and `:69` (`not-found`, not `version-conflict`) – both carried over from the old platform test, now against the stand-in | Yes |
| New aggregate of the same module created and saved in one transaction; rejected → neither exists | `problem-report-version.integration.test.ts:73` (split creates a second problem report, both present) and `:85` (same split but stale version → `version-conflict`, only the original description remains, i.e. the created one was rolled back). `aggregate.ts` inserts `created[]` **before** the version-checked `update`, so the rollback is real (the DB transaction, not application logic, undoes the insert) | Yes |
| `context.runAsSystem` still runs policies journaled as system; policy tests stay green | `problem-report-policies.integration.test.ts` – both original tests present ("runs an automatic policy…", "rejects the whole command… when its automatic policy is rejected"), moved out of the platform test as required (platform test may not import Repair's stand-ins – confirmed, `execute-command.integration.test.ts` no longer references them) | Yes |
| No `updateAtVersion` left; version check only in the save step | `grep -rn updateAtVersion src` → empty; `grep -rn defineCommand src` → empty; version check lives solely in `aggregateStore.update` (`aggregate.ts`) | Yes |
| No assertion dropped, old → new | Compared `git show main:<file>` against the current files for all four old test files (see table below) | Yes, confirmed independently and matches the mapping the code review recorded |
| `npm run verify` green | Ran locally: green. CI (`c5473a4`): both `CI` and `Browser tests on preview` succeeded | Yes |
| SKILL.md updated: Writing a command / Version check / Automatic policies / file table / seam catalog | Present and consistent with the code (`aggregateCommand`, `target.version` required for a person, policies via `trigger`, seam rows point at the real test files) | Yes, content-wise. **Not yet evidenced** in a pull request – none exists yet on this branch, so "the user approves in the pull request" is still pending (expected: this task is still `in-progress`, PR comes after review/refactor per the workflow) |

Old test → new test (verified myself, independent of the code review's own table):

| Old (main) | New | Dropped? |
|---|---|---|
| `execute-command…`: "stores exactly the command's domain events…" | same file, same test, unchanged | no |
| `execute-command…`: "gives a created aggregate… the injected ID" | same file, same test, unchanged | no |
| `execute-command…`: "stores neither… when rejected" (two cases: empty description, and reject-after-writing via a hand-rolled command) | split: empty-description case stays in `execute-command…`; the "writes then rejects" case is now the rejected-policy test in `problem-report-policies…` (a real command construct, not a hand-rolled `run`) plus the version-conflict-after-writing cases in `problem-report-version…` | no – same behaviour (a write followed by a rejection rolls back), now expressed with real stand-ins instead of an ad-hoc composed command |
| `execute-command…`: "rejects team-only command without acting member" | same file, same assertion, `aggregateCommand`/`memoryStore` instead of `defineCommand` | no |
| `execute-command…`: "runs an automatic policy… journals as system" | moved verbatim to `problem-report-policies…` | no |
| `execute-command…`: "rejects whole command when policy rejected" | moved verbatim to `problem-report-policies…` | no |
| `execute-command…`: "refuses successful command that journals no event" | same file, same assertion | no |
| `execute-command…`: "journal append-only" | same file, same assertion | no |
| `problem-report-version…` (old, defineCommand + updateAtVersion): concurrency test | new file, same assertions (one succeeds, one `version-conflict`, journal has exactly the two expected types) | no |
| `problem-report-version…` (old): not-found test | new file, same assertion | no |
| `problem-reports.integration.test.ts` (old): stores via `saveProblemReported`, lists for machine | new: stores via `executeCommand(reportProblemCommand, …)`, same list assertion | no – seam moved from the raw persistence function (now internal to `aggregateStore`) to the command, which is the only way to reach it now |
| `report-problem.test.ts` (old): records with ID/machine/description/reporter/time; rejects empty description (parametrized) | new file: same two tests (decision now takes `(state, input, context)` and returns `{ state, events }`), plus a new "takes the acting team member as reporter" test | no – behaviour preserved and one case added |

## Definition of done (ST-059)
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | No | Tech task, no UI | n/a |
| List pages fast with realistic data | No | No read model/list page introduced | n/a |
| Every command writes its journal entry | Yes | `executeCommand` throws `"… journals no event"` when a top-level command's rows are empty; test "refuses a successful command that journals no event" still present and green. Automatic policies are explicitly allowed to journal nothing (documented in SKILL.md and covered by the new "policy has nothing to do" test) | OK |
| Texts from message catalogs | No | No new user-facing text; command error strings are technical result codes, not catalog text | n/a |
| No personal data in logs | Yes | Journal `data` for `EVT-ProblemReported` stays `{}`; test asserts the raw JSON never contains the typed description | OK |

## Edge cases not covered by the story

| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| A policy targets the **same** aggregate the triggering command just **updated** (not created) – only "policy on a just-created aggregate" (`reportWithPolicyForTest`) and "policy on an unrelated aggregate with a lock" are tested | Not explicitly – Q12 says a decision may create new aggregates of the same module; "anything else goes through a policy". Not clear whether "a policy on the very row the command just changed" is an intended shape at all | Question for whoever writes the first such policy (e.g. HS-16's "record defect" scenario in ST-018) rather than a gap in this story |
| A `created` aggregate whose ID collides with an existing row (e.g. a decision bug reusing an ID) | Not directly – IDs come from `newId()` (UUID), so only reachable via a bug in a decision | Would surface as a raw Postgres unique-violation bubbling out of `executeCommand` uncaught, rather than a controlled rejection. Low probability, no rule violated; not worth a story now per the follow-up hurdle (not a security/data-loss risk beyond what already existed pre-ST-071, not blocking any named story) |
| `target.version` higher than the stored version (client claims to have seen a future version) | Not distinguished from "lower" – both fail `WHERE version = expectedVersion` and return `version-conflict` | Reasonable, consistent behaviour; not a defect |
| The 15 minor findings from the parallel code review that were deliberately **not** fixed in this story (`AggregateStore.type` unused, low-level `run`/store still technically public, no lint rule yet forcing `*.test-support.ts` to stay test-only, creating-decision's placeholder parameter, one overlapping read-model/command test, `trigger` example that doesn't fit multi-aggregate policies, plural masking only `+s`) | No rule violated | All already routed to existing stories (ST-050, ST-073, ST-067, ST-039) or explicitly accepted as-is in `docs/reviews/ST-071-code-review.md`'s "Resolution" section – consistent with the project's follow-up hurdle, nothing further to open here |

## Verdict
**Accepted with remarks.**

The core shape (load → decide → save, Q2/Q11/Q12/Q14), the conversion of `CMD-ReportProblem` and the test stand-ins (Q22), and the removal of `updateAtVersion`/`defineCommand` all hold up under inspection, and no assertion from the pre-ST-071 tests was dropped. Version semantics match Q11 exactly (domain rejection returned before a version conflict is even checked). `npm run verify` and both CI jobs are green at the final pushed commit `c5473a4`.

Remarks (none blocking, none requiring a new story per the follow-up hurdle):
- The story is still `in-progress` and no pull request exists yet, so the two checklist items whose evidence is "in the pull request" (old→new test table, user's SKILL.md approval) aren't literally satisfiable yet – expected at this point of the `/implement` workflow, not a defect. I verified the old→new mapping myself (table above) since the PR doesn't exist to check it against.
- While this review was running, the branch received two more commits from a parallel code review that fixed two **major** findings (the version was optional for every changing command, not just for policies – a real lost-update risk once real team commands arrive in ST-018 ff.; and a policy's rejection error was erased from the triggering command's declared result type). Both are now fixed and tested (`c5473a4`), and I re-ran the full suite and CI against that final commit.
- A couple of edge cases (policy on the same aggregate the command just updated; a hypothetical `created`-aggregate ID collision) are open questions rather than gaps – noted above for whoever writes the first real policy/triage command (ST-018).
