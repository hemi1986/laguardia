# Code review – ST-022: Triage – link a problem report to an open defect
Base: main · Commits: 9 · Date: 2026-10-09

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Domain rules / concurrency (forward-looking) | src/modules/repair/defects.ts:165-173 | `linkingFacts` takes `FOR SHARE` on the defect row. That is correct now, because the link never writes the defect. ST-053 (`POL-LinkReopensResolvedDefect`) will write the defect in the same transaction. Two concurrent links to the same resolved defect would then each hold a share lock and both try to upgrade it to an exclusive lock, which is a classic deadlock. | ADR-0002 (one transaction, policies in the same transaction); conventions "Facts that must stay true until the commit take a lock" | Nothing to change now. ST-053 can take it: lock the defect `FOR UPDATE`, or load it through `defects` with `lock`, as soon as the link may reopen it. A note in ST-053's context would stop it being forgotten. |
| 2 | minor | Test quality | src/modules/repair/link-problem-report-to-defect-command.integration.test.ts:98-115 | "A defect resolved in the meantime" runs one step after the other: resolve, then link. That covers the scenario's "Then". The extra guarantee the code comment promises is not exercised: a resolution running at the same time waits for the link's share lock. ST-018 does have a two-transaction concurrency test (`record-defect-concurrency.integration.test.ts`). | tdd skill (the test should check the behaviour that is claimed); conventions seam catalog | Optional: add a two-transaction test (link holds the lock, the resolve stand-in waits and then commits) next to the record-defect concurrency test. Or soften the comment to what is tested. |
| 3 | minor | Conventions | .claude/skills/engineering-conventions/SKILL.md:168-180 | The conventions only describe locks for set-based facts (advisory lock) and say cross-module facts take no lock. This story adds a third kind: a row lock (`FOR SHARE`) on another aggregate of the *same* module, read as facts. Because it isn't written down, the next command that reads a defect as facts may not take the lock. | Conventions (seam/command layer section) | Add one line under "Facts on an existing aggregate": when facts are another aggregate of the same module and must stay true until the commit, read them `FOR SHARE`, or `FOR UPDATE` if the same transaction may write that aggregate (see #1). |
| 4 | minor | Design | src/app/(team)/team/triage/[problemReportId]/problem-report-data.ts:35-48 | `loadProblemReport` now always runs `openDefects` (a left join with group by). It does so for triaged reports and for the other outcome form pages (Defekt erfassen, Direkt behoben, Meldung verwerfen), which never use the result. It also maps and re-sorts RM-OpenDefects' priority order into oldest first, so this data function owns a second ordering of the same read model. | Smell: Divergent Change / Speculative loading; codebase-design (locality) | Skip the query when the report is triaged. Consider a small `openDefectsForLinking(db, machineId)` query in the Repair module that returns id, title and openSince oldest first, so the ordering has one home. |
| 5 | minor | UI / design | src/app/(team)/team/triage/[problemReportId]/verknuepfen/page.tsx:78-86 | When a technician opens `/verknuepfen` directly for a machine with no open defect, the page shows "LG-042 hat keine offenen Defekte." and also an empty fieldset "Offener Defekt" with an active "Mit Defekt verknüpfen" button. The button can only lead to "Bitte einen Defekt auswählen." | ux-guidelines G7 (say it in words instead of offering a dead control) | Render the form only when there are open defects or a rejection state, so a rejection after the last defect was resolved is still shown. |
| 6 | minor | Code smell | src/modules/repair/link-problem-report-to-defect-command.ts:24 | `result` reads `report.triage?.defectId ?? ""`. The empty-string fallback can never happen after a successful link, but the type allows it, and an empty ID would pass silently. | Smell: Primitive Obsession / defensive default | Derive the result from what the decision returns, or narrow it (`report.triage!.defectId` with a comment, or a typed linked triage), so an impossible state cannot become `""`. |
| 7 | minor | Code smell | src/app/(team)/team/triage/[problemReportId]/problem-report.tsx:85-90 | `TriageOutcomes` adds `const technician = role === "technician"` but still writes `role === "technician"` on the next two lines. | Smell: Duplicated Code (small) | Use `technician` throughout. |

No blockers or majors found. Checked and fine:
- ADR-0002: the command goes through `aggregateCommand`, with a version check on AGG-ProblemReport and `EVT-ProblemReportLinkedToDefect` written to the journal in the same transaction, holding only `defectId`.
- `allowedActors` is technicians only, plus `requireTechnician` on the page and the action.
- The decision is pure and uses `clock.now()`.
- An unknown or malformed defect ID is rejected as `defect-required`, before the database is queried (`isId`).
- The confirmation on the triage list is read back from stored state, not from the address.
- No new language warnings.
- Every scenario has a test with the exact title at an agreed seam.
- Removing the `linkToDefectForTest` stand-in in favour of the real command is an improvement.

**Verdict: ready to merge**
Most important finding: #1. The `FOR SHARE` lock is right for ST-022 but turns into a deadlock risk once ST-053 makes linking write the defect, so ST-053 must switch it to `FOR UPDATE`.

## Resolution (implementation, 2026-10-09)

- **#1 fixed now, not left to ST-053:** `linkingFacts` locks the defect `FOR UPDATE`. Two links to the same defect run one after the other, so ST-053 cannot deadlock there. The reason is in the comment.
- **#2 fixed:** `link-problem-report-to-defect-concurrency.integration.test.ts` uses two real transactions. A resolution waits for the link that checked the defect as open. Without the lock this test fails, which was checked by removing the lock once.
- **#3 fixed:** one line in `SKILL.md` under *Facts on an existing aggregate* covers the row lock on another aggregate of the same module.
- **#4 partly fixed:** the extra oldest-first sort is gone, so the form uses RM-OpenDefects' order and the read model has one ordering. **Skipped:** skipping the query for triaged reports and on the other form pages. It costs one small query per page load, and making it conditional would split `loadProblemReport` for no visible gain.
- **#5 fixed:** without open defects and without a rejection, the form is not rendered. The page's sentence stays (G7).
- **#6 skipped:** `?? ""` is the same pattern as CMD-RecordDefect's result. Narrowing it for one command would make the two differ. Revisit when the triage commands get a typed linked or recorded triage.
- **#7 fixed.**
