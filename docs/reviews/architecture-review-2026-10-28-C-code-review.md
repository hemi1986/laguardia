# Code review – architecture review 2026-10-28, candidate C

Base: main · Branch: `refactor-set-delta-command` · Commits: 1 · Date: 2026-10-28 · Reviewer: code-reviewer (not a story review)

Scope: the command layer's two options `versionless` (changing commands) and `mayChangeNothing` (all commands) become
one option, `setDelta: true`, on a changing command (`src/platform/command/aggregate.ts`). Its `target` must name no
version (a version throws), the row is loaded with a lock, and `Command.mayChangeNothing` is derived from it.
`withPolicies` now carries `mayChangeNothing` through. The one user, CMD-ChangeMachinesOfMaintenanceTask, declares
`setDelta: true`. Tests and conventions are adapted. Agreed beforehand and not reviewed: the version conflict an open
add/change-task form meets after a machine change, and the ADR 0010 lock order.

Checked and found in order:
- **Every existing command behaves as before.**
  - Creating commands: the `creates` branch never reads `setDelta`. `mayChangeNothing` is `undefined` because of the
    `!definition.creates` guard, so a creating command that journals nothing still throws
    (`execute-command.integration.test.ts:100`).
  - Policies without a version: the guard at `aggregate.ts:274` is the old condition with the option renamed. They are
    still loaded with a lock (`lock: target.version === undefined`).
  - Changing commands of a person without `setDelta`: they still need a version (test at `:168`).
  - Nested policies that have nothing to do: `runInTransaction` never checked `mayChangeNothing`, so this is unchanged.
  - Before this change, `mayChangeNothing: true` was set only on CMD-ChangeMachinesOfMaintenanceTask, and it is now the
    only command with `setDelta`. Its CMD-ID, actors, target, facts and decision are unchanged.
- **`withPolicies` fix.** The only `withPolicies` use outside tests is `retireMachineCommand`
  (`src/modules/repair/retirement-policies.ts:74`), which is no set delta. So the dropped flag was a latent bug and never
  a live one. The fix does nothing for a command without the flag.
- **Type safety.**
  - A scratch probe outside the repository showed that an object literal with `creates: true, setDelta: true` is
    rejected (TS2353, `setDelta` does not exist in `Creating`), and so is `setDelta: false`.
  - A spread (`...{ setDelta: true as const }`) on a creating command type-checks, because TypeScript does no
    excess-property check on spreads. At runtime it is harmless: the `!definition.creates` guard and the `creates`
    branch ignore it. No finding.
  - The precedence of `!definition.creates && definition.setDelta ? true : undefined` is
    `(!creates && setDelta) ? true : undefined`, which is what is wanted. It sets the key explicitly to `undefined`; the
    old `definition.mayChangeNothing` did the same.
- **Test sensitivity.** Each new or changed test fails without the matching production change:
  - Remove the throw at `aggregate.ts:271-273`, and "refuses a set delta that names a version" ends `ok` (the store
    accepts version 3).
  - Remove `policies.ts:34`, and "withPolicies keeps the set delta" throws `journals no event`.
  - Derive `mayChangeNothing` wrongly as `undefined`, and "ends successfully … nothing to do" throws.
  - One gap is left, see #1.
- **Remaining references.** No `versionless` option or `mayChangeNothing` definition option is left in `src/`. Two
  remaining uses are fine:
  - `.claude/skills/engineering-conventions/SKILL.md:195` says "a versionless policy" in its generic sense (a policy
    without a version), which is still correct.
  - `docs/stories/ST-095-…md:41` says "versionless set-delta commands". That story is done and is not changed.
  - One stale comment is #2.
- `npx tsc --noEmit -p .` is clean. `npx vitest run src/platform/command src/modules/maintenance` passed 18 files and 121
  tests. Prettier and eslint are clean on the six changed files. `check-language.ts` reports no warning on a line of the
  diff (the warnings it reports in `platform/command` are older).

| # | Severity | File | Finding | Suggested direction |
|---|---|---|---|---|
| 1 | minor | `src/platform/command/execute-command.integration.test.ts:184-200` | The removed test "still refuses a command that journals nothing without the option" was the only one for a **changing** command that journals nothing. The remaining test at `:100` covers a *creating* command only. If the derivation regressed to `!definition.creates ? true : undefined` (every changing command may change nothing), no test in the command layer would fail. That is the very rule the conventions repeat: "Every other command that journals nothing still throws". | Add one case to the describe: `delta(store, {}, 0, 3)` run by the technician rejects with `/journals no event/`. |
| 2 | minor | `src/platform/command/index.ts:159` | The comment "Every command writes its journal entry …; only a policy may have nothing to do" is now inexact. The very next line lets a set delta journal nothing, and the line does not cover a policy at top level. The comment was already stale since ST-095, but it sits directly on the check this refactor rewires. | Reword it to: "only a set delta (`mayChangeNothing`) may end with nothing to do; a policy with nothing to do adds no rows to the command that triggered it". |
| 3 | minor | `src/platform/command/aggregate.ts:219`, `.claude/skills/engineering-conventions/SKILL.md:273-274` | The doc comment and the conventions list "its decision returns the loaded state itself when it has no events – anything else throws" as one of the things that follow from `setDelta`. The check at `aggregate.ts:296-302` applies to **every** changing command. Read as a set-delta rule, it suggests other changing commands may return a changed state without events. | Say "like every changing command, its decision then returns the loaded state itself", or drop the bullet from the `setDelta` comment and leave it on `Changing`. |

Verdict: **ready to merge**. There are no blockers or majors: every existing command behaves as before, a creating command cannot declare the option as a literal (and a spread is ignored), the new tests are sensitive, and the type check and tests are green.
Most important finding: #1. Once its test was deleted, nothing in the command layer pins down that a changing command without `setDelta` still throws when it journals nothing.

## Outcome

| # | Outcome |
|---|---|
| 1 | Fixed: a changing command that is no set delta and journals nothing still throws – tested. |
| 2 | Fixed: the comment in `index.ts` names the set delta. |
| 3 | Fixed: "returns the loaded state itself" is said as the rule of every changing command, in `aggregate.ts` and the conventions. |
