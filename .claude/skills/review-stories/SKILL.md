---
name: review-stories
description: Has stories reviewed in parallel by product-owner and lead-dev, consolidates the results and guides the user to approval (status ready).
disable-model-invocation: true
argument-hint: "[ST-IDs, empty = all with status review]"
---

# Story Review

1. **Selection**: Stories from `$ARGUMENTS`, or all with `status: review` in `docs/stories/`. None found → report and stop.
2. **Delegate in parallel** to `product-owner` and `lead-dev`, and to `ux-designer` for every story with the label `ui` or an obvious frontend part (none in the batch? say so – a set of stories where nobody sees anything is worth a second look). The subagents do not know this conversation: give the full file paths of the stories in the task and state the job clearly.
3. **Consolidate** into `docs/reviews/YYYY-MM-DD-story-review.md`:
   - per story: PO verdict + priority, lead-dev assessment (size, risk, split), UX findings and the scenarios they ask for, conflicts between them
   - list of proposed new stories/spikes/tech tasks
4. **Let the user decide**: present conflicts and recommendations (max. 3 questions at a time). Adopt nothing without consent.
5. **Apply**:
   - Content changes → delegate to `requirements-engineer` (referencing the review file).
   - Approved stories: set `status: ready` (only if `size` is set and no `[OPEN]` remains – the hook checks this).
6. Wrap-up: run `node .claude/skills/user-stories/scripts/validate-stories.ts`, show the status overview and point to `docs/stories/BACKLOG.md` (regenerated automatically), where `ready` stories are queued for the engineering workflow.
