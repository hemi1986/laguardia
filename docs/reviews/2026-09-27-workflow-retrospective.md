# Workflow retrospective 2026-09-27

After the foundation stories (ST-001, ST-002, ST-059, ST-003), the architecture review and two story reviews.

## Observation
- 4 stories were done in one day, 11 were added (ST-065 to ST-075) – all tech tasks: 7 follow-ups from reviews, 4 from the architecture review (one of them only a split). The 55 domain stories were unchanged, none started.
- Before the first machine could be registered (ST-007), five `must` tech tasks stood in the backlog. The backlog order is priority first, then dependencies, so a `must` tech task with met dependencies jumps ahead of every domain story.
- Four reviewers per story (code reviewer, acceptance tester, `/code-review`, `/security-review`) always find something, and "too big for this story → follow-up story" turned every finding into backlog. Nothing asked whether a finding was worth a story.
- ST-003 took about 2.5 hours including reviews; one volunteer maintainer (`docs/product/vision.md`) cannot sustain that ceremony for 55 domain stories.

## Decisions (user, 2026-09-27)
1. **Foundation just in time** – technical groundwork goes into the first story that needs it. ST-072 (photo module) → ST-016; ST-074 (event catalogue → ST-050, typed acting person → ST-073, history helper → ST-012, `context.run` → ST-018); ST-075 (preview database for CI) → ST-068; ST-070 (CSP) waits for ST-013. Only ST-071 (command shape) stays ahead of ST-004, which needs it.
2. **Follow-up hurdle** – a finding becomes a new story only if it is a security or data-loss risk or blocks a named story, cannot be fixed in the story within about an hour, and no existing story can take it; otherwise it is a line in the review file (`.claude/skills/implement/SKILL.md`, step 6).
3. **Reviews scaled to the story** – code reviewer and acceptance tester always; `/code-review` for size L/XL or shared platform code; `/security-review` for visitor, login/roles, uploads, files (step 5).
4. **Progress in domain stories and scenarios** – shown at the top of `docs/stories/BACKLOG.md`; `/improve-codebase-architecture` per finished bounded context or every 8–10 domain stories, not in between (`CLAUDE.md`).
5. **Domain stories back to back** after ST-071: ST-004 → ST-005 → ST-006 → ST-073 → ST-007.
6. **Consequences** (user, same day): ST-069 comes right after ST-073, before ST-007 (depends on ST-005, which exists by then); ST-020, ST-032, ST-037 and ST-054 depend on ST-016, which now builds the photo module and the storage seam; ST-016 stays size L – a split is decided at its test plan if needed.
