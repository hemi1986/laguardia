# Code review – ST-109: See how far the AI index got and try failed files again
Base: main · Commits: 12 · Date: 2026-11-01

Scope read: `git diff main...HEAD` (27 files) and `git log main..HEAD --oneline`; the context pack (story, EVT-/CMD-/AGG-/
POL-/RM- entries, HS-28/32/33/34/35); `docs/engineering/conventions.md` (*Server Actions and forms*, *Background work*,
*Security*, *Tests*); ADR 0002, 0014, 0015 as cited by the code; `docs/reviews/ST-108-code-review.md` and
`docs/reviews/ST-108-security-review.md` (the sibling story's findings and the fixes that went into main); the command
layer (`src/platform/command/aggregate.ts`, `index.ts`, `last-command.ts`), `src/app/ai-work.ts`,
`ai-work-when-left-unfinished.ts`, `api/ai-work/start-ai-work.ts`, `_actions/form-runner.ts`, `_actions/version.ts`.
Ran: the scenario file (9/9 green), `check-language.ts` (only the known `ai`/`embedding` heuristic false positives on the
changed files, no `_Avoid_` word).

Two passes: **Part 1** the normal code review, **Part 2** the security pass the Definition of done asks for (HS-35, the
Server Action with a posted `fileId` + `version`).

---

## Part 1 – Code review

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | UI / G8 – a rejection is swallowed | `src/app/(team)/team/museum-settings/ai-index-overview.tsx:39-42`; `ai-settings-section.tsx:91`; `retry-file-indexing-form.tsx:31` | The retry form is rendered only inside the list of failed files, and the list only while AI is on. Every Server Action re-renders the page, and the two domain rejections both remove the form from that re-render: `file-indexing-not-failed` (scenario 5 – the file is indexed now, so it left `overview.failed`) and `file-indexing-ai-off` (scenario 8 – the whole overview is gone). The form unmounts with its `useActionState`, so the two new German texts in `aiAssistanceErrors` are never seen; the technician taps and the row just disappears. This is exactly ST-108's major #1, fixed on main in `8006f6b` for the AI assessment retry. The scenario tests assert the action state (`state.error`), not what the page shows after the re-render, so they cannot catch it. | Conventions *Server Actions and forms* („a page must **not swap its form for a 'nothing to do here' text** when the aggregate changed meanwhile – the form would unmount and drop … the rejection“; „A one-tap account button stays mounted when it is no longer offered … so a rejection after a change made meanwhile is said, not swallowed“); UX G8; ST-108 code review #1. | Keep the one-tap form mounted after a rejection, as ST-108's fix and `AccountButtonForm`'s `offered` do – e.g. the overview keeps a slot for the file that was posted (or the form lives where it survives the re-render) and the form returns `null` only when `!offered && !state`. Assert in a test that renders the page after a stale post that the rejection text is in the markup. Fits this story (< 1 h); no follow-up. |
| 2 | minor | UI texts – one-tap rejection | `src/app/(team)/team/museum-settings/retry-file-indexing-form.tsx:31` | A one-tap button uses `rejectionText`, which turns `version-conflict` into `forms.conflict` („… erneut senden“-style wording for a form that kept input). There is no input to keep; a second technician's simultaneous tap ends in a conflict text that asks to send again although the file is now waiting. | Conventions *UI texts* („One-tap buttons have nothing to keep and show `commandErrorText` directly“). | Use `commandErrorText` (or pass an override for `version-conflict`/`not-found` saying the file is already being indexed again). Do it together with #1. |
| 3 | minor | Test quality – page wiring of HS-35 not covered | `src/app/(team)/team/museum-settings/ai-index-overview.integration.test.ts:322-330`; `src/app/(team)/team/museum-settings/page.tsx:28` | Scenario 6's Then „the opening starts a run“ is checked against a replica of `page.tsx` (`openingStartsARun` wires `startWhenLeftUnfinished` itself). Deleting line 28 of `page.tsx`, dropping its `if (ai.overview)` guard or passing the wrong kind keeps all nine tests green. Same gap as ST-108 #6, which said „a third AI page trigger would justify“ a seam – this is the second. | tdd (test at the agreed seam, not a copy of the wiring); ST-108 code review #6. | Move the page's decision into the data function (e.g. `loadAiSettings` returns whether to start, or a small exported `aiSettingsPageStart(ai, deps)`), so the test calls the same code the page calls. |
| 4 | minor | Test quality – the real Server Action is not exercised | `ai-index-overview.integration.test.ts:179-190`; `ai-index-actions.ts:115-129` | `retry()` builds its own `onSuccess` that counts a „start“ and computes the landing with `retriedLanding` – so `starts: 1` only proves `onSuccess` ran and `landed: retriedLanding(schematic)` compares the helper with itself. The production action (`requireTechnician()` before the runner, `startAiWorkAfterResponse()`, `redirect`) is never called. The scenario's confirmation is still checked for real through `?retried=`. | tdd *Anti-patterns* (tautological: expected value computed like the code does); ST-108 security review S1 (same gap, fixed on main for the AI assessment retry). | Assert the landing against a literal (`/team/museum-settings?retried=<id>`); optionally inject the start into the action module so the test can count real starts. See also S1 below. |
| 5 | minor | Duplicated test setup | `ai-index-overview.integration.test.ts:74-147` | `ai()`, `turnAiOn()`, `removeTheKey()`, `aMachine()`, `attach()`, `run()` repeat the setup of `file-indexing.integration.test.ts`, `ai-assessment-failure.integration.test.ts` and others. ST-108 #5 named „a third copy“ as the trigger for a shared AI test-support helper; this is it. | Smell Duplicated Code; conventions *Tests* (builders and test-support). | Extract an AI test-support module (AI on/off, a machine with a file, one run of the background work). Small; may also be a line in the next architecture review. |
| 6 | minor | Story / data model consistency – what „cost so far“ includes | `src/modules/ai-assistance/ai-index-overview.ts:56-59`; story line 34; data model line 555 | The story says the cost is „everything OpenRouter charged for indexing“; the code (and the data model) sum only `EVT-FileIndexedForAi`. Embeddings paid for an indexing that later failed (OpenRouter refused partway) or broke off are charged by OpenRouter but recorded nowhere, so the shown figure understates the real spend – most for the too-large-PDF case the story names, which a technician can now retry by hand repeatedly. The code follows the data model; the gap is between story text and model. | Story Context („everything OpenRouter charged for indexing“); data model *AI index entry* – Cost; workflow rule „don't decide in the code“. | Not a code fix: either reword the story/UI to „cost of indexed files“ or add the cost to EVT-FileIndexingFailed (a model change). Raise it as a question to the user; an `[OPEN]` row if not answered now. |
| 7 | minor | Doc consistency | `docs/stories/ST-109-ai-index-overview-and-failed-files.md:9` | The front matter `events:` still lists three events; the new EVT-FileIndexingRetried this story introduces is only in the prose. | Workflow traceability (story ↔ events.yaml). | Add `EVT-FileIndexingRetried` to `events:` (the main session edits stories). |
| 8 | minor | Robustness – posted ID not checked | `src/modules/ai-assistance/index-file-for-ai-command.ts:38`; `retry-file-indexing-definition.ts:376-379` | A posted `fileId` that is no UUID reaches `store.load` and Postgres rejects the `uuid` comparison – the action throws (error page) instead of answering `not-found`. Only a technician can post it; see S2. | Conventions *Security* / UI texts („An address that is no aggregate ID is checked with `isId` from the command layer“); precedent `collection/machines.ts:97`. | `isId` in the form's `input` (map a non-ID to a value the command answers with `not-found`) or in the command's `target`. One line plus one forged-post test. |
| 9 | minor | Performance smell | `src/modules/ai-assistance/ai-index-overview.ts:56-59` | The cost is computed by reading and parsing every `EVT-FileIndexedForAi` ever journalled on every load of „Einstellungen“; it grows with every re-indexing (a model change re-indexes all files). Museum scale makes this harmless today. | codebase-design (keep the read model's cost proportional); conventions *Read models*. | A `sum` over the journal's JSON `cost` in SQL, when the journal gets large. Stays a line here. |
| 10 | minor | Confirmation can be lost on a fast run | `src/modules/ai-assistance/ai-index-overview.ts:114-126` | The confirmation needs the *latest* command on the file to be the technician's retry. The run started after the response may finish before the redirected GET (a short text file, or a „format not indexed“ file that fails at once), so the landing shows no confirmation. G3 („never from the address alone“) is kept; the loss is cosmetic. | UX G3; `lastCommandBy` semantics. | Accept, or confirm on „the technician's last command on the file was a retry“ instead of „the latest command“. Not worth a change unless seen in use. |

### Checked and found sound

- **The design decision (EVT-FileIndexingRetried, two definitions under CMD-IndexFileForAi).** `retryFileIndexingCommand`
  is a person's command at the entry's version (`target` with `version`), decides first on the fresh state (Q11), removes
  the failed entry with the version check (`removes: () => true`, `store.remove` at `expectedVersion`) and journals
  EVT-FileIndexingRetried with owner and embedding model in the same transaction. It matches the rule added to
  `events.yaml` and the data-model state diagram (`Failed --> [*]`), and the catalogue projection mirrors the other
  AI-index events. Waiting stays derived.
- **`indexFileForAiCommand` system-only, and the test change.** The only production caller is `file-indexing-work.ts:111`
  (`actor: { kind: "system" }`); after the decision a technician never reaches the store path. The changed setup in
  `ai-assessment-writing.integration.test.ts:213-214` seeds an indexed file through that path and asserts nothing about
  who may index – switching its actor to the system aligns the setup with production and does not weaken any
  assertion (`file-removal.integration.test.ts` already used the system). Legitimate.
- **Domain rules of the hand-run.** Only while AI is on (facts read inside the transaction, decrypting the key as every
  other AI rule does); only a file failed *with the current embedding model* (an entry of an earlier model counts as
  waiting); a removed file has no entry any more (POL-RemovedFileLeavesAiIndex in the removal's transaction) → `not-found`;
  a concurrent removal and retry serialize on the row (`DELETE … WHERE version`), so nothing is recorded for a removed
  file. Helpers: `allowedActors: ["technician"]` plus `requireTechnician()` in the action.
- **Read models (ADR 0002).** `aiIndexOverview` counts only files not removed (`filesForIndexing`), indexed = entry of
  the current embedding model, waiting derived, failed with reason and version; none while AI is off. `filesTheAiCannotRead`
  marks only failed entries of the current model and nothing while AI is off; the machine record gets the mark through
  the module's public function and the page composes (ST-009). No `new Date()`; the hold check uses the injected clock.
- **Module boundaries (ADR 0002).** AI assistance reads Collection only through its `index.ts` (`filesForIndexing`,
  `fileForIndexing`); the new `machineModelTitles` is a Collection query exported from its barrel; the page composes
  owner labels. No import of another module's internals.
- **Language.** UI texts are the story's German texts verbatim (counts, cost, empty, five reasons incl. „Erfassung
  abgebrochen“, „Erneut versuchen“, the confirmation, „Für die KI nicht lesbar“); German numbers and cost via
  `Intl.NumberFormat("de-DE")`. Code names use *AI index*, *AI index entry*, *embedding model*; check-language reports only
  the long-standing `ai` heuristic hits.
- **Scenario coverage.** Nine exact titles; expected values from the story (12/3/2, „1,23 $“ from 12 × 0.1025 as a worked
  example, the reason texts); scenario 5 compares the file's journal before/after and counts embedding requests; the
  broken-off scenario drives the hold with the stepping clock and proves no embedding is sent. Gaps are #1, #3, #4.

---

## Part 2 – Security pass

Scope: the new Server Action and form (`ai-index-actions.ts`, `retry-file-indexing-definition.ts`,
`retry-file-indexing-form.tsx`), the GET start on „Einstellungen“ (`page.tsx:28` → `startAiWorkWhenLeftUnfinished`), the
`?retried=` confirmation, the mark on the machine record, the new journal event.

**Result: no blocker, no major. Three minor findings; the GET start is the accepted ADR 0015 residual, as on the defect
page (ST-108 S3).**

| # | Severity | Area | File:line | Finding | Source | Suggested direction | Follow-up? |
|---|---|---|---|---|---|---|---|
| S1 | minor | Test gap – access check of the action | `ai-index-overview.integration.test.ts:179-190`, `:423-424`; `ai-index-actions.ts:127` | Neither the action's `requireTechnician()` nor a forged post goes through `retryFileIndexingAction`. The helper scenario is covered only by the command's `allowedActors`, and „does not reach Einstellungen“ is delegated to ST-104's browser test. Removing or reordering `requireTechnician()` stays green; the command still refuses helpers and visitors, so this is defence in depth, not a hole. | Conventions *Server Actions and forms* (access check before the runner); ST-108 security review S1 (fixed there by `8006f6b`). | One action-seam test: no session → redirect, nothing journalled; helper → rejected, entry still failed. | No – fits this story; no current risk. |
| S2 | minor | Input validation – malformed `fileId` | `index-file-for-ai-command.ts:38` | A non-UUID `fileId` throws a Postgres `22P02` out of `executeCommand` → error page for the posting technician. No data is touched and nothing reaches another user; the posted value may appear in the server's error log (an ID-shaped string the technician typed, no personal data). | Conventions *Security* (`isId` for anything that should be an ID). | Same fix as Part 1 #8. | No. |
| S3 | minor | Accepted residual – paid work by GET and by hand | `page.tsx:28`; `src/app/ai-work.ts:23-32`; `ai-index-actions.ts:118` | (a) Opening „Einstellungen“ with AI on and an expired file hold starts a run, and that run takes *all* waiting work (assessments, then files) – not only the broken-off file, which itself is recorded with nothing sent. (b) Each „Erneut versuchen“ re-pays the file's indexing; a file that breaks off every time (a PDF too large for a Hobby run) costs up to one run's embeddings per tap, and that spend is not in „Kosten … bisher“ (Part 1 #6). Both need an authenticated technician and cannot create work beyond one file per tap; D3 chose „by hand only“ deliberately. | ADR 0015 *Started after the response* („whatever started it, a run takes all work that is left“); HS-35; D3 (user 2026-11-01); ST-108 security review S3. | None in code. Make sure the user knows (b) when deciding Part 1 #6. | No – accepted. |

### Checked and found sound

- **Authentication / authorization of the GET.** `requireTechnician()` is the first statement of `page.tsx`; helpers and
  visitors are redirected before `loadAiSettings` and before any start. The start runs only when `ai.overview` exists
  (AI on) **and** `aiWorkLeftUnfinished(FILE_INDEXING_KIND)` finds a hold whose `heldUntil` has passed – a normal load,
  a prefetch or a reload starts nothing (the scenario asserts both the before and the after case, modulo Part 1 #3).
- **The worker start.** `startAiWorkWhenLeftUnfinished` → `after()` → `startAiWork`: `server-only`, the secret only from
  `AI_WORK_SECRET` in the `Authorization` header, the origin from the deployment's own environment (never the request's
  Host), `redirect: "error"`, 10 s timeout. Nothing of it reaches the page, the form or a log line with content. The
  worker route still requires the bearer secret; this story does not touch its trust model.
- **CSRF.** The retry is a Server Action POST to the page path: `src/proxy.ts`'s `isSameOrigin` (missing or foreign
  Origin → 403) plus Next.js's own Origin check. The GET side effect is only a repair of an expired hold (cross-site
  subresource requests carry no `SameSite=Lax` cookie; a top-level navigation has the effect of a technician opening the
  page) – same reasoning as ST-108 S3.
- **Posted fields.** `fileId` only names which entry; the command loads it, decides on the stored state (failed with the
  current model, AI on) and removes at the posted version – a forged version is `version-conflict`, a non-number is
  `NO_VERSION_SEEN` (−1) → conflict. A technician may retry any failed file – they see all of them, so no scoping is
  missing. A stale/duplicate tap: the first removes the entry, the second gets `not-found`/`version-conflict`; no second
  paid indexing is queued by the same file twice (waiting is one state). The acting person comes from `currentPerson()`
  only.
- **Version reuse after re-insert (noted, harmless).** Removing and re-inserting an entry restarts its version at 0, so a
  page opened before Eva's retry can post version 0 against a *new* failure. The decision runs on the fresh state, so the
  result is a legitimate retry of a file that is failed now – no wrong state, no extra cost beyond that tap.
- **`?retried=` confirmation.** `isId` before any query; the title is shown only when the latest command on the file is
  the viewer's own EVT-FileIndexingRetried (`lastCommandBy`) and the file is not removed – never from the address alone
  (G3). The title is rendered by React (escaped); no XSS.
- **Information exposure.** The overview shows museum numbers, machine-model titles, file titles and reasons to
  technicians only – no internal IDs in text, no staff names; the `fileId` is a hidden field on a team page, where
  posting IDs is the convention. The machine-record mark is team-only (`loadMachineRecord` has no public caller) and
  the story wants it for the whole team. No OpenRouter answer text is shown – only the catalogued reason.
- **Personal data in logs and the journal.** No new logging. EVT-FileIndexingRetried carries the file, its owner and the
  embedding model; the actor ID is the command layer's usual column. The plaintext key is decrypted inside
  `aiIndexingSettings` (as before) and never leaves the module's functions.
- **Secrets in tests.** `KEY` is the same clearly fake `sk-or-v1-…` literal as the other AI tests; the encryption key is
  random per run.

---

## Verdict

ready to merge – no blocker; one major (#1, the same defect ST-108 had to fix) to fix in this story, 9 minor in Part 1, 3 minor in Part 2, no follow-up story (none passes the hurdle).
Most important: **#1 – a rejected „Erneut versuchen“ (file indexed meanwhile, or AI off) unmounts its form on the re-render, so the technician never sees why**; the scenario tests check the action state, not the page.

## Refactor (after the review, `/implement` step 6)

| # | Outcome |
|---|---|
| 1 | **fixed** – the failed files and their „Erneut versuchen“ are one client component `FailedFiles` (`retry-file-indexing-form.tsx`) with one action state, rendered by the section „KI“ in the same place whether the overview is shown or not; after a rejection that takes the file off the list or the overview away, the reason is still shown. The counts and the cost stay in `AiIndexOverviewView`. |
| 2 | **fixed** – `commandErrorText` (one-tap, nothing kept). |
| 3 | **fixed** – the page's decision is `startAiWorkOnOpening(data, starter)` in `ai-settings-data.ts`; the page passes `aiWorkStarter()`, scenario 6 and 8 call the same function (AI off starts nothing). |
| 4 | **fixed** (landing) – asserted against the literal address. The real action's `requireTechnician()` and `startAiWorkAfterResponse()` stay untested, as for every other action on the runner (seam catalog: runner + definition). |
| 5 | skipped – extracting a shared AI test-support module is a refactor across four test files; a line for the next architecture review. |
| 6 | **question to the user** – raised in the pull request and in `docs/stories/OPEN_QUESTIONS.md`; the code follows the data model. |
| 7 | **fixed** – `EVT-FileIndexingRetried` in the story's `events:`. |
| 8 / S2 | **fixed** – a posted file that is no ID becomes `NO_FILE`, which the command answers with `not-found`; test „a forged „Erneut versuchen“ with a file that is no ID is answered, not thrown“. |
| 9 | skipped – museum scale; revisit when the journal grows (a SQL `sum`). |
| 10 | skipped – cosmetic, G3 kept. |
| S1 | partly – the forged post is covered (8); `requireTechnician()` as for #4. |
| S3 | accepted residual – reported to the user with #6. |
