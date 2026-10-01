---
id: ST-069
title: The acting person comes from the session in one place
type: tech-task
context: BC-Team
priority: must
size: S
risk: medium
events: []
depends_on: [ST-004, ST-073, ST-005]
labels: [follow-up, security]
status: in-progress
---

## Task
Follow-up of ST-003 (module structure, command layer, event journal): `docs/reviews/ST-003-code-review.md` finding #10 (follow-up section, "Security / authorization"). Related: `docs/reviews/ST-003-acceptance.md`, task bullet "Authorization check server-side".

`executeCommand(command, input, { actor })` in `src/platform/command/index.ts` checks the acting person's role against the command's allowed actors, but it trusts whatever `Actor` it is given. Once login exists (ST-004, Better Auth per `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`, `docs/adr/0004-team-authentication.md`), the acting person must come from the session, never from form data.

**Scope after the architecture review 2026-09-27 (decisions Q1–Q22, Q10).** ST-073 builds the Server Action runner – the only way from a form to a command, without any actor parameter, with the lint rule that stops code under `src/app/` from calling `executeCommand` directly. The runner gets the acting person from one function, `currentPerson()`. After ST-073, `currentPerson()` already delegates to the session lookup of ST-004 (a deactivated account currently counts as a visitor; decision of 2026-09-29 during `/implement ST-073`). This task **only changes `currentPerson()`** so that it covers the cases below – in particular rejecting a deactivated account; it builds the `Actor` from the session of the current request:
- signed in with an active team member account → a team member with that team member's ID and the role currently stored for the account (read again for every command, as ST-004 requires: "a role change or deactivation applies to the next action");
- no session, or a session that is expired, unknown or forged → a visitor;
- the system actor is never built from a session; automatic policies keep running only through `context.runAsSystem` (ST-003).

A deactivated account (ST-005) must not act: a command sent with the session of a deactivated account is rejected and stores nothing – also when the command allows visitors (e.g. `CMD-ReportProblem`); the login is requested. A deactivated team member never acts in that request, not even anonymously; after the session has ended they can report as a visitor (answer of the story review 2026-09-27, `docs/reviews/2026-09-27-story-review-st-067-073.md`).

**Ordering.** Right after ST-073 (the runner it builds on) and before ST-007, so the first team form that registers machines already gets the acting person from the session through the runner's `currentPerson()`. Revised on 2026-09-27 (`docs/reviews/2026-09-27-workflow-retrospective.md`): the earlier answer "right after ST-004, before ST-005" no longer holds, because ST-073 now comes after ST-006. ST-005 exists by then, so the deactivated-account criterion is tested with a deactivated account from ST-005.

The runner, its signature and its lint rule stay as ST-073 built them. Tests keep calling `executeCommand` with an explicit actor.

## Acceptance Criteria
- [ ] `currentPerson()` builds the acting person from the session of the current request; the runner (ST-073) and its signature are unchanged (evidence: the diff touches `currentPerson()` and its tests only, apart from the conventions).
- [ ] A command run through the runner by a signed-in helper is journaled with the actor team member, that helper's team member ID and the role helper (integration test via `journalOf`).
- [ ] A command run through the runner by a signed-in technician is journaled with the role technician.
- [ ] Without a session the actor is a visitor: a visitor-allowed command is journaled with the actor visitor, and a command allowed only for team members is rejected with `not-authorized` and stores neither a change nor a journal entry.
- [ ] An expired, unknown or tampered session cookie is treated like no session (actor visitor); the rejection reveals nothing about the session.
- [ ] After a technician changes a helper's role to technician, the helper's next command through the runner acts with the role technician, without logging in again.
- [ ] A command sent with the session of a deactivated account is rejected and stores neither a change nor a journal entry – also a visitor-allowed command such as `CMD-ReportProblem`, which is not run as a visitor (integration test with an account marked deactivated in the test data).
- [ ] A forged Server Action post by a signed-in helper that adds form fields such as `role=technician` or another team member's ID is still run as that helper: a technician-only command is rejected with `not-authorized` (browser or integration test).
- [ ] The engineering conventions (`.claude/skills/engineering-conventions/SKILL.md`) state that `currentPerson()` reads the session and that the system actor never comes from a session.

## Out of Scope
- The Server Action runner, its missing actor parameter and the lint rule against direct `executeCommand` calls under `src/app/` (ST-073)
- Login, sessions, logout and throttling themselves (ST-004)
- Creating, changing and deactivating accounts (ST-005)
- The CSRF Origin check in `src/proxy.ts` (ST-003) and the Content Security Policy (ST-070)
- Branded ID types (`docs/reviews/ST-003-code-review.md` finding #11)

## Open Questions
- none – both questions (deactivated account with a visitor-allowed command; order) were answered in the story review of 2026-09-27; the order was revised the same day in the workflow retrospective (see Task).
