# Story review – feature `ai-assessment` (ST-104 – ST-111), 2026-10-31

Lead-developer pass, three lenses (value, build, UX). Nothing was set `ready`; the user approves. In the stories only
`size`, `risk`, `depends_on` (ST-111) and `priority` were set. Everything else below is a recommendation for the
requirements-engineer.

## Summary

| Story | Testable | size | risk | priority | depends_on | Verdict |
|---|---|---|---|---|---|---|
| ST-104 AI settings, key and models | yes, with 2 fixes | L | medium | should | – | approve with small fixes |
| ST-105 Spike: largest manual | n/a (checklist) | M | high | should | – | approve with small fixes |
| ST-106 Index files for AI | yes | XL as written (L after the split) | high | should | ST-104, ST-105 (+ new tech task) | needs rework |
| ST-107 Request an AI assessment | yes, with 3 fixes | L | high | should | ST-106 | approve with small fixes |
| ST-108 Failed / broken-off AI assessments | yes, with 2 fixes | L | high | should | ST-107 | approve with small fixes |
| ST-109 AI index overview, failed files | yes, with 1 fix | M | medium | should | ST-106, ST-108 | approve with small fixes |
| ST-110 Replace key, change models | one scenario not assertable | M | medium | should | ST-104, ST-106 | approve with small fixes |
| ST-111 Earlier AI assessments | yes | S | low | should | ST-107, **ST-108 (added)** | approve with small fixes |

Priority: all `should`, deliberately. The backlog order is priority, then ID, and the user fixed the order
ST-104 → … → ST-111. Lowering ST-111 to `could` would push it behind every other `should` story, past the agreed
order. Value-wise ST-111 and ST-110 are the least urgent (see 7). No story touches a non-goal; the roles
(technician, team member) are glossary roles; the feature matches `vision.md` lines 42–47 and 74.

Hook note: the validator warns "ST-106 size XL – split the story". That is the finding in 2.

## 1. The requirements-engineer's flagged points

### 1.1 The extra splits and the stopgap

- **ST-104 / ST-110 (approve).** Together they are about 18 scenarios and a form of three jobs (set up, replace the
  key, change models with a cost warning). The cut follows a real seam: ST-110's warning page needs the indexing
  (ST-106) to exist. A separate benefit: nothing of the feature is visible while AI is off, so ST-104..ST-109 can merge
  one by one without a feature flag.
- **ST-107 / ST-108 (approve).** ST-107 is already L with 9 scenarios. Folding the failure reasons, the break-off and
  the cron in would make it XL. ST-108 is the part that needs the clock and the hold logic; keeping it apart makes the
  ST-107 tests simple.
- **Daily retry split ST-108 / ST-109 (approve).** The cron job and the left-behind AI assessments belong to ST-108;
  failed files belong to ST-109, which needs the failed-file state and the retry rule HS-32. The dependency
  ST-109 → ST-108 is genuine (it extends the cron's work).
- **Stopgap until ST-110 (approve, one fix).** "The form shows the saved models and key without offering a change"
  must not lock a *missing* part: a technician who saved only a key (or only models) has to be able to complete it.
  Add to ST-104's Out of Scope / Context: "A part that is not saved yet can always be chosen or entered; only a saved
  part is shown without a change until ST-110." Add the matching assertion to scenario "Before any change AI is off…"
  or to the happy path (key first, models in a second save leaves AI off until all three are saved). Fallout is limited:
  a wrongly chosen model can only be corrected after ST-110, but AI is invisible and unused before the whole feature is
  done, so this is acceptable.

### 1.2 The spike ST-105 before ST-106 (approve – keep it before, with fixes)

Right call: the result can change the AGG-AiIndexEntry whole-entry invariant, ADR 0015 and ST-106's size.

- **Timebox 1 day: acceptable, but tight.** It holds if the measuring code is a throw-away route on a branch whose
  preview already deploys. If at the end of the day the first manual is measured, record the rest as "not answered" –
  the story's rule already allows it. Order the checklist so that the decisive items come first (see below).
- **What decides it:** (a) can a ~100 MB scanned PDF be read, rendered, embedded inside ~600 s and within 2/4 GB;
  (b) if not, from which page count. Add as the **first** checklist item: "One page image and one text passage embedded
  through OpenRouter's embeddings endpoint with `google/gemini-embedding-2` at 1536 numbers return a vector" – the whole
  design stands on OpenRouter accepting images for embeddings, and this takes minutes to learn.
- **Add:** "tokens billed per page image and per text passage" – ST-110's cost estimate needs a per-item token (or
  price) constant and has none (see ST-110).
