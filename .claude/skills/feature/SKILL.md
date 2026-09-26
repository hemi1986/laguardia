---
name: feature
description: Entry point for a new feature or change once the initial discovery is done – grills the idea, runs a focused event storming, updates domain model and ADRs, and derives stories into the local backlog.
disable-model-invocation: true
argument-hint: "<feature idea, e.g. 'visitors attach photos to defect reports'>"
---

# New Feature

Feature idea: **$ARGUMENTS** (empty → ask the user for it first).
Pick a short kebab-case slug for it (e.g. `defect-photos`); stories get the label `feature:<slug>`.

## 1. Preparation
Read `docs/product/vision.md`, `CONTEXT.md`, `docs/domain/events.yaml`, `docs/domain/context-map.md`, `docs/architecture/data-model.md`, `docs/adr/`, `docs/stories/BACKLOG.md`. Find out what already exists for this idea (events, stories, hotspots) before asking anything.

## 2. Grill the idea
Call the Skill tool for `grilling` and `domain-model`. Grill the user until the frontier is empty and they confirm a shared understanding. Typical branches:
- Which problem, for which user group, and what value? Measurable outcome?
- Does it fit the vision, or touch a non-goal? If it changes scope → update `docs/product/vision.md` with the user.
- Which existing processes, events and stories does it change? What's explicitly out of scope?
- New or changed terms → `CONTEXT.md` inline.

Don't move on before the user confirms.

## 3. Focused event storming
Read `.claude/skills/event-storming/SKILL.md` and follow it with the feature as focus: phases 1–6 (phase 0 is covered by step 2), 7–8 only if aggregates or contexts are affected. Capture the feature as its own flow (`FLOW-<FeatureName>`) and write `docs/domain/events.yaml` after every phase.

## 4. Domain model & architecture
- Contexts, aggregates or the data model affected → delegate to `domain-architect` with the file paths, the changed/new IDs from `events.yaml` and a clear task.
- An architectural trade-off came up → call the Skill tool for `architect` and offer an ADR only if its three criteria hold (`status: proposed`, the user accepts).

## 5. Stories
Delegate to `requirements-engineer`: derive stories for the feature's new or changed commands, policies and read models; name the event/command IDs, the label `feature:<slug>`, and existing stories that need revising.

## 6. Wrap-up
Summarize: glossary changes, new/changed events, ADRs proposed, stories created, open hotspots/questions. Then point the user to `/review-stories` – approved stories show up as `ready` in `docs/stories/BACKLOG.md`.
