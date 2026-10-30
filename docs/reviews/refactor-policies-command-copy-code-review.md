# Code review – refactor-policies-command-copy (K5, architecture review 2026-10-30)
Base: main · Commits: 1 · Date: 2026-10-30

No story: a refactoring of `src/platform/command/policies.ts`. Checked: spread safety, the returned type, the new test. No behaviour change found.

**Spread safety.** Every `Command` in `src/` is a plain object literal. `aggregateCommand` (`src/platform/command/aggregate.ts:282-287`) returns one with own enumerable `id`, `allowedActors`, `removesContent`, `mayChangeNothing` and `run`. No class implements `Command`, nothing uses `Object.create`, and nothing in `src/platform/command/` uses `this`. `removesContent` is `definition.removesContent`, and it was passed on unbound before too. So the spread copies exactly what the old code copied by hand, and then replaces `run`. The commands wrapped in `retirement-policies.ts` and `registration-applies-chosen-maintenance-tasks.ts` are `aggregateCommand` results. Before and after, `mayChangeNothing: undefined` is an own key. That is harmless because callers test whether it is truthy.

**Types.** `withPolicies` still returns `Command<Input, Result, Error | PolicyError>`. `withPolicyInput` still returns `Command<{ command; policies }, Result, Error | PolicyError>`. The input of `run` and its error union are fixed by the explicit `RunInput`/`RunError` of `runningInstead`.

| # | Severity | Area | File:line | Finding | Source | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Design / types | src/platform/command/policies.ts:68-73 | `{ ...command, run }` is assigned to `Command<RunInput, …>` from a `Command<Input, …>`. Today no property except `run` depends on `Input`, so this is sound. But `removesContent?(…)` and any later member are declared with method syntax, which TypeScript checks bivariantly. A future property typed on `Input` would be carried over under the wrong input type without an error. The old hand copy had the same blind spot. | codebase-design (interface includes invariants) | Optional: add one sentence to the `runningInstead` doc comment saying that it relies on no property other than `run` depending on the input. Or use property syntax for new members of `Command`. |
| 2 | minor | Test quality | src/platform/command/policies.test.ts:24 | The exact `Object.keys` list pins the fixture's own keys. It proves that nothing is dropped from the fixture. It does not prove the promised "a property gained later cannot be lost": a new `Command` property only gets covered once someone adds it to the fixture. That is acceptable, because the spread makes losing a property structurally impossible. `expect(added.run).not.toBe(command.run)` is weak, but the run behaviour is covered by `policies.integration.test.ts`. | tdd (meaningful assertions) | Keep the test as it is. Optionally drop the `not.toBe` line or replace it with a behavioural check (wrapped run returns the inner outcome when there are no policies). |
| 3 | minor | Language | src/platform/command/index.ts:129 | The edited doc comment line is now longer than the surrounding wrapped lines. | consistency | Rewrap it. |

Verdict: ready to merge
Most important: nothing blocks. The spread carries exactly the properties the hand copy carried, because every command is a plain object literal with no prototype members and no `this`. The bivariance blind spot (#1) existed before and is only worth a comment.

## Resolution
- **#1 fixed** – the `runningInstead` comment says a property typed on the input would come along unchecked, so such a property belongs in `run`.
- **#3 fixed** – the doc comment in `index.ts` is wrapped again.
- **#2 skipped** – the spread cannot drop a property; `run`'s behaviour stays covered by `policies.integration.test.ts`.
