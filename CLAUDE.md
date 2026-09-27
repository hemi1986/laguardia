# La Guardia

## Context
La Guardia is software for the pinball museum to manage its pinball machines: repairs, defects, manuals and a ticket system for reporting problems. The name is a joke: Fiorello La Guardia was the New York mayor who banned pinball in 1942.

## Phases: Discovery and Engineering
- **Discovery** produces the domain artifacts in `docs/` – including the backlog of user stories as Markdown files. It continues for new features (`/feature`).
- **Engineering** implements the `ready` stories one by one with `/implement`. The application is a Next.js monolith at the repository root (`docs/adr/0001-tech-stack.md`), set up by the foundation stories ST-001, ST-059 and ST-003. Code and discovery artifacts live in this one repository and change together.

## Sources of Truth
| Artifact | File | Owner |
|---|---|---|
| Vision, user groups, scope | `docs/product/vision.md` | user + product-owner |
| Glossary (ubiquitous language) | `CONTEXT.md` | domain-model skill (event storming, `/feature`, domain-architect, `/implement`) |
| Event storming model | `docs/domain/events.yaml` | event storming / domain-architect |
| Visualization (generated!) | `docs/domain/event-storming.md` | hook – never edit manually |
| Context map | `docs/domain/context-map.md` | domain-architect |
| Logical data model | `docs/architecture/data-model.md` | domain-architect |
| Architecture decisions (ADRs) | `docs/adr/` | architect skill / domain-architect (user accepts) |
| Stories | `docs/stories/ST-NNN-*.md` | requirements-engineer; status `in-progress`/`done` by `/implement` |
| Backlog (generated!) | `docs/stories/BACKLOG.md` | hook – never edit manually |
| Open questions | `docs/stories/OPEN_QUESTIONS.md` | everyone |
| Reviews | `docs/reviews/` | review-stories; per story `ST-NNN-code-review.md` (code-reviewer) and `ST-NNN-acceptance.md` (acceptance-tester) |
| Engineering conventions, seam catalog | `.claude/skills/engineering-conventions/SKILL.md` | written after ST-003, user approves |
| Application code and tests | repository root (`src/`, …) | `/implement` |

## Skills
| Skill | Covers |
|---|---|
| `grilling` (`/grill-me`) | relentless interview in rounds with recommended answers – how we ask questions |
| `domain-model` | language in `CONTEXT.md`, bounded contexts, aggregates, logical data model |
| `architect` | architectural decisions, ADRs, tech stack |
| `/grill-with-docs` | grilling + domain-model + architect: interview that writes glossary and ADRs as it goes |
| `/event-storming`, `/feature` | discovery entry points (see workflow); both start by grilling |
| `user-stories`, `/review-stories` | story format, validation, review |
| `/implement` | engineering entry point: one story test-first, verify, review, refactor, acceptance |
| `tdd` | red → green loop, good tests, seams |
| `codebase-design` | vocabulary for deep modules: module, interface, depth, seam, adapter, leverage, locality |
| `/improve-codebase-architecture` | periodic scan for deepening opportunities, then grilling on the chosen one |

## Rules
- **Everything in English**: artifacts, stories, Gherkin, glossary, code, comments. IDs are CamelCase with a prefix (`EVT-DefectReported`, `CMD-ReportDefect`). Only the UI texts are German (and English on visitor pages), from the message catalogs.
- Domain terms exactly as in `CONTEXT.md`, never an `_Avoid_` synonym – in docs and in code. New term → add it to `CONTEXT.md` first.
- **Don't guess.** Capture anything unclear as a hotspot (`HS-n` in `events.yaml`) or `[OPEN]` + an entry in `OPEN_QUESTIONS.md`. During implementation an unclear or wrong story goes back to `review` – never decide it in the code.
- `events.yaml` and stories are validated by a hook after every write, including story status changes. Fix hook errors immediately, never work around them.
- Decide the tech stack only after event storming and domain model, via ADR. New ADRs are `proposed`; only the user sets `accepted`. Accepted ADRs are never edited, only superseded (a hook enforces it).
- The backlog is local: stories are Markdown files in `docs/stories/`. No external issue tracker, no GitHub Issues.
- **Traceability in the code**: every Gherkin scenario has a test titled exactly `ST-NNN: <scenario title>`; commands, events, read models and policies carry their ID from `events.yaml`. `verify.ts` checks both.
- Story status changes go through `node .claude/skills/implement/scripts/story-status.ts`. A `done` story is never reopened – changes become a new story.
- Never weaken or delete a test to get green. One branch and one pull request per story; the user merges.
- Tooling in `.claude/` (hooks, validators, scripts) is TypeScript run directly by Node ≥ 22.18 (type stripping) – no Python, no build step. Erasable TypeScript syntax only. The application has its own build (Next.js).
- Subagents don't know this conversation: when delegating, always pass file paths and a clear task.
- At most 3 questions to the user at once – **except in grilling rounds**, which ask the whole frontier, each question with a recommended answer.

## Workflow
Initial discovery:
1. `/event-storming` – grills the vision, then big picture; afterwards `/event-storming <process>` for detailed flows
2. `@domain-architect` – contexts, aggregates, data model, glossary, ADR proposals (incl. tech stack)
3. `@requirements-engineer` – derive stories from events/commands
4. `/review-stories` – PO + lead dev in parallel, user approves → `status: ready`
5. Hand-off: `docs/stories/BACKLOG.md` lists all `ready` stories in implementation order for the engineering workflow

Later features and changes: `/feature <idea>` – grills the idea, runs a focused event storming, updates domain model/ADRs, derives stories (label `feature:<slug>`) and runs the story review on them – the user approves in that review.

Engineering, story by story: `/implement [ST-NNN]` (empty = next ready story whose dependencies are done):
1. Prepare – branch, `in-progress`, context pack from the discovery artifacts
2. Test plan – scenario → seam → test; **the user approves**
3. Red → green per scenario (`tdd`)
4. `verify.ts` – lint, module boundaries, types, tests, traceability
5. Review in parallel – `@code-reviewer`, `@acceptance-tester`, `/code-review`, `/security-review` where it applies
6. Refactor – fix findings; bigger ones become follow-up stories
7. Pull request, acceptance on the preview deployment, `done` – **the user accepts and merges**

After the foundation stories, per finished bounded context or about every 8–10 stories: `/improve-codebase-architecture`.

Anytime: `/grill-me` to stress-test a plan, `/grill-with-docs` to do the same while recording glossary terms and ADRs.
