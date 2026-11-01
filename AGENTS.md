<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- kataster:begin – managed by kataster; edits inside are overwritten on upgrade -->
## laguardia – agent workflow (Kataster)

This repository runs the Kataster workflow. Discovery lives in `.claude/skills/`, the OpenCode wiring in
`.opencode/`; Claude Code uses the same skills and hooks.

- **Profile:** `.claude/project.json` – name, stack, languages, commands, backlog backend. Read it before assuming anything.
- **Backlog:** `backlog.provider` is `local` (default), `github` or `jira`. With a tracker, `docs/stories/` is the
  local mirror and the tracker is the source of truth – sync with `/backlog-sync`; `BACKLOG.md` stays generated.
- **Map:** `docs/workflow.md` – sources of truth, commands, phases, rules. Read it when unsure where something
  belongs.
- **Repo map (brownfield):** `docs/architecture/repo-map.md` – packages, dependency edges, consumers, adopted
  slices. A package's `AGENTS.md` is loaded only when you work there; the root file stays free of domain.
- **Start:** greenfield → `/bootstrap`; existing code → `/adopt` (in slices, not the whole monorepo).
- **Never guess:** unclear → a hotspot (`HS-n`) or `[OPEN]` plus a row in `OPEN_QUESTIONS.md`.
- **Project checks:** `docs/engineering/checks.yaml` – what runs at edit time and Stop/CI; architecture boundaries
  in `docs/architecture/boundaries.yaml` with existing debt in the baseline (only new violations fail).
- **Language:** domain terms exactly as in `CONTEXT.md`; UI words from its `_UI (<lang>)_` lines.
- **Traceability:** every scenario has a test titled `ST-NNN: <scenario title>`; domain IDs come from
  `docs/domain/events.yaml`.
- **ADRs:** new ones are `proposed`; only the user sets `accepted`. A `done` story is never reopened.
- **Gate:** `node .claude/skills/implement/scripts/verify.ts`.

Keep this block short: it is loaded into every session. Put rules into the skill that owns them, not here.
<!-- kataster:end -->

## Project

<!-- House rules. They sit outside the managed block above, so an upgrade never touches them. -->

- **What this is:** the pinball museum's software – repairs, defects, manuals and problem tickets. Purpose, users and
  scope are in `docs/product/vision.md`; the vocabulary is `CONTEXT.md`.
- **Shape:** a Next.js monolith at the repository root (`docs/adr/0001-tech-stack.md`). Discovery artifacts and code
  live in this one repository and change together.
- **Tooling in `.claude/`:** TypeScript executed directly by Node ≥ 22.18 (type stripping) – no Python, no build step,
  erasable TypeScript syntax only. The application has its own Next.js build.

## Rules

**Read `docs/workflow.md` before planning or implementing.** It holds the sources-of-truth table, the command list
and the full rule text; `docs/engineering/conventions.md` holds the module layout, the seam catalog and the
definition of done. These hold every turn:

- **Language:** artifacts, stories, glossary, code and comments in English; UI texts in German – the values are
  `languages` in `.claude/project.json`.
- **IDs** come from `docs/domain/events.yaml`; every Gherkin scenario has a test titled exactly
  `ST-NNN: <scenario title>`.
- **Never weaken or delete a test to get green.** One branch and one pull request per story – the user merges.
- **Status changes only** through `node .claude/skills/implement/scripts/story-status.ts`; a `done` story is never
  reopened.
- **Don't guess:** unclear → hotspot (`HS-n`) or `[OPEN]` + row in `OPEN_QUESTIONS.md`; a wrong story goes back to
  `review`, never decided in the code.
- **Subagents don't know the conversation** – pass file paths and a clear task. At most 3 questions at once, except
  in grilling rounds, which ask the whole frontier.

<!-- kataster:repo:begin -->
<!-- Generated from docs/architecture/repo-map.json by repo-map.ts. Do not edit inside this block. -->
## Repository map

- **Tooling:** none (single package) · **Packages:** 1 · **Adopted:** 1 of 1
- **Layout:** `./` (1)
- **Detail:** `docs/architecture/repo-map.md` – package list, dependency edges, consumers, adoption ranking.
- **Adopted slices:** root package.

## Commands

| Scope | Command |
|---|---|
| Install | `npm install` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Test | `npm run test` |
| End-to-end | `npm run test:e2e` |
| Gate | `node .claude/skills/implement/scripts/verify.ts` |

## Read next

- `docs/architecture/repo-map.md` – where domains and shared libraries live
- `docs/engineering/conventions.md` – how code is built in this repository
- `CONTEXT.md` – domain language; this file stays free of domain rules on purpose
- Package docs: `<package>/AGENTS.md` (loaded when you work there) with `<package>/CLAUDE.md` as the Claude Code entry
<!-- kataster:repo:end -->
