---
id: ST-073
title: Server Action runner – the one way from a form to a command
type: tech-task
context: BC-Repair
priority: must
size: L
risk: medium
events: []
depends_on: [ST-071]
labels: [foundation, architecture]
status: in-progress
---

## Task
Implements the form and Server Action decisions of the architecture review 2026-09-27 (decisions Q1–Q22, grilling session with `/improve-codebase-architecture`): **Q9, Q10, Q18, Q19, Q22**, and – moved here from ST-074 on 2026-09-27 – the typed acting person **Q5/Q20** and the test-seam rules **Q3**. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

**Ordering.** Before ST-007 (register a machine), the first team form after the foundation; every later form uses the runner (the files of those stories are not changed by this task). It depends only on ST-071 (the command shape). The backlog restructuring of 2026-09-27 (workflow retrospective: foundation work is pulled in just in time) dissolved ST-074 and ST-072: the typed acting person the runner hands on is built here; the event catalogue moved to ST-050, `context.run` to ST-018, the insert-only history helper to ST-012; the photo module and forms with a photo moved to ST-016. ST-069 later changes only `currentPerson()`.

Today the spike's Server Action (`src/app/actions.ts`) calls `executeCommand` with a literal visitor, turns a rejection into a redirect with `?error=…` and loses what the person typed. The review decided:

- **Q9 – form state with React 19 `useActionState`.** The action returns `{ error, values }`; the form shows the catalogue text for the error code (`teamMessages` or `visitorMessages(locale)`, "Command errors map to catalog texts by their kebab-case code") and keeps the input. It works without JavaScript.
- **Q10 – one runner.** The runner is the only way from a form to a command. It gets the acting person from one function, `currentPerson()`, which delegates to the session lookup ST-004 built (a visitor without a session); ST-069 later changes only that function (a deactivated account is rejected). `actingPerson()` in `src/app/team-session.ts` is removed; the ST-005 account actions also get the acting person from the runner's `currentPerson()` (user decision 2026-09-29, during `/implement ST-073`). A Server Action cannot pass its own actor: the runner has no parameter for an actor, a role or a team member ID, and code under `src/app/` outside the runner cannot call `executeCommand`.
- **Q18 – location.** The runner lives in `src/app/_actions/` (a private folder, not a route) and belongs to the app element of the lint rules (`eslint.config.mjs`).
- **Q19 – form data to command input** through a small typed function per action, without a schema library. Domain validation stays in the command's decision (ST-071); the function only reads and converts fields. A missing or empty field becomes an empty value, and the command's decision decides – it rejects the command when the field is required – for a text field an empty string, and the same for fields that are not free text: e.g. a missing machine model in the register-machine form (ST-007, an ID field) becomes "no machine model given", which CMD-RegisterMachine rejects ("Machine model and location are required"), while a missing museum number – optional there – becomes "no museum number given" and is assigned by the command. Never a guessed default in the input function and never an exception.
- **Q5/Q20 – typed acting person (moved from ST-074).** The type of the acting person a decision receives follows from the command's `allowedActors`: a command for team members only gets a team member with ID and role, without narrowing. No new glossary term: `Actor` stays the technical type (visitor | team member | system); the problem report keeps its domain type `Reporter` (`docs/architecture/data-model.md`), derived from the acting person in one place; every "… by" is a `TeamMemberId`. The duplicate `Role` and `Reporter` definitions disappear.
- **Q3 – test seams (moved from ST-074).** Commands are tested at the command seam (`executeCommand` against PostgreSQL). Pure decisions get table tests only where a rule has many cases. Read-model tests set up their data through commands.
- **Photos.** Forms with a photo (the photo module's "store, run, delete on failure") are built with ST-016, the first form with a photo.
- **Q22 – conversion.** Converts the spike's problem report form (`src/app/page.tsx`, `src/app/actions.ts`, CMD-ReportProblem). The spike photo page is not converted; ST-066 removes it.

## Acceptance Criteria
- [ ] The spike's problem report form runs CMD-ReportProblem through the runner; a report with a description is stored and shown in the list (existing browser test `e2e/report-problem.spec.ts` stays green).
- [ ] A rejected command shows the catalogue text for its error code and keeps the typed description in the field: a description of only spaces shows the `description-required` text of the visitor catalogue (browser test at 360 px).
- [ ] The same rejection works without JavaScript: with JavaScript disabled, the page after submitting shows the catalogue text and the typed input (browser test with JavaScript disabled).
- [ ] The action result is `{ error, values }` on rejection; `not-authorized`, `not-found` and `version-conflict` also map to catalogue texts (unit test over the mapping; every error code of the converted command has a text).
- [ ] The runner has no parameter for an actor, a role or a team member ID; the acting person comes only from `currentPerson()`, which delegates to the session lookup of ST-004 – without a session the journal entry of a report through the runner has the actor visitor (type check, and an integration test of the runner with the acting person it is given).
- [ ] A Server Action cannot pass its own actor: a deliberate call of `executeCommand` from a file under `src/app/` outside `src/app/_actions/` makes `npm run verify` fail with a message that names the runner; demonstrated and then removed (case in `src/platform/module-boundaries.test.ts`). Test files may still call `executeCommand` directly.
- [ ] Extra form fields do not change who acts: a forged post that adds `actor`, `role` or `teamMemberId` fields is still run as the person from `currentPerson()` (integration test of the action).
- [ ] Form data becomes command input through a typed function per action; a missing field becomes an empty value that the command's decision rejects, not an exception (unit test of the report form's function).
- [ ] The same holds for a field that is not free text: an input function of a test stand-in action with an enum field and an ID field turns a post without those fields into input with "no value given" for both – no default value, no exception – and the stand-in command's decision rejects it with an error code that has a catalogue text (unit test of the function, integration test of the action).
- [ ] The engineering conventions state the empty-field rule with the non-string example of ST-007 (a missing machine model becomes "no machine model given" and is rejected by CMD-RegisterMachine; the input function never fills in a default).
- [ ] The runner lives in `src/app/_actions/`; the lint rules treat it as part of the app element (`src/platform/module-boundaries.test.ts`).
- [ ] The converted form is usable at 360 px width: page width ≤ 360 px, error text and input visible without horizontal scrolling (browser test).
- [ ] Converts the existing code (no test weakened); `npm run verify -- --e2e` is green.
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "a Server Action only calls the runner", `currentPerson()`, `{ error, values }` with `useActionState`, the per-action input function, the `src/app/_actions/` location, and the seam catalog row for Server Actions.

