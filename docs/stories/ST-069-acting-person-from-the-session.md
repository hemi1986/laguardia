---
id: ST-069
title: The acting person comes from the session in one place
type: tech-task
context: BC-Team
priority: should
size: S
risk: medium
events: []
depends_on: [ST-004]
labels: [follow-up, security]
status: draft
---

## Task
Follow-up of ST-003 (module structure, command layer, event journal): `docs/reviews/ST-003-code-review.md` finding #10 (follow-up section, "Security / authorization"). Related: `docs/reviews/ST-003-acceptance.md`, task bullet "Authorization check server-side".

Today `executeCommand(command, input, { actor })` in `src/platform/command/index.ts` checks the acting person's role against the command's allowed actors, but it trusts whatever `Actor` the calling Server Action passes in. The ST-001 spike action in `src/app/actions.ts` hard-codes a visitor. Once login exists (ST-004, Better Auth per `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`, `docs/adr/0004-team-authentication.md`), one mistake in one Server Action – e.g. a role taken from form data, or a team member ID from a hidden field – would bypass authorization.

Provide exactly one server-side entry point through which Server Actions run commands. It builds the `Actor` from the session of the current request:
- signed in with an active team member account → a team member with that team member's ID and the role currently stored for the account (read again for every command, as ST-004 requires: "a role change or deactivation applies to the next action");
- no session, or a session that is expired, unknown or forged → a visitor;
- the system actor is never built from a session; automatic policies keep running only through `context.runAsSystem` (ST-003).

A deactivated account (ST-005) must not act: a command sent with the session of a deactivated account is rejected and stores nothing. [OPEN] Whether such a command is rejected outright or runs as a visitor (e.g. a visitor-allowed command like `CMD-ReportProblem`) is not decided – see Open Questions.

Server Actions under `src/app/` must no longer be able to supply an actor themselves: the entry point takes no actor argument, and the lint (module boundary rules from ST-003) or the type check stops code under `src/app/` from calling `executeCommand` with an actor directly. Tests keep calling `executeCommand` with an explicit actor.

## Acceptance Criteria
- [ ] One server-side entry point runs a command for the current request and builds the actor from the session; it has no parameter through which a caller can pass an actor, a role or a team member ID.
- [ ] A deliberate call of `executeCommand` with an explicit actor from a file under `src/app/` makes `npm run lint` or the type check of `npm run verify` fail with a message that names the entry point; demonstrated and then removed. Test files may still call `executeCommand` directly.
- [ ] A command run through the entry point by a signed-in helper is journaled with the actor team member, that helper's team member ID and the role helper (integration test via `journalOf`).
- [ ] A command run through the entry point by a signed-in technician is journaled with the role technician.
- [ ] Without a session the actor is a visitor: a visitor-allowed command is journaled with the actor visitor, and a command allowed only for team members is rejected with `not-authorized` and stores neither a change nor a journal entry.
- [ ] An expired, unknown or tampered session cookie is treated like no session (actor visitor); the rejection reveals nothing about the session.
- [ ] After a technician changes a helper's role to technician, the helper's next command through the entry point acts with the role technician, without logging in again.
- [ ] A command sent with the session of a deactivated account stores neither a change nor a journal entry (behaviour for visitor-allowed commands per the answer to the open question).
- [ ] A forged Server Action post by a signed-in helper that adds form fields such as `role=technician` or another team member's ID is still run as that helper: a technician-only command is rejected with `not-authorized` (browser or integration test).
- [ ] No file under `src/app/` calls `executeCommand` with a literal actor any more (the spike action in `src/app/actions.ts` uses the entry point or has been removed by ST-066).
- [ ] The engineering conventions (`.claude/skills/engineering-conventions/SKILL.md`) name the entry point as the only way Server Actions run commands.

## Out of Scope
- Login, sessions, logout and throttling themselves (ST-004)
- Creating, changing and deactivating accounts (ST-005)
- The CSRF Origin check in `src/proxy.ts` (ST-003) and the Content Security Policy (ST-070)
- Branded ID types (`docs/reviews/ST-003-code-review.md` finding #11)

## Open Questions
- [OPEN] What happens to a command sent with the session of a deactivated account when the command also allows visitors (e.g. `CMD-ReportProblem` from the visitor machine page)? Options: (a) rejected like every other command, the login is requested; (b) the session is ended and the command runs as a visitor. Recommendation: (a) – a deactivated team member never acts, not even anonymously in that request; they can still report as a visitor after the session has ended.
- [OPEN] ST-004 does not say whether an account can already be marked deactivated before ST-005 exists. Should this task be done right after ST-004 and before ST-005 (so ST-005's Server Actions already use the entry point, and the deactivated-account item is tested with an account marked deactivated in the test data), or after ST-005 (then `depends_on: [ST-004, ST-005]`)? Recommendation: right after ST-004, before ST-005; if the deactivated state only arrives with ST-005, ST-005 carries the deactivated-account check through the entry point.
