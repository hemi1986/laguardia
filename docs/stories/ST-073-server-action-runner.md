---
id: ST-073
title: Server Action runner – the one way from a form to a command
type: tech-task
context: BC-Repair
priority: must
size: M
risk: medium
events: []
depends_on: [ST-071, ST-072, ST-074]
labels: [foundation, architecture]
status: ready
---

## Task
Implements the form and Server Action decisions of the architecture review 2026-09-27 (decisions Q1–Q22, grilling session with `/improve-codebase-architecture`): **Q9, Q10, Q18, Q19, Q22**. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

**Ordering.** Before ST-007 (register a machine), the first team form after the foundation; every later form uses the runner (the files of those stories are not changed by this task). It depends on ST-071 (the command shape), ST-074 (the typed acting person the runner hands on) and ST-072 (forms with a photo go through the photo module's "store, run, delete on failure"). ST-069 later replaces only `currentPerson()`.

Today the spike's Server Action (`src/app/actions.ts`) calls `executeCommand` with a literal visitor, turns a rejection into a redirect with `?error=…` and loses what the person typed. The review decided:

- **Q9 – form state with React 19 `useActionState`.** The action returns `{ error, values }`; the form shows the catalogue text for the error code (`teamMessages` or `visitorMessages(locale)`, "Command errors map to catalog texts by their kebab-case code") and keeps the input. It works without JavaScript.
- **Q10 – one runner.** The runner is the only way from a form to a command. It gets the acting person from one function, `currentPerson()`, which returns a visitor until login exists (ST-004); ST-069 later changes only that function to read the session. A Server Action cannot pass its own actor: the runner has no parameter for an actor, a role or a team member ID, and code under `src/app/` outside the runner cannot call `executeCommand`.
- **Q18 – location.** The runner lives in `src/app/_actions/` (a private folder, not a route) and belongs to the app element of the lint rules (`eslint.config.mjs`).
- **Q19 – form data to command input** through a small typed function per action, without a schema library. Domain validation stays in the command's decision (ST-071); the function only reads and converts fields. A missing or empty field becomes an empty value, and the command's decision decides – it rejects the command when the field is required – for a text field an empty string, and the same for fields that are not free text: e.g. a missing machine model in the register-machine form (ST-007, an ID field) becomes "no machine model given", which CMD-RegisterMachine rejects ("Machine model and location are required"), while a missing museum number – optional there – becomes "no museum number given" and is assigned by the command. Never a guessed default in the input function and never an exception.
- **Photos.** A form with a photo runs its command through the photo module's "store, run, delete on failure" (ST-072), so a rejected form leaves no stored photo.
- **Q22 – conversion.** Converts the spike's problem report form (`src/app/page.tsx`, `src/app/actions.ts`, CMD-ReportProblem). The spike photo page is not converted; ST-066 removes it.

## Acceptance Criteria
- [ ] The spike's problem report form runs CMD-ReportProblem through the runner; a report with a description is stored and shown in the list (existing browser test `e2e/report-problem.spec.ts` stays green).
- [ ] A rejected command shows the catalogue text for its error code and keeps the typed description in the field: a description of only spaces shows the `description-required` text of the visitor catalogue (browser test at 360 px).
- [ ] The same rejection works without JavaScript: with JavaScript disabled, the page after submitting shows the catalogue text and the typed input (browser test with JavaScript disabled).
- [ ] The action result is `{ error, values }` on rejection; `not-authorized`, `not-found` and `version-conflict` also map to catalogue texts (unit test over the mapping; every error code of the converted command has a text).
- [ ] The runner has no parameter for an actor, a role or a team member ID; the acting person comes only from `currentPerson()`, which returns a visitor (type check, and a unit or integration test that the journal entry of a report through the runner has the actor visitor).
- [ ] A Server Action cannot pass its own actor: a deliberate call of `executeCommand` from a file under `src/app/` outside `src/app/_actions/` makes `npm run verify` fail with a message that names the runner; demonstrated and then removed (case in `src/platform/module-boundaries.test.ts`). Test files may still call `executeCommand` directly.
- [ ] Extra form fields do not change who acts: a forged post that adds `actor`, `role` or `teamMemberId` fields is still run as the person from `currentPerson()` (integration test of the action).
- [ ] Form data becomes command input through a typed function per action; a missing field becomes an empty value that the command's decision rejects, not an exception (unit test of the report form's function).
- [ ] The same holds for a field that is not free text: an input function of a test stand-in action with an enum field and an ID field turns a post without those fields into input with "no value given" for both – no default value, no exception – and the stand-in command's decision rejects it with an error code that has a catalogue text (unit test of the function, integration test of the action).
- [ ] The engineering conventions state the empty-field rule with the non-string example of ST-007 (a missing machine model becomes "no machine model given" and is rejected by CMD-RegisterMachine; the input function never fills in a default).
- [ ] A form with a photo runs through the photo module's store-run-delete: when its command is rejected, the action returns `{ error, values }` and no photo is stored (integration test with a test stand-in command and the in-memory storage adapter).
- [ ] The runner lives in `src/app/_actions/`; the lint rules treat it as part of the app element (`src/platform/module-boundaries.test.ts`).
- [ ] The converted form is usable at 360 px width: page width ≤ 360 px, error text and input visible without horizontal scrolling (browser test).
- [ ] Converts the existing code (no test weakened); `npm run verify -- --e2e` is green.
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "a Server Action only calls the runner", `currentPerson()`, `{ error, values }` with `useActionState`, the per-action input function, the `src/app/_actions/` location, and the seam catalog row for Server Actions.

## Out of Scope
- Reading the acting person from the session (ST-069; needs ST-004)
- Keeping a chosen photo in the form after a rejection – the server cannot refill a file input; how the photo picker behaves is decided with ST-016
- Route handlers (e.g. Vercel Blob upload callbacks for files, ST-037) – they are not forms and verify their own signature
- The CSRF Origin check (`src/proxy.ts`, ST-003) and the Content Security Policy (ST-070)
- Converting the spike photo and file pages (removed by ST-066)

## Open Questions
- none