### Foundation (moved from ST-074 on 2026-09-27 – architecture review Q3, Q5/Q20)
- [ ] A command allowed for `helper` and `technician` only gets a team member with `teamMemberId: TeamMemberId` and `role` in its decision without narrowing (type test); a command that also allows visitors gets the union.
- [ ] `Role` and `Reporter` are each defined exactly once under `src/`, and `Reporter` is derived from the acting person in exactly one function: an automated check in `npm run verify` fails when a second type definition named `Role` or `Reporter` is added under `src/`; demonstrated with a deliberate duplicate and then removed.
- [ ] `src/modules/repair/problem-reports.integration.test.ts` sets up its problem reports through `executeCommand(reportProblemCommand, …)`, not through persistence functions (Q3).
- [ ] Every behaviour asserted by an existing test is still asserted – moved to the command seam where Q3 says so; no assertion is dropped (evidence: list old test → new test in the pull request). No test weakened.
- [ ] The engineering conventions update above also covers the acting person's type (Q5/Q20) and the seam catalog rows for commands, decisions and read models (Q3).

## Out of Scope
- Rejecting a deactivated account's command and the session-based tests of the acting person (ST-069)
- Forms with a photo and the photo module's "store, run, delete on failure" (ST-016)
- The event catalogue and its check against `events.yaml` (ST-050), `context.run` (ST-018), the insert-only history helper (ST-012)
- Keeping a chosen photo in the form after a rejection – the server cannot refill a file input; how the photo picker behaves is decided with ST-016
- Route handlers (e.g. Vercel Blob upload callbacks for files, ST-037) – they are not forms and verify their own signature
- The CSRF Origin check (`src/proxy.ts`, ST-003) and the Content Security Policy (ST-070)
- Converting the spike photo and file pages (removed by ST-066)

## Open Questions
- none
