# La Guardia – Discovery Workspace

## Context
La Guardia is software for the pinball museum to manage its pinball machines: repairs, defects, manuals and a ticket system for reporting problems. The name is a joke: Fiorello La Guardia was the New York mayor who banned pinball in 1942.

## Phase: Discovery
**No production code** is written in this repo. The output is domain artifacts in `docs/` – including the backlog of user stories as Markdown files – which a separate engineering workflow implements later.

## Sources of Truth
| Artifact | File | Owner |
|---|---|---|
| Vision, user groups, scope | `docs/product/vision.md` | user + product-owner |
| Glossary (ubiquitous language) | `CONTEXT.md` | domain-model skill (event storming, `/feature`, domain-architect) |
| Event storming model | `docs/domain/events.yaml` | event storming / domain-architect |
| Visualization (generated!) | `docs/domain/event-storming.md` | hook – never edit manually |
| Context map | `docs/domain/context-map.md` | domain-architect |
| Logical data model | `docs/architecture/data-model.md` | domain-architect |
| Architecture decisions (ADRs) | `docs/adr/` | architect skill / domain-architect (user accepts) |
| Stories | `docs/stories/ST-NNN-*.md` | requirements-engineer |
| Backlog (generated!) | `docs/stories/BACKLOG.md` | hook – never edit manually |
| Open questions | `docs/stories/OPEN_QUESTIONS.md` | everyone |
| Reviews | `docs/reviews/` | review-stories |

## Skills
| Skill | Covers |
|---|---|
| `grilling` (`/grill-me`) | relentless interview in rounds with recommended answers – how we ask questions |
| `domain-model` | language in `CONTEXT.md`, bounded contexts, aggregates, logical data model |
| `architect` | architectural decisions, ADRs, tech stack |
| `/grill-with-docs` | grilling + domain-model + architect: interview that writes glossary and ADRs as it goes |
| `/event-storming`, `/feature` | entry points (see workflow); both start by grilling |
| `user-stories`, `/review-stories` | story format, validation, review |

## Rules
- **Everything in English**: artifacts, stories, Gherkin, glossary, code, comments. IDs are CamelCase with a prefix (`EVT-DefectReported`, `CMD-ReportDefect`).
- Domain terms exactly as in `CONTEXT.md`, never an `_Avoid_` synonym. New term → add it to `CONTEXT.md` first.
- **Don't guess.** Capture anything unclear as a hotspot (`HS-n` in `events.yaml`) or `[OPEN]` + an entry in `OPEN_QUESTIONS.md`.
- `events.yaml` and stories are validated by a hook after every write. Fix hook errors immediately, never work around them.
- Decide the tech stack only after event storming and domain model, via ADR. New ADRs are `proposed`; only the user sets `accepted`.
- The backlog is local: stories are Markdown files in `docs/stories/`. No external issue tracker, no GitHub Issues.
- Tooling (hooks, validators, renderers) is TypeScript run directly by Node ≥ 22.18 (type stripping) – no Python, no build step. Erasable TypeScript syntax only.
- Subagents don't know this conversation: when delegating, always pass file paths and a clear task.
- At most 3 questions to the user at once – **except in grilling rounds**, which ask the whole frontier, each question with a recommended answer.

## Workflow
Initial discovery:
1. `/event-storming` – grills the vision, then big picture; afterwards `/event-storming <process>` for detailed flows
2. `@domain-architect` – contexts, aggregates, data model, glossary, ADR proposals (incl. tech stack)
3. `@requirements-engineer` – derive stories from events/commands
4. `/review-stories` – PO + lead dev in parallel, user approves → `status: ready`
5. Hand-off: `docs/stories/BACKLOG.md` lists all `ready` stories in implementation order for the engineering workflow

Later features and changes: `/feature <idea>` – grills the idea, runs a focused event storming, updates domain model/ADRs, derives stories (label `feature:<slug>`), then `/review-stories`.

Anytime: `/grill-me` to stress-test a plan, `/grill-with-docs` to do the same while recording glossary terms and ADRs.
