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
- **Languages:** artifacts, stories, glossary, code and comments in English; UI texts in German. The values come from
  `languages` in `.claude/project.json`.
- **Tooling in `.claude/`:** TypeScript executed directly by Node ≥ 22.18 (type stripping) – no Python, no build step,
  erasable TypeScript syntax only. The application has its own Next.js build.
- **Where the rest lives:** `docs/workflow.md` (sources of truth, commands, rules, tool access),
  `docs/engineering/conventions.md` (module layout, seam catalog, definition of done).
