# Code review – ST-112: Background work for AI – worker route, holds, run budget and continuation
Base: main · Commits: 10 · Date: 2026-11-01

Scope read: `git diff main...HEAD` (24 files), the context pack, ADR 0002, ADR 0014, ADR 0015 (accepted), the new
*Background work* section and the two new seam rows in `docs/engineering/conventions.md`, `CONTEXT.md`.
Checks run: `npx vitest run src/app/api/ai-work src/modules/ai-assistance/ai-work.integration.test.ts` – 26 passed
(real PostgreSQL, isolated database, pool of 10, so the concurrent tests really are concurrent).
`check-language.ts`: the new warnings are all the known `ai` → *Chat model* false positive, nothing new.

Follow-up hurdle applied: no finding needs a new story – every one is either fixable here within about an hour or
belongs naturally to ST-106..ST-109. Grades are blocker / major / minor.

## The deliberate deviation – taking a hold by INSERT instead of `FOR UPDATE SKIP LOCKED`

**Meets the story's intent; better than the literal wording.** The intent (story AC 5, ADR 0015 *A run holds what
it works on*) is: two runs started at the same moment never take the same piece, without a long transaction. A piece
not yet held has no hold row, so there is nothing for `FOR UPDATE SKIP LOCKED` to lock – the literal reading would
have to lock the piece's own row in another aggregate's table (Collection's file), which ADR 0002/0014 forbid ("a
read of another module takes no lock", only the named removal-lock exception). `INSERT … ON CONFLICT DO NOTHING` on
the `(kind, piece_id)` primary key serialises two takers exactly (the second insert waits for the first's commit, then
does nothing), and the `isWaiting` re-check in the same transaction (READ COMMITTED, fresh snapshot per statement)
closes the "done or broken off a moment ago" window. `SKIP LOCKED` is used where it fits: on existing, expired holds in
the broken-off step. The conventions describe what was built; only the story's AC 5 text still says otherwise
(finding 1.1). The one thing the deviation leaves unproven is the concurrent *take* itself (finding 2.3).

## Pass 1 – Normal review (ADRs, boundaries, language, tests, conventions)

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1.1 | minor | Docs / traceability | `docs/stories/ST-112-background-work-for-ai.md` AC 5 | The AC says holds are "taken … with `FOR UPDATE SKIP LOCKED`"; the code takes them by primary-key insert (see the section above). Conventions already say what was built; the story does not. | Story AC 5, ADR 0015 *A run holds what it works on* | Add one line to the story's Notes ("taken by inserting the hold – its primary key decides; `SKIP LOCKED` for the broken-off step; see conventions *Background work*"). ADR 0015 is accepted and stays as it is. |
| 1.2 | minor | Test quality | `src/modules/ai-assistance/ai-work.integration.test.ts` | The fixed order of the kinds (ADR 0015: AI assessments before files, "a person is waiting") is a property of `runAiWork`, but no test runs two kinds and checks the order. ST-106/ST-107 rely on it. | Story *Task* ("a run takes the kinds in a fixed order"), seam row *run of the AI work* | One test with two stand-in kinds: a waiting piece of the second kind and one of the first kind, the first kind's piece starts first. |
| 1.3 | minor | Test quality | same file | Three branches of the shared mechanism have no test: (a) `isWaiting` false after the insert drops the hold again (`ai-work.ts:140-142`); (b) a late `storeResult` *after the hold ran out but before any run recorded it* stores nothing (the `gt(heldUntil, now)` condition, `ai-work.ts:162`) – the existing late-result test only covers "after it was recorded"; (c) a hold of an unknown kind is dropped (`ai-work.ts:117-118`). | tdd skill (scenario not checked), ADR 0015 *What breaks off fails, once* | One short test each through `runAiWork` / `HeldPiece`. |
| 1.4 | minor | Design / Primitive Obsession | `src/app/ai-work.ts:22`, `ai-work.ts:191` | A kind is named by a bare `string` that a page must repeat (`startAiWorkWhenLeftUnfinished("…")`); a typo or a later rename silently never starts a run (always `false`). The kind name is also "fixed once a hold may exist". | Code smell *Primitive Obsession*; conventions *Background work* ("never renamed once deployed") | Let the page pass the `AiWorkKind` (or an exported name constant of the kind) instead of a free string – decide when ST-107/ST-108 add the first real kind. |
| 1.5 | minor | Design / placement | `src/app/ai-work.ts:5` imports `src/app/api/ai-work/start-ai-work.ts` | The function every Server Action and page uses lives inside one route's folder and is imported sideways from `src/app/ai-work.ts`. Works, but the start function is the shared entry, the route is one of its callers. | codebase-design (locality) | Optional: move `start-ai-work.ts` next to `src/app/ai-work.ts`, keep the route folder for the route only; adjust the seam row path. |
| 1.6 | minor | Language | `src/modules/ai-assistance/schema.ts:26`, conventions *Background work* | *Hold* is also a domain term of Repair (*On hold*, *Put on hold*, *Resume* = "ending a hold"). The technical hold is sanctioned by ADR 0015 and the data model, and the code keeps it prefixed (`ai_work_hold`, `aiWorkHold`), so no rename. `CONTEXT.md` has no line for it, so a reader of ST-108 code ("the hold ran out") may mix the two. | `CONTEXT.md` (*On hold*, *Resume*) | Optional: a short glossary note under *Broken off* or a technical-terms line ("the AI work's hold – technical, not a defect's hold"). |
| 1.7 | minor | Conventions | `docs/engineering/conventions.md` *Background work* bullet "Storing a result" / "A new kind" | The section does not say *how* a kind runs its command inside `storeResult`/`recordBrokenOff`: `executeCommand(command, input, { actor: { kind: "system" }, db: tx, clock })` – a savepoint inside the hold's transaction – and that a **rejected** command still ends the hold (see 2.2). ST-106..109 each have to work this out. | ADR 0002 (command layer, system actor), ADR 0015 | Add one sentence each to *Storing a result* and *What broke off fails, once*. |

Everything else in this pass holds: module boundaries are kept (the run lives in AI assistance, `src/app` uses only
the module's `index.ts` exports; no other module is touched or locked); the policy and event IDs
(`POL-UnfinishedAiWorkFails`, `EVT-AiWorkLeftUnfinished` derived, not journaled) match `events.yaml`; the hold is
technical, not domain state, as the data model says; time is the injected clock throughout, no `new Date()` for
"now"; the run is driven directly in the tests, never waited for; tests go through `runAiWork`, `HeldPiece`,
`aiWorkLeftUnfinished`, `workerRoute` and `startAiWork` only – the stand-in reading its own table is its read model, as
the seam row allows; expected values are literals (the 4 start times, 10:08:20 for 2 × 250 s). The two seam rows and the
*Background work* section match the code. No out-of-scope behaviour: `aiWorkKinds` is empty, no Server Action calls the
start function yet – both by design.

## Pass 2 – Bug-focused pass (shared platform code for ST-106..109)

What was checked and holds:
- **Taking** – two runs on the same piece: the second `INSERT … ON CONFLICT DO NOTHING` blocks on the first's
  uncommitted row and then does nothing; against a broken-off step that is deleting the same expired hold, the insert
  waits, succeeds after that commit, and `isWaiting` (new snapshot) sees *broken off* and drops it again. An expired,
  unrecorded hold is never re-taken (the primary key still exists) – the story's "neither before nor after" holds.
- **Broken-off step** – `ORDER BY held_until LIMIT 1 FOR UPDATE SKIP LOCKED` per short transaction; concurrent runs
  share expired holds; record and delete in one transaction → exactly once (tested with three runs).
- **`storeResult` vs. broken-off step** – both sides take the hold row's lock (DELETE vs. SELECT … FOR UPDATE); whoever
  comes second sees the row gone (`no-longer-held`) or skips it. Also correct under clock skew between instances,
  because the row lock, not the clocks, decides.
- **`giveUp`** – deletes only `held_by = this run`, so a stale give-up can never end another run's later hold of the
  same file (file IDs come back after „Erneut versuchen“).
- **Budget / continuation** – `while (now < budgetEnds)`; a run that finds nothing takeable `return`s **without** a
  continuation, so pieces held by other runs never cause a ping-pong of self-calls; the 6 × 3 s / 10 s test is right.
- **Hold length** – 2 × budget: on Hobby 500 s against a 300 s function, so the hold always outlives the run; a piece
  overrunning its hold on a self-hosted server ends in `no-longer-held`, never a double store.
- **Connections** – no transaction is open during `kind.work`; every step is its own short transaction on the pool.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 2.1 | major | Broken-off step – poison hold | `src/modules/ai-assistance/ai-work.ts:72`, `:104-124` | If a kind's `recordBrokenOff` **throws** (a bug, an unexpected `NotFound`, a constraint), the transaction rolls back, `while (await failOneBrokenOff(…))` throws out of `runAiWork`, and the hold stays – as the *oldest* expired hold, so it is picked first by **every** later run. Result: all AI work stops for good (no new work is ever taken, the queue never moves), and because `aiWorkLeftUnfinished` stays `true`, every refresh of the defect page (ST-108, refreshes itself) and every opening of the form „KI“ (ST-109) starts a new function invocation that dies the same way. One bad piece takes down the whole background work. `workOn` already isolates a throwing `work`; the broken-off step has no such isolation. | ADR 0015 *What breaks off fails, once*; story AC 6; robustness of shared code ST-106..109 build on | Isolate each broken-off hold: a throwing recording must not end the run nor block the others (e.g. a savepoint per hold, logged by kind and ID). Decide – in this story, with the user if needed – what such a hold becomes: dropping it (as for an unknown kind) makes the piece waiting again and so paid again, against D3; keeping it needs a way for the step and `aiWorkLeftUnfinished` to pass over it. Add a test with a stand-in whose `recordBrokenOff` throws. |
| 2.2 | major | `storeResult` – paid re-take in the same run | `ai-work.ts:30`, `:155-167`, `:77-79` | `storeResult` deletes the hold, runs `store(tx)` and returns `"stored"` whatever the store did. A kind will run its command via `executeCommand(…, { db: tx })`, which turns a rejection into `{ ok: false }` **without throwing** (savepoint rolled back, hold deletion kept). If that rejection leaves the piece waiting, the run – which only remembers pieces it *gave up* – takes the same piece again at once, pays OpenRouter again, is rejected again, and so on until the budget is used; then it continues itself (`anyWaiting` is true) and the next run does the same: an endless, paid loop. The only guard is each kind's `isWaiting` agreeing exactly with its command's rules. Also, the `"stored"` answer is untrue in that case. | ADR 0015 (*so several runs share the work instead of doing – and paying for – it twice*), D3 (no automatic retry) | Within one run, never take again a piece this run already worked on (remember every worked piece, not only given-up ones – the `givenUp` set already exists) and leave it out of the continuation check; and/or let `storeResult` report the store's outcome (`store` returns whether it stored). Add a test: a stand-in whose store is rejected and whose piece stays waiting is started once per run and does not make the run continue itself. |
| 2.3 | major | Test gap – concurrent take | `ai-work.integration.test.ts` | AC 5's central claim, "Two runs started at the same moment never take the same piece", has no test. The concurrent test that exists covers only the broken-off step; the hold test uses one cut-off run and later runs, never two runs taking waiting pieces at once. This is exactly the path that replaced `SKIP LOCKED` by the primary-key insert (see above), so it should be proven. | Story AC 5; tdd skill (the scenario's "Then" not checked) | `await Promise.all([run(), run(), run()])` over e.g. 6 waiting stand-in pieces → each piece `done: 1`, `started` holds each ID exactly once. |
| 2.4 | minor | Continuation on Hobby | `ai-work.ts:73-78`; `docs/operations/ai-work.md` *When something … goes wrong* | `continueWork` is called only after the last piece finishes. When the function is killed during that piece (Hobby's 300 s against a too-large PDF – the accepted limitation D1), the self-call never happens: the rest of the queue (e.g. hundreds of files after turning AI on) waits until something else starts a run. Recovery comes only from a trigger, at the earliest when the cut-off hold has run out and a page sees it (8 min later). Consistent with ADR 0015 ("if a self-call fails, the chain stops"), but the ops doc only says the cut-off *piece* fails, not that the *queue* stalls. | ADR 0015 *Continued by itself*, D1 | Say it in `docs/operations/ai-work.md` (a cut-off run also ends its chain; the next start takes the rest). No mechanism (no cron, D3). |
| 2.5 | minor | Budget setting vs. `maxDuration` | `ai-work-dependencies.ts:18-21`, `route.ts:11` | On Vercel a budget ≥ 300 (e.g. the `3600` the ops doc gives for a server of its own, copied by mistake) makes every run end by being killed: the budget never stops the run, no run ever continues itself, and every cut-off piece is recorded only after 2 × 3600 s. Nothing warns. | ADR 0015 *The budget is a setting, and a hold outlasts it* | Log a warning (or cap) when `VERCEL` is set and the budget is not below `maxDuration`; the ops doc already says "leave it unset on Hobby". |
| 2.6 | minor | Connection handling | `src/platform/database.ts:19-21` (unchanged) | The pool has no `error` listener. The run makes the background work the first code that keeps a function instance alive for minutes with idle pool clients against a Neon compute that may suspend; `pg` emits `error` on the pool when an idle client's connection drops, and an `EventEmitter` `error` without a listener crashes the process. Separately, a database error in `takeNext`/`failOneBrokenOff` ends the run without a continuation (logged by the route; the queue waits for the next start – acceptable). The story names this as the remaining risk; nothing in the diff addresses it. | Story Notes (risk: connection handling during a run of up to 300 s against a database that scales to zero) | `pool.on("error", …)` logging only the error name in `database()` – a one-liner, fits this story. |
| 2.7 | minor | Interface not enforced | `ai-work.ts:44-46`, `:86-93` | A kind whose `work` returns without calling `storeResult` or `giveUp` leaves its hold silently, and the piece is recorded *broken off* later – indistinguishable from a real cut-off. The run knows whether the `HeldPiece` was ended. | codebase-design (the interface's invariants are part of the interface) | Have `workOn` log (kind and ID) when `work` resolved with the hold still held. |
| 2.8 | minor | Performance (later) | `ai-work.ts:97-100`, `:128-130`, `:147-150` | Every take asks each kind for its **whole** waiting list and filters in memory; turning AI on (every file of every machine) re-reads all waiting file IDs once per piece, plus once more for the continuation check. Fine for a museum's few thousand files. | Smell: none; note for ST-106 | ST-106 may let `waiting` return a bounded list; not needed now. |

## Pass 3 – Security-focused pass (`/api/ai-work` starts paid work)

What was checked and holds:
- **Secret comparison** (`worker-route.ts:44-50`): SHA-256 digests compared with `timingSafeEqual` – equal length by
  construction, so neither length nor prefix leaks; exact `Bearer ` prefix; empty token refused; a configured secret
  shorter than 32 characters refuses everything. Wrong/missing secret → 401, `afterResponse` never called (tested).
- **Own address** (`start-ai-work.ts:56-62`): only from the environment – `AI_WORK_ORIGIN`, then
  `VERCEL_PROJECT_PRODUCTION_URL` on production, `VERCEL_URL` on previews, then localhost. Never the request's Host or
  any header (tested for production, preview and self-hosted). No SSRF path: no caller-controlled input reaches the URL.
- **The secret never reaches a page, browser or log**: `start-ai-work.ts`, `worker-route.ts` and `src/app/ai-work.ts`
  are `server-only`; the secret is not `NEXT_PUBLIC_*`; it is sent only in the `Authorization` header; the logs carry a
  status code, an error name or a fetch error message (Node's "fetch failed" carries no headers) – never the secret.
  Ops doc: Vercel type *Sensitive*, one value per environment.
- **How pages start runs**: only through `startAiWorkWhenLeftUnfinished`, server-side, and only when a hold ran out
  (`aiWorkLeftUnfinished`), in `after()`. A run takes only work that already exists – a caller cannot choose what is
  done or make work, so even a holder of the secret can at most start extra runs over existing waiting work, which the
  holds keep from being paid twice.
- **CSRF / proxy**: `/api/` is excluded from the page proxy (`src/proxy.ts:56`); the route deliberately checks neither
  Origin nor session (it runs no person's command) – documented in conventions *Security*. Only `POST` is exported.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 3.1 | minor | Secret in transit – redirects | `src/app/api/ai-work/start-ai-work.ts:42-46` | `fetch` follows redirects by default. If the production domain redirects (apex → `www`, a domain move, `http` → `https` with `AI_WORK_ORIGIN`), the bearer request is sent on to the redirect target. Node's fetch drops `Authorization` on a cross-origin redirect, so the secret should not leak – but then every self-call fails as 401/405 with a log that does not say why, and a same-origin redirect keeps the secret on a path nobody intended. | conventions *Security*; ADR 0015 (secret never leaves the server) | `redirect: "error"` (or `"manual"` and treat any 3xx as failure, logging the status) – the call then never follows anywhere and a misconfigured address is visible at once. Add the case to the route test. |
| 3.2 | minor | Logging – unknown thrown values | `ai-work.ts:91`, `worker-route.ts:37` | Both log `error.name` for an `Error` but the **raw value** for anything else thrown. A kind (ST-106/107) that throws a non-`Error` – an OpenRouter answer object, a string with the defect's description – would write content or personal data to the logs. | conventions *Security* (no personal data in logs) | Log `typeof error` (or a fixed text) for non-`Error` values. |
| 3.3 | minor | Unauthenticated log volume | `worker-route.ts:28-31` | While the secret is missing or too short, every request – also an anonymous one – writes a `console.error`. Anyone can fill the deployment's logs (Hobby log retention is small), and the real cause scrolls away. | conventions *Security* | Log the misconfiguration once per instance (a module-level flag), keep the 401 per request. |
| 3.4 | minor | Preview self-calls | `start-ai-work.ts:60`, ops doc | On a preview the call goes to `VERCEL_URL`, which Vercel's deployment protection refuses (401 from Vercel, logged as "the worker route answered 401"). This is the documented D2 decision; just note that previews still send the Preview secret to the protected URL on every start – harmless (same deployment, TLS) and accepted. | ADR 0015 D2 | None; already in the ops doc. |

## Verdict
ready to merge – no blocker; the three majors (2.1–2.3) should be fixed in this story first (each well under an hour; none needs a new story).
Most important: 2.1 – a throwing `recordBrokenOff` leaves a poison hold that stops all AI work for good and makes every refresh of the defect page start a run that dies the same way.

## Resolution (implementer, 2026-11-01)

**Fixed in this story**
- 2.1 (major) – a throwing `recordBrokenOff` no longer stops the run: its transaction rolls back, the hold stays (the
  piece is never taken – or paid for – again, D3), the run logs kind and ID, skips it and goes on; the next run tries
  again. Test "a piece whose broken-off recording throws". Same gap as remark 2 of the acceptance.
- 2.2 (major) – a run takes no piece twice (`Run.taken`), whatever its result, and leaves those out of the continuation
  check. Test "a piece whose stored result leaves it waiting (a rejected command)".
- 2.3 (major) – test "runs started at the same moment never take the same piece" (three runs, six pieces, each done once).
- 1.1 – the story's Notes say how a hold is taken and why (as built).
- 1.7 – conventions: a kind runs its command as the system on the hold's transaction; a rejected result still ends the hold.
- 2.4 – operations: a cut-off run never continues the rest of the queue.
- 2.6 – the database pool logs and drops a connection error instead of crashing the process.
- 3.1 – `startAiWork` sends with `redirect: "error"`.
- 3.2 – a thrown value that is not an `Error` is logged as "unknown".

**Skipped minors**
- 1.2 (order of the kinds untested) – there is one kind list and no real kind yet; ST-107 adds the second kind and tests the order with real ones.
- 1.3 (three untested branches) – the `isWaiting` re-check is exercised by the concurrency tests; the late result before recording is the same conditional delete as after it; the unknown kind is a log line. Revisit when a kind is renamed.
- 1.4 (kind name a bare string) – ST-106/107 export their kind's name next to the kind; nothing repeats it yet.
- 1.5 (`start-ai-work.ts` in the route folder) – it belongs with the route it calls and is tested through it.
- 1.6 ("hold" also a Repair term) – the AI work's hold is technical and never shown; no glossary line for a word no page uses.
- 2.5 (budget ≥ 300 s on Vercel not warned) – documented in `docs/operations/ai-work.md`; the user designs for a runtime without that limit.
- 2.7 (a kind ending without `storeResult`/`giveUp`) – its hold runs out and it is recorded broken off – safe; the real kinds are reviewed in ST-106/107.
- 2.8 (whole waiting list per take) – fine at a museum's size (reviewer's own judgement); revisit if a measurement says so.
- 3.3 (an error log per anonymous request while the secret is missing) – a misconfiguration that should be loud.
- 3.4 – accepted D2 decision, no action.

No follow-up story: nothing passes the hurdle.
