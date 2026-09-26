# La Guardia – Discovery Workflow for Claude Code

> Named after Fiorello La Guardia, the New York mayor who banned pinball in 1942. This software keeps the museum's pinball machines running instead.

AI-assisted workflow to capture the domain via event storming, settle the data model and architecture, and derive user stories from it. The stories live as Markdown files in `docs/stories/` – that local backlog, together with the other artifacts in `docs/`, is the contract with the later engineering workflow.

## Setup

```bash
npm install --prefix .claude   # yaml (+ typescript/@types/node for the type check)
claude                         # confirm folder trust (required for agent hooks)
```

Requirement: Node.js ≥ 22.18 in the PATH. The `.ts` scripts run directly via Node's type stripping – no build step.

## Structure

```
CLAUDE.md                      project context, rules, workflow (loaded every session)
CONTEXT.md                     glossary – the ubiquitous language (Matt Pocock's format)
.claude/
  settings.json                permissions + validation hook
  package.json, tsconfig.json  tooling dependencies and type check
  agents/                      product-owner, requirements-engineer, domain-architect, lead-dev
  skills/
    grilling/                  relentless interview in rounds (how every entry point asks questions)
    grill-me/                  /grill-me        – grill a plan or idea
    grill-with-docs/           /grill-with-docs – grill + record glossary terms and ADRs as we go
    event-storming/            /event-storming  – interactive workshop, starts by grilling the vision
    feature/                   /feature         – entry point for later features: grill → storm → model → stories
    domain-model/              language (CONTEXT.md), contexts, aggregates, data model
    architect/                 architecture decisions: ADR format, tech stack guide
    user-stories/              story rules, schema, validator, backlog renderer (loaded by RE/PO/lead dev)
    review-stories/            /review-stories  – PO + lead dev in parallel, approval
  hooks/
    validate-docs.ts           PostToolUse: validates events.yaml/stories after every write, renders Mermaid + backlog
    path-guard.ts              PreToolUse (per agent): only allows writes in the agent's own folders
  lib/discovery.ts             shared, deterministic logic
docs/                          all other artifacts (source of truth), ADRs in docs/adr/
```

## Principle: the LLM generates, code checks

| Task | Mechanism |
|---|---|
| Method (how?) | skills |
| Perspective (who reviews?) | subagents with restricted tools and write paths |
| Structure & consistency | JSON schemas + reference checks via hook (exit 2 → Claude must fix) |
| Visualization | `event-storming.md` is generated, manual edits are blocked |
| Backlog | `docs/stories/BACKLOG.md` is generated from the story files, manual edits are blocked |
| Decisions | ADRs start `proposed`, only you set `accepted`; stories become `ready` only after your approval |

Event storming, `/feature` and the grill skills deliberately run in the **main session**: subagents can't ask the user questions and don't know the conversation.

## Flow

```text
/event-storming                          # big picture
/event-storming defect reporting         # detailed flow, as often as needed
@domain-architect Derive bounded contexts, aggregates and the logical data model from docs/domain/events.yaml. Prepare ADR 0001 for the tech stack decision.
@requirements-engineer Derive stories for all commands in context BC-….
/review-stories
```

Later, for every new feature or change:
```text
/feature visitors attach photos to defect reports
/review-stories
```

`/grill-me` and `/grill-with-docs` work anytime to stress-test a plan.

Any time in between:
```bash
node .claude/skills/event-storming/scripts/validate-events.ts
node .claude/skills/user-stories/scripts/validate-stories.ts
node .claude/skills/user-stories/scripts/render-backlog.ts   # e.g. after deleting/renaming a story file
npm run --prefix .claude typecheck                           # after changing the tooling
```

## Story Status

`draft` → `review` → `ready` (size set, no `[OPEN]`) → `in-progress` → `done`

Discovery ends at `ready`. The engineering workflow sets `in-progress` and `done` directly in the story file; the backlog updates itself.

## Hand-off to the Engineering Workflow

The engineering workflow takes stories from `docs/stories/BACKLOG.md` (section "Ready", ordered by priority with dependencies first) and reads per story the story file, `CONTEXT.md`, `events.yaml`, `data-model.md` and the accepted ADRs in `docs/adr/`. The Gherkin scenarios are meant as acceptance tests 1:1.

## Limits

- `path-guard` applies to `Write`/`Edit`. That's why the role agents intentionally have no `Bash`.
- Hooks in agent files only run after you have confirmed the project folder as trusted.
- The backlog is regenerated on every story write. Files deleted or renamed via the shell need a manual `render-backlog.ts` run.
