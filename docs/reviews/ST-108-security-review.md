# Security review – ST-108: An AI assessment that fails or breaks off says why and can be tried again

Branch `st-108-failed-and-broken-off-ai-assessments`, base `main`, 2026-11-01 (`/security-review` during `/implement`,
as the story's Definition of done requires).
Scope: only what this story adds – the defect page's start of a run, the retry Server Action and its form, and the two
new public queries. Read: `git diff main...HEAD` (15 files), the context pack, ADR 0015 in full, conventions *Security*,
*Background work* and *Server Actions and forms*, the command/work/query code the change touches.

**Result: no blocker, no major. Three minor findings (one test gap, one foot-gun for ST-111, one accepted residual).
The defect page's GET does not start paid work on its own: it is authenticated, it starts the worker only after a hold
ran out, and the broken-off piece itself sends nothing to OpenRouter.**

## Findings

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction | Follow-up? |
|---|---|---|---|---|---|---|---|
| S1 | minor | Test gap – security regression guard | `src/app/(team)/team/defects/[defectId]/ai-assessment-failure.integration.test.ts:235-249`, `:195` | The „Erneut versuchen“ scenario fetches the input itself (`aiAssessmentRetryRequest`) and drives `formRunner` directly with a hand-built definition, posting an empty `FormData`; it never calls `retryAiAssessmentAction` and never posts forged fields. Nothing fails if the action's `requireTeamMember()` is removed or moved after the read, or if the input is later wired to a form field – exactly the two properties the DoD asks to review. The test's page helper also uses a dummy action (`:195`). | Conventions *Server Actions and forms* (access check before the runner; bound values treated like form fields); story DoD (`/security-review`: a defect page's GET that starts paid work) | One integration test at the action seam: (a) no/expired session → redirect, no `ai_assessment` row; (b) helper on a defect not suitable for helpers → `ai-assessment-not-allowed-for-helpers`; (c) `FormData` carrying `note`/`photos`/`defectId` → the new row still carries the failed one's input. | **skipped minor** – fits this story in under an hour; no current security risk, so no follow-up story. |
| S2 | minor | Read model – foot-gun | `src/modules/ai-assistance/ai-assessments.ts:123-130` (exported at `src/modules/ai-assistance/index.ts:16`) | `aiAssessmentsOfDefect` returns every assessment's free-text `note`, `photos` (storage names, not signed addresses), `requestedBy` (team-member ID), `filesSearched` (file IDs) and `cost`, with no viewer and without `defectAiAssessments`' `shown`/`mayRequest` rule. Today the only callers are `aiAssessmentRetryRequest` (server-side, after `requireTeamMember`) and the test, and it filters by `defectId` – so there is no current leak. But it is now a public module query, and ST-111 (earlier AI assessments on the page) is its natural consumer; rendering it raw would put storage names and a team-member ID into the HTML. | ADR 0002 (a read model is a query; the page authorizes); conventions *Security* (no internal IDs on pages); the ST-107 `defectAiAssessments`/`loadDefectDetails` mapping pattern | Keep it internal (not on the barrel) or give it the viewer/`shown` rule, and map photos to signed addresses and the requester to a name in `defect-details-data.ts` when ST-111 uses it. | **revisit when ST-111** – not a current risk; ST-111 is the story that will consume it. |
| S3 | minor | Accepted residual – GET-triggered run | `src/app/(team)/team/defects/[defectId]/page.tsx:25-28`, `src/app/ai-work.ts:23-32`, `src/modules/ai-assistance/ai-work.ts:215-234`, `ai-work-dependencies.ts:14` | Once an AI assessment's hold ran out, a defect page's GET starts a full run, and that run takes **all** waiting work (AI assessments first, then file indexing) – not only the broken-off piece. So an authenticated page load can cause paid OpenRouter work on work that is already queued. It cannot create work, it cannot start before a hold ran out, and the broken-off piece itself sends nothing (`recordBrokenOff` only runs `failAiAssessmentCommand`). ADR 0015 explicitly says "whatever started it, a run takes all work that is left"; the page is one of several triggers (the Server Actions behave the same). | ADR 0015 *Started after the response* ("Whatever started it, a run takes all work that is left"); story prose "the defect page starts that run" | None needed. Restricting the page-triggered run to the broken-off piece would be an ADR change, not a bug fix. | **no – accepted** (skipped minor). |

## Checked and found sound

### The defect page's GET (`page.tsx`, `ai-work.ts`, `ai-work-when-left-unfinished.ts`, `api/ai-work/`)

- **No unauthenticated or unauthorized run.** `requireTeamMember()` is the first statement (`page.tsx:17`); a missing,
  expired, forged or deactivated session redirects to `/login` before `loadDefectDetails` and before
  `startAiWorkWhenLeftUnfinished`. A visitor cannot reach the start. The worker route itself still refuses anything
  without the 32+-character bearer secret (`worker-route.ts:23-49`; wrong/missing/too-short → 401, no `afterResponse`).
- **No run on every load.** The start requires `details.aiAssessments.current?.state === "requested"` **and**
  `aiWorkLeftUnfinished(kind, [id])` – an `ai_work_hold` of that kind and piece with `heldUntil <= now`
  (`ai-work.ts:215-234`). A normal load, a prefetch, or the five-second meta refresh while the hold is live starts
  nothing; the scenario test asserts the "before the hold ran out" case
  (`ai-assessment-failure.integration.test.ts:357-381`).
- **The page never runs AI work in its own function.** `startAiWorkWhenLeftUnfinished` → `startAiWorkAfterResponse` →
  `after()` → `startAiWork`, which POSTs to the deployment's own `/api/ai-work` with the bearer secret. The route is
  still the only caller of `runAiWork` (`route.ts:16`; a grep finds no other production caller).
- **Secret handling.** `start-ai-work.ts`, `worker-route.ts` and `ai-work.ts` are `server-only`; the secret comes from
  `process.env.AI_WORK_SECRET`, is sent only in the `Authorization` header, and the address comes from
  `AI_WORK_ORIGIN` / `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` / localhost – never from the request's `Host`
  (`start-ai-work.ts:57-63`, tested). No `NEXT_PUBLIC_*`, no secret in a page, a link, a client prop or a log; the
  `retry` form receives only the bound Server Action and catalogue text.
- **CSRF on the GET side effect.** The GET can cause a state change only after a hold already ran out (a repair, not a
  new fact). A cross-site subresource request cannot reach the page: the session cookie is `SameSite=Lax` (Better Auth
  default, asserted in `login.integration.test.ts:109`), so `<img>`/`fetch` from another site sends no cookie. A
  cross-site *top-level* navigation does send the Lax cookie, but its only effect is the bounded repair/run start
  described in S3 – no work is created and no other state changes; a GET cannot carry a CSRF token, and the effect is
  the same as a team member opening the page. Accepted.
- **The run cannot be told what to do.** A caller (even the holder of the secret) can only start a run over work that
  already exists; holds keep two runs from paying for the same piece, and the broken-off piece sends nothing.

### The retry Server Action (`ki-einschaetzung/actions.ts:48-66`)

- **Access check before the read and the runner.** `await requireTeamMember()` (line 53) precedes
  `aiAssessmentRetryRequest` (54) and `formAction` (56-65). A visitor is additionally rejected by the command's
  `allowedActors` (`request-ai-assessment-command.ts:17`), so the page check is not the only guard.
- **The input is read on the server.** `aiAssessmentRetryRequest(database(), defectId)` returns `{ defectId, note,
  photos }` from the newest **failed** assessment of the defect (`defect-ai-assessments.ts:86-93`). The form definition
  has `fields: []` and `input: () => input` (`retry-ai-assessment-definition.ts:24`), so a forged `note`, `photos` or
  `defectId` in the post is ignored. The bound `defectId` is treated like a form field (conventions): it only names
  which defect, the read and the command use the same ID, and the command re-checks that defect in its facts
  (`request-ai-assessment-command.ts:20-26`) – no cross-defect mix and no way to pick another defect's assessment.
- **A stale or duplicate tap cannot pay twice.** If nothing failed any more, `aiAssessmentRetryRequest` returns
  `undefined` and the action redirects without running the command. If two taps race, both may pass the sequential
  `beingWritten` fact, but the partial unique index `ai_assessment_being_written_idx` (`schema.ts:130`) rejects the
  loser as `ai-assessment-being-written` (`ai-assessments.ts:64-81`) – no second `requested` row, no second paid run.
  The `pending` button is only a browser convenience.
- **CSRF.** The action is a POST to the page path, behind `src/proxy.ts`'s `isSameOrigin` check (a missing or foreign
  Origin is 403) and Next.js's own Origin check. No new route handler; no change to the worker route's trust model.
- **The failed assessment is immutable** (note/photos never change, `ai-assessment.ts:5-9`), so the copied input is
  stable; the new assessment's `requestedBy` is the retrying person (from `currentPerson()`), not the original
  requester.

### The new form and the page offer (`retry-ai-assessment-form.tsx`, `ai-assessments.tsx`)

- The client form renders only `teamMessages.aiAssessments.retry` and the rejection text; it receives the bound Server
  Action, no note, no photos, no secret. Rejections return `values: {}` (`FormState<…, never>`), so nothing is echoed
  back into the HTML.
- The button is offered exactly where the command would accept it: `data.mayRequest && retryAction &&
  current.state === "failed"` (`ai-assessments.tsx:100`) – AI on, defect open, technician or suitable helper, none
  being written – and `RequestLink` is hidden while failed (`:113`). The helper-not-offered case is asserted
  (`ai-assessment-failure.integration.test.ts:230-232`). A stale button is harmless (see above).

### The new public queries (`aiAssessmentRetryRequest`, `aiAssessmentsOfDefect`)

- `aiAssessmentsOfDefect` filters by `defectId` (`ai-assessments.ts:127`) – no cross-defect leak. Neither query is
  reachable by a viewer: `aiAssessmentsOfDefect` is called only by `aiAssessmentRetryRequest` (server-side after
  `requireTeamMember`) and the test; the page uses `defectAiAssessments`, which applies `shown`/`mayRequest`. The raw
  fields are a foot-gun for ST-111 (S2), not a current leak.

### Personal data in logs and the journal

- The new code adds no logging. The run's existing logs carry kind and piece ID only; the retry action logs nothing; the
  note and photos never reach `console`.
- The events the retry and the run produce (`EVT-AiAssessmentRequested`, `EVT-AiAssessmentFailed`) carry IDs, the
  failure reason and the chat model only – no note, photos or names (`events.ts:67-102`); the written text stays out of
  the journal (ST-107). The new request's `requestedBy` is a team-member ID, the pre-existing pattern.
- The test's `KEY` is the same clearly fake `sk-or-v1-…` literal the other AI tests use, not a secret.

## Noted, not a vulnerability

- **A `requested` assessment with no hold is invisible to the page trigger.** If the request action's `after()` or the
  worker call fails, the assessment is `requested` but has no `ai_work_hold`; `aiWorkLeftUnfinished` checks holds only,
  so the defect page never starts a run for it and the five-second meta refresh loops until another Server Action
  trigger (attach a file, save the AI settings, another request) takes the queue. This is a liveness gap in the trigger
  chain (ADR 0015: "a failed call … waits for the next start"), not a security issue and not the cut-off-write case the
  story's scenario describes. Revisit when the trigger chain is next touched (ST-109's „KI“ form uses the same helper).
- **`aiAssessmentRetryRequest` reads the newest failed assessment, not the one the button was rendered under.** A stale
  tab whose button was shown under failed A can, after B was requested and failed, retry B's note and photos. Both are
  the same defect, the failed assessment is immutable and the button under the current page is correct; no security
  impact. Worth a sentence in the action's doc if the behaviour is not obvious.
- **The page's GET can start at most a handful of runs in the window before the broken-off recording commits** (the
  five-second refresh). A failing recording extends the hold by another hold's length (`ai-work.ts:140-152`), so a
  poison hold does not make the page start a run on every load – the ST-112 review's fix holds.

## Verdict

**ready to merge** – no blocker, no major; three minor findings (S1 test gap, S2 foot-gun for ST-111, S3 accepted
residual).

Most important: **S3 is the one the DoD asks about and it is accepted by design** – a defect page's GET cannot create
work or run before a hold ran out; it can only start the worker over work that is already queued (ADR 0015: "whatever
started it, a run takes all work that is left"). The broken-off piece itself sends nothing to OpenRouter. The most
actionable item is S1: one action-seam test for the access check and the server-side input.
