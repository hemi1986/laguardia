# Code review – Refactor: the "attached to" rule once in Collection, files.ts split by consumer
Base: HEAD~1 (ed6c52b) · Commits: 1 (0eb1ff5) · Date: 2026-11-07

Behaviour neutrality checked against `HEAD~1:src/modules/collection/files.ts` and `file-overview.ts`. Everything matches.
`filesOfMachine` gives the same rows, the same order (title, added, then a stable sort by file category) and one row per
file. `ofMachineModel` was `bool_or(machine_model_id is not null)` over the matching attachments and is now
`exists(... machine_model_id = model of machine)`. Both mean the same thing, because a matching model attachment can only
be the machine's own model. `machineFile` still returns nothing for an unknown machine: the model subquery yields null,
so nothing matches. It still includes removed files. `filesOfMachineAndModelForAi` keeps the same ordering and
uniqueness (`exists` replaces `selectDistinct`) and still includes removed files. The overview filter SQL is the same,
character for character. I rendered the generated SQL with `drizzle.mock()`: the parameters are bound as `$n`, the
correlated column is `"file"."id"`, and the inner `fa`/`m` aliases are scoped to their own subqueries. Collection,
AI assistance and machine-page tests pass: 62 files, 466 tests.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | SQL / design | src/modules/collection/attached-to.ts:131,139,146,153; files-of-machine.ts:30 | The conditions correlate through `${file.id}`. In a single-table select, drizzle strips the table qualifier from columns that sit as direct chunks of a select-list SQL. Used directly as a select field, the condition renders as `fa.file_id = "id"`, which resolves to `file_attachment.id` and silently yields false (verified with `drizzle.mock()`: `select({ x: attachedToItsModel(id) })` gives `where fa.file_id = "id"`). `filesOfMachine` is correct only because it wraps the condition in `` sql`${…}` ``, and nothing says why. The module's interface claims to be "a condition on the outer `file` row", which invites reuse in a select list. | Interface: hidden constraint / leaking module (codebase-design) | Make the correlation independent of where the condition is placed: spell the outer column fully qualified instead of `${file.id}`. Alternatively, state the constraint in the module comment and cover `ofMachineModel` for a file attached to both machine and model at the same seam. |
| 2 | minor | Docs | docs/engineering/conventions.md:52 | "No reader joins `file_attachment`" is broader than what the code does. `file-overview.ts` `ownText`, `file-details.ts` and `attachment-choice.ts` still join it, legitimately, to name what a file is attached to. | Conventions accuracy | Narrow the sentence: no reader joins `file_attachment` to decide *which files* belong to a machine, a model or nothing. |
| 3 | minor | Tests | src/modules/ai-assistance/ai-assessment.test-support.ts:61-62; ai-assessment-writing.integration.test.ts:362-363 | Both still read `machineModelOfMachineForAi` even though it is no longer passed on. It remains only as a guard or throw. | Dead code | Drop the lookup where the guard adds nothing, or keep it and say it is a precondition. |
| 4 | minor | Consistency | src/modules/ai-assistance/ai-assessment-work.ts:57-61 | The machine model the work names (`machineModel`) and the model inside the files condition are now read in two separate statements. Before, they were one value. If someone corrects the machine's model in between, the files would belong to the new model while the work names the old one. This is practically negligible. The doc comment on `modelOf` presents it as an improvement. | Behaviour neutrality (edge) | Accept, or note it in the comment at the call site. |
| 5 | minor | SQL | src/modules/collection/attached-to.ts:17,125 | Table and column names are raw strings (`file_attachment fa`, `machine m`, `fa.machine_model_id`), so a schema rename is not caught by the type checker. `file-overview.ts` already used this pattern before the commit. | Primitive Obsession (smell), judgement call | Optional: build the raw parts from `fileAttachment` and `machine` in `schema.ts` (`getTableName`, column `.name`). |

fix the major first (or accept it knowingly) – no blockers, behaviour-neutral as claimed.
Most important: the conditions give a silently wrong result when used directly as a select field (`fa.file_id = "id"`); only the undocumented `` sql`${…}` `` wrapper in `filesOfMachine` avoids it.
