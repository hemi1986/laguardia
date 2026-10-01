---
name: feature
description: Entry point for a new feature or change once the initial discovery is done – grills the idea, runs a focused event storming, updates domain model and ADRs, derives stories into the local backlog and runs the story review.
disable-model-invocation: true
argument-hint: "<feature idea, e.g. 'visitors attach photos to defect reports'>"
---

# New Feature

Feature idea: **$ARGUMENTS** (empty → ask the user for it first).
Pick a short kebab-case slug for it (e.g. `defect-photos`); stories get the label `feature:<slug>`.

## 1. Preparation
Read `docs/product/vision.md`, `CONTEXT.md`, `docs/domain/events.yaml`, `docs/domain/context-map.md`, `docs/architecture/data-model.md`, `docs/adr/`, `docs/stories/BACKLOG.md`. Find out what already exists for this idea (events, stories, hotspots) before asking anything.

## 2. Grill the idea
Call the Skill tool four times, for `grilling`, `domain-model`, `architect` and `ux-design` (the first three are the set of `/grill-with-docs`, which can't be called from a skill). Grill the user until the frontier is empty and they confirm a shared understanding. Typical branches:
- Which problem, for which user group, and what value? Measurable outcome?
- Does it fit the vision, or touch a non-goal? If it changes scope → update `docs/product/vision.md` with the user.
- Which existing processes, events and stories does it change? What's explicitly out of scope?
- **Does a person see anything?** Almost always yes – then the UX frontier of `ux-design` belongs in the rounds: entry point, the screen's one job, what is shown before acting, what happens afterwards, the rejected, empty, full and no-permission cases, and the German wording. A feature whose screens nobody named gets them by accident. Stories with a frontend part get the label `ui`.
- New or changed terms → `CONTEXT.md` inline.
- An architectural trade-off → ADR (`status: proposed`) only if the architect skill's three criteria hold.

Don't move on before the user confirms.

## 3. Focused event storming
Read `.claude/skills/event-storming/SKILL.md` and follow it with the feature as focus: phases 1–6 (phase 0 is covered by step 2), 7–8 only if aggregates or contexts are affected. Capture the feature as its own flow (`FLOW-<FeatureName>`) and write `docs/domain/events.yaml` after every phase.

## 4. Domain model & architecture
- Contexts, aggregates or the data model affected → delegate to `domain-architect` with the file paths, the changed/new IDs from `events.yaml` and a clear task.
- An architectural trade-off came up that wasn't recorded during grilling → offer an ADR per the architect skill's three criteria (`status: proposed`, the user accepts).

## 5. Stories
Delegate to `requirements-engineer`: derive stories for the feature's new or changed commands, policies and read models; name the event/command IDs, the label `feature:<slug>`, the label `ui` for every story with a frontend part, the UX decisions from step 2, and existing stories that need revising. Finished stories get `status: review`; have it report the IDs of all stories it created or revised.

## 6. Review
Read `.claude/skills/review-stories/SKILL.md` and follow it with the story IDs from step 5 as `$ARGUMENTS` (only this feature's stories, not everything in `review`). The user still approves every change and every `ready`.

## 7. Wrap-up
Summarize: glossary changes, new/changed events, ADRs proposed, stories created and their review outcome (`ready` vs. still open), open hotspots/questions. Point to `docs/stories/BACKLOG.md`, where `ready` stories are queued for the engineering workflow.
