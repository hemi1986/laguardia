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
| `labels` | no | anyone (lowercase, e.g. `mvp`, `feature:<slug>`) |

**No implementation foundation inside a domain story** (user, 2026-10-01). A story describes behaviour a person
can observe; technical groundwork that several stories need is its own **tech task**, with its own `depends_on`.
A checklist of files to create, layers to convert or configs to set is an implementation plan, not acceptance
criteria – it is neither the user's language nor a testable outcome, and it hides the real size of the story.
*Why this is a rule:* ST-050 carried a seven-item checklist that converted **every command built so far** to an
event catalogue. That made an M story an L, put a retrofit nine dependencies deep, and the cost grew with every
command built before it. The grooming of 2026-10-01 pulled it out as ST-079 and ST-050 went back to M.
The exception is a tech task or a spike – there a checklist *is* the acceptance criteria.

**The `ui` label** marks every story with a frontend part – a screen, a form, a flow a person walks through.
`/review-stories` and `/groom-backlog` route those to the `ux-designer`, so a missing label means a story nobody
reviews from that side. What such a story has to say about the interface (and what it must not) is in the
`ux-design` skill; the decisions it is measured against are `docs/product/ux-guidelines.md`.
| `status` | yes | see workflow |

## Backlog Order

`docs/stories/BACKLOG.md` is generated (`scripts/render-backlog.ts`) and the order is **derived on every render,
never stored**. `backlogOrder` in `.claude/lib/discovery.ts` sorts:

1. by `priority` – `must`, `should`, `could`, `wont`;
2. within the same priority **by story ID, ascending**;
3. then dependencies first – a story that a listed story depends on is pulled in front of it.

What follows from that, and has caught us out before (story review 2026-09-29):

- **Numbers decide within a priority.** A story with a higher ID never overtakes a lower one, so a new tech task
  always lands *behind* the older stories it is meant to precede. Raising it to `must` does not help when those
  are `must` too.
- **`depends_on` is the only thing that really moves a story forward** – and it is for real dependencies, not
  for planning wishes. Do not invent one to force an order.
- **So say it out loud when a story is built out of turn**: `/implement ST-NNN` with the ID, never the bare
  `/implement` (which follows this very order via `next-story.ts`), and record the intended order in the
  story's Notes so the next person sees why.

There is no script that re-sorts the backlog, because there is nothing to sort – only story files and this rule.

## Status Workflow
`draft` (in progress) → `review` (finished, waiting for PO + lead-dev) → `ready` (after user approval; `size` set, no `[OPEN]`) → `in-progress` → `done`.

Discovery ends at `ready`. The engineering workflow (`/implement`) sets `in-progress` and `done` with `node .claude/skills/implement/scripts/story-status.ts`; the validation hook enforces the same rules when the file is edited directly:
- `in-progress` and `done` need all `depends_on` stories `done`.
- `done` needs a test titled `ST-NNN: <scenario title>` for every scenario (story), or every checklist item ticked `- [x]` (spike, tech task).
- A story that turns out wrong during implementation goes from `in-progress` (or `ready`) back to `review`, with `[OPEN]` + an entry in `OPEN_QUESTIONS.md`; it is revised and approved again.
- `done` is final. A change to finished behaviour is a new story.

## Body Structure
```
## Story
As a <role from CONTEXT.md>, I want <goal>, so that <business benefit>.

## Context
Briefly: trigger, preconditions, business rules – from the command's `rules` **and from the `invariants` of its
aggregate**. Since 2026-10-01 an invariant is stated once, on the aggregate, and a command's `rules` list only what
it adds beyond them (user's decision; `docs/domain/events.yaml`). So a command with few rules is not a command with
few rules to test: read its aggregate's `invariants` and give every one the command can violate its own rejection
scenario. "A machine model always has a title, a manufacturer and exactly one machine category" is why
`CMD-CorrectMachineModel` needs a scenario for an emptied title, although its `rules` do not mention it.

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
Scenario titles are unique within a story and become test titles (`ST-NNN: <scenario title>`). Renaming a scenario of an `in-progress` or `done` story breaks that link – the test must be renamed too (`verify.ts` reports it).

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
