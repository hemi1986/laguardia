---
name: user-stories
description: Rules, format and splitting patterns for user stories, spikes and tech tasks in docs/stories/ (frontmatter, INVEST, Gherkin, status workflow, local backlog).
---

# User Stories

The backlog is local: every story is a Markdown file in `docs/stories/`. There is no external issue tracker.
`docs/stories/BACKLOG.md` is generated from the story files by a hook – never edit it manually.

## Derivation from the Event Storming
| Source in `events.yaml` | typically becomes |
|---|---|
| Actor + command → event | Story "As a <actor>, I want to <command>, so that <effect>" |
| Policy (automatic) | Story from the beneficiary's perspective ("… I am notified when …") |
| Read model | Story about finding/seeing information |
| Hotspot | Spike (question + timebox) or `[OPEN]` in the story |
| External system | Story or tech task for the integration |

Every story links the affected events (`events: [EVT-…]`). Commands without a story = gap → report it.

## File & Frontmatter
File: `docs/stories/ST-NNN-short-title.md` (three-digit number, consecutive, never reused).
Template: `templates/story-template.md`. Schema: `schema/story.schema.json`.

| Field | Required | Who sets it |
|---|---|---|
| `id`, `title`, `type`, `context`, `events` | yes | requirements-engineer |
| `priority` (`must/should/could/wont`) | yes | product-owner (initially `should`) |
| `size` (`XS–XL`), `risk`, `depends_on` | before `ready` | lead-dev |
| `labels` | no | anyone (lowercase, e.g. `mvp`) |
| `status` | yes | see workflow |

## Status Workflow
`draft` (in progress) → `review` (finished, waiting for PO + lead-dev) → `ready` (after user approval; `size` set, no `[OPEN]`) → `in-progress` → `done`.

Discovery ends at `ready`. `in-progress` and `done` are set later by the engineering workflow directly in the story file.

## Body Structure
```
## Story
As a <role from CONTEXT.md>, I want <goal>, so that <business benefit>.

## Context
Briefly: trigger, preconditions, business rules (from the command's `rules`).

## Acceptance Criteria
Scenario: <Happy path>
  Given …
  When …
  Then …

Scenario: <Error or edge case>
  …

## Out of Scope
## Open Questions
```
Spikes: `## Question`, `## Timebox`, `## Acceptance Criteria` (checklist `- [ ] …`).
Tech tasks: `## Task`, `## Acceptance Criteria` (checklist).

## Quality Rules
- **INVEST**: independent, negotiable, valuable, estimable, small, testable.
- Gherkin in English (`Given / When / Then / And / But`). At least a happy path + one error/edge case.
- Scenarios describe **behavior**, not UI details ("clicks the blue button" ✗) and not technology.
- Measurable outcomes: "Then the pinball machine has the status 'out of order'" instead of "Then it works".
- Non-functional requirements as concrete scenarios or checklist items with a number.
- Terms exactly as in the glossary `CONTEXT.md`; never use an `_Avoid_` synonym.

## Splitting Patterns (if larger than M)
By workflow step · by business rule · happy path first, special cases later · by data variant · by role · "manual first, automated later".

## Validation
A hook checks every written story automatically and regenerates `BACKLOG.md`. Full check of all stories:
`node .claude/skills/user-stories/scripts/validate-stories.ts`
After deleting or renaming story files, regenerate the backlog:
`node .claude/skills/user-stories/scripts/render-backlog.ts`
