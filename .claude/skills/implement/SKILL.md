---
name: implement
description: Engineering workflow – implements one story from docs/stories/ test-first on its own branch, verifies, has it reviewed by code-reviewer and acceptance-tester, refactors, and hands it to the user for acceptance and merge.
disable-model-invocation: true
argument-hint: "[ST-NNN – empty = next ready story]"
---

# Implement a Story

Story: **$ARGUMENTS** (empty → `node .claude/skills/implement/scripts/next-story.ts`; a story already `in-progress` is finished first).

The main session writes the code together with the user; subagents only review. Two checkpoints belong to the user: the **test plan** (step 2) and **acceptance + merge** (step 7). Everything in between runs without asking, unless the story turns out to be wrong (see *When the story is wrong*).

Engineering conventions: `.claude/skills/engineering-conventions/SKILL.md` – read it if it exists; it describes the module layout, how commands and read models are built, and the **seam catalog**.

## 1. Prepare
1. Working tree clean, on `main`, up to date (`git pull`). Otherwise stop and tell the user.
2. `node .claude/skills/implement/scripts/story-context.ts ST-NNN` – the context pack: story, exact test titles, dependencies, events/commands/rules/invariants, glossary, data model, ADRs. Read it completely; it is your source, not memory.
3. `git switch -c st-NNN-<slug>` (slug from the file name), then `node .claude/skills/implement/scripts/story-status.ts ST-NNN in-progress` and commit `ST-NNN: start`.

## 2. Test plan → user checkpoint
Call the Skill tool for `tdd` (and `codebase-design` when a new module or interface is involved).
Present one table and wait for the user's approval:

| Scenario (exact test title) | Seam | Test type | Test file |
|---|---|---|---|

- **Story**: one row per Gherkin scenario. **Tech task**: one row per checklist item that can be tested; the rest gets its evidence named (setting, document). **Spike**: no table – see *Spikes*.
- Seams come from the seam catalog in the engineering conventions. A seam not in the catalog is a decision for the user – say so explicitly.
- Name anything the story leaves open. Don't guess – see *When the story is wrong*.

The user's approval is the "confirmed seams" the tdd skill requires.

## 3. Red → green, one scenario at a time
- Per row: write the test (title exactly `ST-NNN: <scenario title>`), run it and see it fail for the right reason, write the minimal code to pass, run it green. Commit: `ST-NNN: <scenario title>`.
- Domain IDs in the code: commands, events, read models and policies carry their ID from `events.yaml` (`CMD-ReportProblem`, `EVT-ProblemReported`, …). New code uses the words of `CONTEXT.md`; a new term goes into `CONTEXT.md` first (domain-model skill).
- Never weaken or delete an existing test to get green. If a test from an earlier story blocks you, its story and this one contradict each other → *When the story is wrong*.
- Hooks help on the way: formatting and lint after every write, the quick gate (type check + related tests) before you finish a turn.

## 4. Verify
`node .claude/skills/implement/scripts/verify.ts` (with `--e2e` when browser tests exist) must be green: lint incl. module boundaries, type check, tests, events and stories valid, scenario ↔ test and domain ID traceability. Language warnings: fix or justify.

## 5. Review (in parallel)
Push the branch (`git push -u origin st-NNN-<slug>`) so a preview deployment exists. Then start in **one** message:
- `code-reviewer` – task: story ID, base ref `main`, the context pack command. Writes `docs/reviews/ST-NNN-code-review.md`.
- `acceptance-tester` – task: story ID, base ref `main`, the preview URL (if known). Writes `docs/reviews/ST-NNN-acceptance.md`.
- The Skill tool for `code-review` (bugs in the diff) – and for `security-review` when the story has the label `visitor`, touches login/roles, uploads or files.

## 6. Refactor
- Fix all blockers and majors, and the minors you agree with; say which minors you skip and why.
- **Follow-ups** too big for this story: delegate to `requirements-engineer` as new tech-task stories (`status: draft`, label `follow-up`), referencing the review file. They go through `/review-stories` like any story.
- Refactor only with green tests; the tests must not change unless they were wrong (then say so). Run `node .claude/skills/implement/scripts/verify.ts` again.

## 7. Acceptance and merge → user checkpoint
1. Open a pull request: title `ST-NNN: <story title>`, body = the scenarios as a checklist, links to the story and both review files, the preview URL, remaining minors. (No `gh` CLI: push and give the user the compare URL `git push` prints.)
2. The user checks the preview on a phone (360 px) and accepts.
3. `node .claude/skills/implement/scripts/story-status.ts ST-NNN done` – refuses unless every scenario has its test (story) or every checklist item is ticked (spike/tech task) and all dependencies are done. Commit `ST-NNN: done`, push.
4. **The user merges.** Afterwards: `git switch main && git pull`.

## 8. Wrap-up
Summarize in a few lines: scenarios implemented, review findings fixed/skipped, follow-ups created, glossary/ADR changes. Then:
- Suggest `/improve-codebase-architecture` after the foundation stories, when a bounded context is complete, or about every 8–10 done stories.
- Name the next story (`node .claude/skills/implement/scripts/next-story.ts`).

## Spikes
A spike answers its **Question** within its **Timebox** – no test plan, no TDD for throwaway experiments.
- Before starting, tell the user the timebox and what will be kept (e.g. ST-001: the skeleton code becomes the application – code that is kept gets tests and passes verify).
- Tick each checklist item in the story file as it is answered; write results where the item says (an ADR's consequences, `OPEN_QUESTIONS.md`). A new decision → ADR with `status: proposed` (architect skill); the user accepts.
- Timebox exhausted → stop, document what is known, and ask the user how to continue.
- Review: `code-reviewer` only for code that is kept; `acceptance-tester` checks the checklist evidence.

## When the story is wrong
Never guess. When a scenario contradicts another story, a rule or an ADR, can't be tested as written, or leaves a decision open:
1. Stop implementing that part. Mark it `[OPEN]` in the story and add a row to `docs/stories/OPEN_QUESTIONS.md`.
2. `node .claude/skills/implement/scripts/story-status.ts ST-NNN review` and tell the user. The fix goes through discovery: `requirements-engineer` revises the story, `/review-stories` approves it again. Work already done on the branch stays.
3. New domain term → `CONTEXT.md` (domain-model skill). Architecture deviation → a `proposed` ADR (architect skill). An accepted ADR is never edited; the hooks block it.
4. A `done` story is never reopened – a change to finished behaviour is a new story.

## Foundation stories (ST-001, ST-059, ST-003)
They build what the other stories rely on, so they also set up the workflow's tooling:
- Root `package.json` scripts: `lint` (incl. module boundary rules, e.g. `eslint-plugin-boundaries`), `typecheck`, `test`, `test:e2e`, and `verify` = `node .claude/skills/implement/scripts/verify.ts`. CI runs `npm run verify`.
- The app's ESLint and TypeScript configs exclude `.claude/` and `docs/` (the tooling has its own `tsconfig`).
- The hooks expect Prettier, ESLint, `tsc` and Vitest in the app's `node_modules`. If ST-059 chooses a different test runner, adapt `.claude/hooks/stop-gate.ts`.
- **After ST-003** write `.claude/skills/engineering-conventions/SKILL.md` from what now exists (not before): module layout, how to write a command (command layer, journal, authorization, version check), a read model, a time-based rule, UI texts; test data builders and the fixed clock; and the **seam catalog** – which seam each kind of code is tested at (module commands against real PostgreSQL, read-model queries, pure domain rules, browser tests at 360 px). The user approves it; then re-check the stories that depend on the spikes' results.