- **Add:** "the chat model accepts N page images plus the photos in one request" (maximum images per request of the
  default chat model) – it decides the cap in ST-107's open question.
- **Does it need the user's OpenRouter key on a preview? Yes**, there is no other way to measure real time/cost on
  Vercel. Recommendation: the user sets it as a *preview-scoped* environment variable of the spike branch only (never
  in a file, never in the settings, as the spike already says), with a low spending limit on the key (for example
  5 US dollars) and zero data retention switched on in the account – otherwise `zdr: true` requests can fail with
  "no provider". The key is removed after the spike. Nobody pastes the value into the session; the agent only reads
  that the variable exists.
- **Clarify acceptance criterion 1:** previews use their own store, not production's (ADR 0012/0009 setup). Say how the
  two manuals get into the preview's store (the technicians upload them there), otherwise "as they are in the store"
  is ambiguous.
- Size M (1 day), risk high (native `@napi-rs/canvas` on Vercel, unknown limits). No `ui`.
- The manuals are museum files, not visitor data, so the spike does not hit the privacy-notice constraint; say so in
  the Notes.

### 1.3 The `[OPEN]` items – recommended answers

| Story | Question | Recommended answer |
|---|---|---|
| ST-104 | Wording of „KI“; is "Entfernen" one tap? | Accept the recommendation in `OPEN_QUESTIONS.md`, with three fixes: the list entry of an *embedding* model shows one price only („0,15 $ pro Mio. Token (Eingabe)“), the chat model shows input / output; the confirmation „Schlüssel entfernt. KI ist aus.“ stays (it names the consequence, so one tap without a question page is consistent with G10c); the label „Embedding-Modell“ is settled in `CONTEXT.md`. |
| ST-107 | How many resolved defects and hits? | The 5 latest resolved defects with closing notes. Search: the note and each photo is one search; each search takes the 8 best text passages and 4 best pages/images; results are merged, de-duplicated and **cut to 12 pages/images in total** before they are sent. Also cap the photos of problem reports at the 10 newest (a defect with many reports could exceed a chat model's image limit). Constants in the code; but add the caps to a scenario so they are tested: "Never more than 12 pages and images from the AI index are sent" (see ST-107 fixes). The sentence "4 per search, together at most 12" in the recommendation is otherwise ambiguous with up to 6 searches. |
| ST-107 | Place of the section and texts | Right below the defect's actions (G22), above problem reports and work log – accepted; the person is waiting for it. Texts as recommended. One addition: show the section only if the viewer may request or the defect has at least one AI assessment (otherwise a helper sees an empty section on a not-suitable defect; G37 spirit). Then the empty text „Noch keine KI-Einschätzung…“ appears only together with the action. |
| ST-108 | What does „Erneut versuchen“ do with note and photos? | (a) one tap, same note and photos – accepted. Implication for the domain-architect: two AI assessments then refer to the same stored photos (the file/photo lifecycle of ADR 0009 must not delete them while either refers to them). The scenario must assert that the new AI assessment carries the failed one's note and photos (missing now). |
| ST-108 | German reason texts | Accept, with one change: „Eine Techniker:in kann ihn unter Einstellungen ersetzen.“ → „Techniker:innen können ihn unter Einstellungen ersetzen.“ (glossary form `Techniker:in`, no article problem). |
| ST-109 | Overview and mark while AI is off | Neither is shown while AI is off – accepted (the form „KI“ says what is missing; a file is not "unreadable for the AI" while there is no AI; „Erneut versuchen“ is not offered). Tension with G37 ("existing content stays visible"): the *files* stay, the *overview* is not content. Consequence the user should know: the cost so far is not visible while AI is off. Needs one scenario (see ST-109 fixes). |
| ST-109 | German texts | Accept; change the confirmation to „Eight Ball Schematic wird erneut für die KI erfasst.“ (no nested „„ quotes). |
| ST-110 | German texts | Accept as recommended, including the question page without „Endgültig“ and without red (G30) and the 0,60 $ example – but see the estimate fix below: the number must come from a stated rule. |

## 2. Per story

### ST-104 – approve with small fixes (L, medium)

L: new module BC-AiAssistance start, encrypted key at rest, the OpenRouter adapter with model list, key check and a
test embedding, versioned singleton, journal, page rename touching three done stories' browser tests. Ten scenarios, at
the limit. Vertical. Risk medium (first external integration and first secret; `/security-review` is in the DoD).

Fixes:
1. **Scenarios "A model that does not read images…" and "An embedding model that does not return 1536…" mix two
   inputs.** The Context says models are *chosen from the list* and typed only when the list cannot be loaded; the
   scenarios say "typed" while "OpenRouter offers" the list, and also assert "the list offers neither model to
   choose". Rewrite: the list-loaded case asserts the entries are marked and cannot be chosen („· passt nicht“); the
   rejection of a typed ID is tested in the "list cannot be loaded" case (turn it into a Scenario Outline with the
   examples text-only chat model, text-only embedding model, 768-number embedding model – still one scenario, three
   examples).
2. **Stopgap for a missing part** (see 1.1).
3. **Definition of done, add item 4:** "The seam catalog in `.claude/skills/engineering-conventions/SKILL.md` gets the AI
   seam (in-memory adapter for tests) and how the OpenRouter adapter itself is tested – it is not in the catalog
   yet." Seams outside the catalog this story needs: the AI seam, the OpenRouter adapter against a fake HTTP server
   (new), the key encryption (unit test at the pure encrypt/decrypt function). The user decides these in the test
   plan.
4. The change of tests of the done stories ST-100/102/103 to the new label is allowed (a rename, not a weakening);
   say in the Context that titles of those tests stay unchanged.
5. The decrypt-failure case ("A saved key that can no longer be read turns AI off") sits in ST-110 although ST-104
   builds the encryption. ST-104 has no room (10 scenarios). Accept, but write in ST-104's Context that the state
   exists from this story on ("a key that cannot be decrypted counts as no key") so it is not forgotten; ST-110 tests it.

Review lane: normal plus `/security-review` (already in the DoD). Not light.

### ST-105 – approve with small fixes (M, high)

See 1.2. Add the three checklist items (embedding of an image works; tokens per item; images per chat request) and the
store clarification.

### ST-106 – needs rework (XL as written; L after the split, high)

Scenarios are testable and within 10, but the story is XL because its Definition of done is a foundation: pgvector
image and migration, the worker route with `CRON_SECRET` and the preview bypass, holds, budget, self-continuation, the
engineering-conventions section, plus PDF rendering with a native dependency, the removal lock in Collection's
`CMD-RemoveFile`, and two policies. The skills rule is explicit: groundwork several stories need is a tech task, not
a hidden DoD list (ST-050/ST-079 precedent).

**Concrete split (recommended):**
- **New tech task "Background work for AI: worker route, holds, budget, continuation" (ST-112, checklist)**:
  `/api/ai-work` with `CRON_SECRET` and preview bypass; hold records with `FOR UPDATE SKIP LOCKED`; run budget and
  self-continuation; the injected run function for tests; `docs/operations/` steps for both secrets;
  `pgvector/pgvector:pg17` image and the `vector` migration (CI included); the seam-catalog section *Background work*;
  `depends_on: [ST-105]` (ADR 0015 accepted, the spike's verdict decides whether progress is stored per page). Size M,
  risk high.
- **ST-106 keeps** the indexing behaviour (10 scenarios), `depends_on: [ST-104, ST-105, ST-112]`, size L. If the spike
  says a large PDF needs page-by-page progress, the invariant "replaced as a whole" changes and this story goes back
  to `review` anyway (already stated in ST-105).
- `ST-107` and later then depend transitively; do not add edges just for order.
- Optional second cut if L proves too large in `/implement`: scenario 1 (PDF) and the PDF rendering into their own story
  after the text/image/removal part.

Further fixes (small):
1. Scenario "A failure at OpenRouter keeps nothing of the file" becomes a Scenario Outline with two examples (stops
   answering → "OpenRouter not reachable"; refuses → "OpenRouter refused"). "OpenRouter refused" has no test now.
2. Scenario "Turning AI off…" conflicts with the vision, see section 4, finding A.
3. Add a stale-page/forged case is not needed here (no form).
4. The Context says the policy "A policy run skips a file that already has an entry" – fine; but "tests drive one run
   directly" is only possible once the catalog has the seam (tech task).

Review lane: normal, **plus `/code-review`** (L/XL, shared platform code, change to Collection's removal) **and
`/security-review`** (parses uploaded PDFs with `pdfjs-dist` and a native canvas – untrusted input; worker route
accepting a secret; key decrypted inside runs).

### ST-107 – approve with small fixes (L, high)

L: request form with photos, the chat call with RAG per photo, structured answer, the defect page section that
refreshes itself, helper permission rules, concurrency rule. Vertical, valuable. Risk high: visitors' data leaves
La Guardia for the first time; a chat model's answer is untrusted structured output. Nine scenarios.
Not split further (the halves would deliver no value). If `/implement` finds it too large, the cut is the request
photos and the per-photo search (scenarios 1, 3, 4, 8) into a follow-up.

Fixes:
1. **Gap: an unusable chat answer.** The invariant says references name only files of the defect's machine or its
   model, and only a written assessment has summary/causes/checks/references. Nothing says what happens when the
   model answers empty, not parseable, or with a reference to a file that is not the machine's. Recommendation: invalid
   references are dropped (the invariant holds), an answer without a usable summary fails the assessment. That
   needs a failure reason beyond the six in `AssessmentFailureReason` – see question Q1. Add one scenario ("A reference
   to a file of another machine is dropped" or "An unusable answer fails") – there is room once scenario 8 goes.
2. **Scenario 8 (too many photos) restates a defined pattern** (ST-032's photo step and G8/G8a: the limit, the kept
   input). Drop it; put "photos as on a work log entry (shared photo step, ST-032)" in the Definition of done. Free
   slot for item 1 and item 3.
3. **Test the caps** (see 1.3): scenario 3 gets "And never more than 12 pages and images from the AI index are sent".
4. Scenario 4: add a second machine of the same model, "LG-043", whose manual is indexed and must not be found – the
   current Given lets a search over the whole model pass.
5. Scenario 5 (helper): add "And no empty section „KI-Einschätzungen“ is shown to the helper where nothing can be
   requested and nothing exists" (see 1.3).
6. Scenario 1 "the page refreshes itself, also without JavaScript" is testable (an automatic refresh in the page), but
   name it as one observable: "the page carries an automatic refresh" – the e2e test checks the refresh and a
   no-JavaScript browser context.
7. Context: say what happens to a request for a defect whose machine has no indexed file: the chat model is sent the
   defect alone (still valuable). Today implicit; one sentence.

UX lens: the screen's job (request) and entry (action in the section) are named; empty, rejected and no-permission
cases exist; G2a/G3/G8a/G11/G16/G34/G35/G37/G38 are referenced, not restated, apart from scenario 8.

Review lane: normal plus `/security-review` (already in the DoD). Seams outside the catalog: the run function with the
AI stand-in (tech task), the page-refresh e2e (catalog row "page flow" covers), the structured-answer parser (unit).

### ST-108 – approve with small fixes (L, high)

L: six failure reasons mapped from OpenRouter answers, the hold logic with a second attempt, version-guarded late
results, page-triggered runs, cron. Nine scenarios (a Scenario Outline counts as one for the validator). Risk high:
time and concurrency, and the cron cannot be tested on previews (Vercel runs crons in production only).

Optional cut if it proves too large: scenarios 4–6 and 9 (break-off, second break-off, late result, daily retry – the
"AI work left behind" part with the cron) into their own story; the rest (failure reasons, retry, AI off, resolved,
removed reference) is then M. ST-109 would depend on the left-behind story. Not required for review.

Fixes:
1. **Conflict with ST-107/ST-111** (see section 4, finding B): "the failed one is still shown with its reason" cannot hold
   before ST-111. Reword to: "And the failed AI assessment is kept as it is, its reason unchanged, and the defect has
   two AI assessments" – testable at the read model. Visibility moves to ST-111.
2. Scenario „Erneut versuchen“: add "And the new AI assessment carries the note and photos of the failed one" (answer
   to the open question).
3. Add to the Definition of done: the first run of the cron on production is checked by hand, because previews cannot
   run it (`docs/operations/` already gets the check; name the first run explicitly).
4. Page-triggered run (scenario 4): the defect page's GET starts work. The hold makes it idempotent; ADR input: bound
   the number of page-triggered starts (only when a hold has run out), and the self-call uses the server-side secret
   – never exposed to the browser. `/security-review` is warranted for this story too (a GET that starts paid work);
   add it to the lane.
5. The "key invalid" reason text mentions „Einstellungen“ – see 1.3.

Review lane: normal plus `/security-review` and, because it extends shared run code, `/code-review` is optional.

### ST-109 – approve with small fixes (M, medium)

Overview read model, retry command, rule "once a day each", mark on the machine record. Nine scenarios. Value: the
cost and the unreadable files are what the technicians need to trust the index (G38's reason).

Fixes:
1. **Add a scenario** for the answer of the open question: "While AI is off the overview and the mark are not shown;
   they are shown unchanged after AI is turned on" (10 scenarios).
2. Scenario "Only a failed file can be tried again": add "And a retry sent while AI is off is rejected" or put it in the
   helper scenario (rule: only while AI is on is not tested now).
3. "At most once a day each" must be measurable. Define it in the Context: a failed file is retried by the night run
   only if its last failure is not from the same night (calendar day, Europe/Berlin, `fixedClock`). The current
   scenario hints at it; name the rule.
4. Daily retry itself: "Vercel runs it for production only" – the scenario drives the run function; same note as ST-108.

Review lane: light is not allowed (a command, a new event path `CMD-IndexFileForAi` by hand); normal lane.

### ST-110 – approve with small fixes (M, medium)

Fixes:
1. **Scenario "Changing the embedding model warns what indexing again will cost" is not assertable** – "an estimate of
   the cost from 1200 pages and images and the new model's price" has no stated formula. State the rule in the Context
   (items × tokens per item × price per million tokens) and the constant from the spike's measurement, and use numbers
   in the scenario: "price 0,15 $ per million tokens, 1200 items → about 0,60 $". The spike must supply the
   tokens-per-item figure (added to ST-105).
2. **Missing case, a race:** an indexing that started with the old model and stores its result after the change.
   Add a scenario (nine): "A file indexed with the earlier model while the change is confirmed still counts as waiting
   for the new model". Needs an agreement with the domain-architect that a store checks the current model, or the entry
   is simply never searched (data model already says so) and stays *waiting*.
3. "A saved key that can no longer be read" stays here (see ST-104 fix 5).
4. The warning page without JavaScript (G10b's shape) is referenced, not restated – good.

Review lane: normal; `/security-review` when the diff touches the key replacement (it does).

### ST-111 – approve with small fixes (S, low)

1. **`depends_on` added: ST-108.** Scenarios 1 and 2 need failed AI assessments (written by ST-108); the Context says
   "or its failure reason (ST-108)".
2. G39 is built here, not restated – correct. Scenario 5 partly repeats ST-107's "AI off" scenario for the newest
   assessment; fine, it covers the folds and the repair history.
3. UX: empty case = none (nothing shown); no-permission = all team members read; no rejected case needed.
4. Review lane: light lane possible (size S, no command, no migration, no form input) – `@acceptance-tester` only.

## 3. Proposed spikes and tech tasks

| Proposal | Why | Placement |
|---|---|---|
| Tech task "Background work for AI" (ST-112) | Foundation hidden in ST-106's DoD (see 2) | before ST-106, after ST-105 |
| Add to ST-105: embedding of an image works; tokens per item; images per chat request | design rests on it; ST-110 needs the constant; ST-107 needs the cap | ST-105 checklist |
| Seam catalog additions: AI seam with in-memory adapter, OpenRouter adapter against a fake HTTP server, the run function, worker route (like `uploadRoute`), `vercel.json` cron scan, PDF fixtures | none of them is in the catalog; "a seam not listed is a decision for the user in the test plan" | ST-104 (AI seam, adapter), tech task (run, route, cron) |
| Operations notes: `AI_SETTINGS_ENCRYPTION_KEY`, `CRON_SECRET`, preview bypass, OpenRouter terms/DPA and the privacy notice before real data | ADR 0014/0015 | ST-104, tech task, before the first real data in ST-107 |

## 4. Findings that conflict

**A. In-flight indexing after AI is turned off vs the vision.**
- `docs/domain/events.yaml` (CMD-IndexFileForAi rule, line 744; quoted in ST-106 scenario "Turning AI off keeps the AI
  index and stops indexing"): "Only while AI is on – checked when it starts; an indexing that finishes after AI was
  turned off is still kept".
- `docs/product/vision.md` line 46: "… and nothing reaches the AI while AI is off."
- ST-106's scenario sends the rest of "Eight Ball Schematic" to OpenRouter after the key was removed. Conflict is
  small (the key is already in memory) but real for a privacy-minded reader, and it costs money after the technician
  stopped it. See question Q2.

**B. ST-108 vs ST-107/ST-111.**
- ST-108 scenario „Erneut versuchen“ asks for a new AI assessment…: "And the failed one is still shown with its reason".
- ST-107 Context: "This story shows the newest AI assessment of the defect… ST-111 adds the earlier ones."
- After the retry the failed one is the *older* one, not shown until ST-111, and ST-108 does not depend on ST-111.
  Resolved by rewording ST-108 (ST-108 fix 1); ST-111 now depends on ST-108.

**C. ST-109 [OPEN] recommendation vs G37.**
- G37: "Content that already exists (earlier AI assessments) stays visible and readable."
- ST-109 recommendation: neither overview nor mark shown while AI is off.
- Not a violation (overview and mark are views, the files stay), but the cost so far disappears while AI is off. Stated
  in 1.3 so the user decides knowingly.

**D. ST-104 internal:** "chosen from the list" vs scenarios that type a model while the list is offered (ST-104 fix 1).

## 5. Technical risks for the ADRs

- **ADR 0014:** whether OpenRouter's embeddings endpoint accepts images for `google/gemini-embedding-2` with the
  provider filter `zdr: true` at all (first spike item); `zdr` needs the account setting, otherwise "no provider".
  `pdfjs-dist` parsing uploaded PDFs is an attack surface (untrusted input in a function holding the decrypted key).
  The test embedding on every save costs a little; bound it (one short text).
- **ADR 0015:** a GET (the refreshing defect page) that starts paid background work needs a bound and the server-side
  secret; crons run on production only, so the daily retry can only be verified after the first production deploy;
  a preview chain may break at the deployment protection (bypass secret). Neon scale-to-zero and a 600 s run: connection
  handling in a run that waits for OpenRouter for minutes (do not hold a connection or transaction during the slow part
  – the ADR says this; the conventions section should make it testable).
- **ADR 0009 interplay:** a retried AI assessment sharing the failed one's photos (see 1.3, ST-108).
- Storage growth: entries of the earlier embedding model stay until replaced (data model) – acceptable, note for ST-110.

## 6. Review lanes

| Story | Lane |
|---|---|
| ST-104 | normal + `/security-review` |
| ST-105 | no review lane (spike, code not merged) |
| ST-106 / tech task | normal + `/code-review` + `/security-review` |
| ST-107 | normal + `/security-review` |
| ST-108 | normal + `/security-review` |
| ST-109 | normal |
| ST-110 | normal + `/security-review` |
| ST-111 | light |

## 7. Value (PO lens)

All eight serve the vision's AI paragraph and no listed non-goal (no triage AI, no follow-up chat, no automatic
assessments, no visitor-facing AI, no notifications – ST-108/109 correctly decline notifications). Real roles throughout.
Least urgent: ST-111 (the older assessments are only a comparison aid) and ST-110 (changing a model); they stay
`should` to keep the agreed order. If the user wants a cut-down first release, ST-110 and ST-111 are the two stories to
leave out.

## 8. Questions for the user (recommended answers first)

1. **An unusable chat answer** (empty, not parseable, only references to other machines' files) has no failure reason
   among the six. Recommended: drop references to files that are not the machine's or its model's (keeps the
   invariant); if no usable summary is left, the AI assessment fails with a new reason *answer unusable*
   („Die Antwort der KI war unbrauchbar.“), one scenario in ST-107 or ST-108. Needs the domain-architect to extend
   `AssessmentFailureReason`.
2. **Indexing already running when AI is turned off:** keep the rule "finishes and is kept" (events.yaml) or follow the
   vision "nothing reaches the AI while AI is off"? Recommended: follow the vision – an indexing checks that AI is on
   before each request to OpenRouter and, if it is off, stops and the file stays *waiting* (never a half entry); ST-106
   scenario 7 changes accordingly ("is not in the AI index, stays waiting, no further request is sent").
3. **Split ST-106** into a tech task for the background-work foundation and the indexing story? Recommended: yes
   (section 2). Together with the spike's preview key: the user sets it as a preview-scoped variable with a low spending
   limit and ZDR on, and removes it afterwards.

## 9. Validation

`node .claude/skills/user-stories/scripts/validate-stories.ts` ran through the edit hook on every story: all valid;
only warning is the XL on ST-106. No story is `ready`; `BACKLOG.md` was not touched.
