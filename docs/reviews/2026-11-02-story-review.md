# Story review 2026-11-02 – feature `files` (ST-113 to ST-119)

Reviewer: lead developer, all three lenses (value, build, UX), one pass. Sources: the seven stories, `OPEN_QUESTIONS.md`
(rows ST-114 to ST-117), `docs/product/vision.md`, `CONTEXT.md`, `docs/domain/events.yaml`, `docs/architecture/data-model.md`,
`docs/domain/context-map.md`, ADR 0018 (accepted), `docs/product/ux-guidelines.md` (G40, G19 row 8a, G10a, G10b, G18 Files),
`src/modules/ai-assistance/ai-work-events.ts`, `src/app/(team)/team/dateien/[fileId]/route.ts`. The user's decisions of
2026-11-02 are not changed; conflicts are flagged.

## Summary table

| Story | Testable | size | risk | priority | depends_on (set) | Split / recommendation |
|---|---|---|---|---|---|---|
| ST-113 | yes | XL | high | should | unchanged | Split in two (decision 1) |
| ST-114 | yes, except 2 `[OPEN]` | L | medium | should | + ST-038, ST-109 | Split off the removal (decision 2); 10 scenarios already, the way back has none |
| ST-115 | yes, one flaky scenario | L | medium | should | + ST-094 | Keep as one; reword the "same moment" scenario; optional split attach / detach |
| ST-116 | yes | M | low | should | unchanged | Ready after two small fixes |
| ST-117 | yes, one soft scenario | L | medium | should | ST-115 replaced by ST-114 | Small fixes; answer retired-machines question |
| ST-118 | yes | L | medium | could | + ST-106 | Test plan starts with a tokenizer proof; one wording fix |
| ST-119 | yes | L | medium | should | + ST-116 | Add missing dependency; optional split name/download |

Priority reasoning: the headline value (a manual exists once, attached to several things, findable) is ST-113 to ST-117
and ST-119 (attached to nothing is the premise of ADR 0018). Content search (ST-118) is the most expensive piece and
the museum has a few hundred files that title, file category, attachment and state filters already narrow; it gets
`could`, so it lands behind ST-119 (same priority orders by ID, so only a lower priority moves it). Nothing here is
`must`: no `must` is needed because `depends_on` already orders the chain. The user may reverse this.

Totals: one XL, five L, one M. That is a large feature for a volunteer team; the order below keeps the app working after every merge.

## Does each slice leave the app working if the next one is not built?

| After | Works? | Remark |
|---|---|---|
| ST-113 | yes | Nothing visible changes except the form "KI" (failed files show title and reason, no machine). Until ST-114 a technician sees a failed file without knowing where it is attached, and "Entfernen" on the machine record still works. Small regression, accept; build ST-114 right after. |
| ST-114 | yes | Details page read-only, removal moved. Without ST-115 nothing attaches or detaches; no dead end. |
| ST-115 | yes | |
| ST-116 | yes | Independent of ST-115. |
| ST-117 | yes | Interim empty text points to "Datei anhängen" on the machine record (exists). "Nirgends angehängt" is only reachable by detaching (ST-115) or by test data. |
| ST-118 | yes | Pure addition to the page. |
| ST-119 | yes | Replaces ST-117's interim sentence. |

Middle of the feature: between ST-113 and ST-115 there is a window in which `EVT-FileAdded` makes AI work and
`EVT-FileAttached` does not, but no command yet attaches an existing file. Consistent, no gap.

## ST-113 – the foundation (size XL, risk high)

Size and risk reasons, all in one story: a data migration of existing files (owner becomes attachment, "Attached by/at"
become "Added by/at", removed files included); the AI index entry loses its machine columns; the pending upload loses its
owner (supersedes ADR 0009 on that point); `CMD-AddFile` replaces the attach command on the machine record; `makesAiWork`
switches from `EVT-FileAttached` to `EVT-FileAdded` (`src/modules/ai-assistance/ai-work-events.ts`, its doc comment and
unit test); `CMD-WriteAiAssessment` reads a list once; the cost reading must accept two journal shapes; the form "KI"
changes; one scenario of a done story is superseded (ST-109). Dropping owner columns is hard to reverse (ADR 0018). Eight
scenarios, nine tests with the outline - within the validator, but the work is larger than the count.

- **[High] Too big for one story. Proposal (decision 1):** split by what is observable, in this order:
  - **ST-113a "Files are attached through attachments"** (L, risk high): migration (scenario 1), machine record shows once
    with "Modell" (2), adding on the machine record through `CMD-AddFile` (3 outline), pending upload bound to the team member
    (4), `EVT-FileAdded` makes AI work. The AI index entry keeps its copied machine columns for now, filled from the
    file's one attachment - sound because nothing can attach a second thing before ST-115. Superseded scenario: none.
  - **ST-113b "An AI assessment follows what the file is attached to"** (M, risk medium): scenarios 5, 6, 7 (read once,
    searched once, read when the writing begins), 8 (cost from old and new journal entries), 9 (failed files without a
    machine, ST-109 supersession), and the migration dropping the machine columns of the index entry and of the journal
    events. Depends on 113a. ST-115 depends on 113b (the first multi-attached file must find the dropped columns gone).
  - The app works after 113a alone. The tech-task alternative (a pure tech task for "owner columns out") is worse: it
    has no observable behaviour. If the user keeps one story: XL, risk high, and the test plan must do the migration first.
- **[Medium] Migration test.** Scenario 1 must be proven with `isolatedTestDatabase(...).reset("<tag before>")`, data inserted
  as production had it, then `.migrate()` (conventions, migration tests table). Data that production has and tests rarely
  have: removed files, files with a pending AI entry, a failed entry, an entry of an old embedding model, a file whose machine
  was retired. Add these to the scenario's fixtures, not new scenarios. The migration runs in the Vercel build; no Vercel preview
  testing (decision of 2026-11-01), so the migration test is the only proof before production - hence risk high.
- **[Medium] Notes: name every done-story test that changes its setup.** The Notes name only ST-109's scenario as superseded.
  Behaviour of these stays, but their setup changes from "attached" to "added" and the tests move:
  ST-106 "An attached PDF manual is indexed page by page" and "Files attached while AI is off are indexed when it is turned
  on"; ST-107 "Only the files of the defect's machine and its machine model are searched" and the reference-dropping scenario
  (they set up the owner on the entry); ST-085's checklist item "for one owner (machine or machine model)" (ADR 0018 already
  supersedes it). `makesAiWork` has a unit test that asserts the old event: it changes with this story. Say so under Notes.
- **[Low] Scenario 3 "the run started by adding it indexes the file for AI"** is asserted through the background run seam
  (ADR 0017); fine, but say "AI is on" also covers the preview of waiting files: the AI work finds the file as waiting, not
  through the event data (events.yaml POL-AttachedFileIsIndexedForAi).
- **[Low] Label `ui`:** the story has no new screen; changes to the machine record and the form "KI" are small. Keep `ui` since
  texts change, but the UX lens finds nothing to add: "Modell" mark and the failed-file line exist as written.
- Conflicts with decisions: none found. AI scope read once when writing begins matches ADR 0018 option 1; upload owner removal
  matches ADR 0018; EVT-FileAdded replaces EVT-FileAttached as in events.yaml.
- Journal note: events.yaml lists `Title` and `Original file name` among the *data* of EVT-FileAdded, EVT-FileDetailsChanged;
  data-model.md says typed text stays out of the journal's data. Not a story conflict (domain-level data versus what the journal stores),
  but a reader of ST-116 will wonder. Suggest one sentence in events.yaml (domain-architect).

## ST-114 – file details page and removal (size L, risk medium)

Reasons for L / medium: a new page composed from Collection (file, attachments, who added), AI assistance (state, reason) and
Team (name); the retry from ST-109; a move of ST-038's removal onto a question page (G10b) with an address that must still
redirect; two stories' pages (machine record, form "KI") change. No new technology.

- **[High] Already at the 10-scenario limit, and the way back (open) has no scenario.** Two open questions are
  about this page; answering the way-back one adds at least two scenarios (back link by origin, landing after a removal from
  the machine record and from the form "KI"). Proposal (decision 2): **split the removal off**:
  - ST-114: page, head, "Angehängt an" (read-only), "KI-Erfassung" with retry, "Details" on the machine record, link from
    the form "KI", not-found and login scenarios (scenarios 1, 2, 3, 4, 5, 9, 10) plus the way back. The machine record keeps
    its "Entfernen" until the next story.
  - New story "Remove a file on its details page" (M, depends on ST-114): scenarios 6, 7, 8, the retired address of
    `datei-entfernen` leading to the details, landing after removal.
  The app works after each. If the user wants one story: keep L and drop the way-back scenarios into the test plan.
- **[Medium] Existing route.** `/team/dateien/[fileId]` is a `route.ts` that redirects to the presigned address (ST-037); machine
  records and AI assessment references link to it. Keep it unchanged and put the details page at its own address below it
  (for example `/team/dateien/[fileId]/details`). Do not flip it (the opener is linked from stored references, "never expires").
  A `route.ts` at `[fileId]` and a `page.tsx` in a child segment should coexist; confirm against
  `node_modules/next/dist/docs/` first (AGENTS.md: this Next.js has breaking changes). Decide in the test plan, as the Notes say.
  Scenario 9 (not found / login) then tests the new address, and a separate smoke assertion that the old opener address still redirects.
- **[Medium] The origin in the address (open question 1) is an open-redirect risk if built as a free "return URL".**
  Allow only three known origins as a closed set (machine record by museum number, form "KI", file overview with its own
  query string whitelisted to its known parameters). A scenario or a test-plan item must try a foreign origin and see the default back link.
- **[Low] Testability:** scenario 3 outline row 3 column text is aligned loosely but the messages are exact. Fine.
  "Opening this page starts no run" is asserted in no scenario - add an And line to scenario 1 or 3 ("and no run was started"); it is the
  one rule the Context makes about HS-33/HS-35.
- **[Low] "Added by Tom" for a file from before** shows who attached it (migration): covered in Context, not asserted. Add an
  example row to scenario 1 or accept as test-plan item.
- UX: entry point, one job, order of sections, G18 order, G10b shape, G11, G37 all present; G-numbers referenced, not restated. Good.
  The question page repeats G10b's shape in prose only; fine.

## ST-115 – attach and detach (size L, risk medium)

Reasons: a new command with a set delta, concurrency (version raise on real change only), a new form page using the grouped
choice built in ST-094, a one-tap detach, a removed file in both. No new technology; the version check exists since ST-038.

- **[Medium] Scenario "Attaching what is already attached changes nothing" is not deterministic** ("both send at the same
  moment"). Reword to a sequence the test controls: "Given the form is open for both and another team member has attached
  'LG-050' since; When the team member sends 'LG-050'; Then the file details with the confirmation and nothing rejected; the journal holds one entry for 'LG-050'". True concurrency can stay in the command's integration test.
- **[Low] Restated pattern:** the Then "what is still offered of the choice is still ticked, in an open group" in the rejection outline
  restates G27/G8. Reference G27 (already in Context) and drop the And line; keep the two rejections.
- **[Low] No "not logged in" scenario**, unlike ST-116, 117, 119. Covered by the runner's generic tests; add one only if the user wants symmetry (10 scenarios already).
- **[Open question] ST-115 / one tap for a retired machine.** Recommend **accept** (one tap everywhere, add one sentence to G10a): the
  file stays a file, the machine is out of the museum, and a second kind of "Lösen" costs a question page and a scenario for a rare case.
- Optional split: attach (scenarios 1 to 4, 9, 10, size M) and detach (5, 6, 7, 8, size M). Not necessary; the two share the page and the version check. Recommend one story at L unless the team wants smaller merges.
- Boundary check: the AI scenario (8) needs ST-113 and the fake chat model; fine.

## ST-116 – correct title and file category (size M, risk low)

Simple form, version check, journal event. Independent of ST-115.

- **[Low] Add an And to scenario 1:** "the journal records the file details changed, naming title and file category". The Context makes the
  rule, scenario 5 asserts the opposite (no record when unchanged), but nothing asserts the positive case.
- **[Low] The hook's G11 note is a false positive:** "Someone not logged in" is authentication, not a role; every team member may do this.
  No change.
- **[Low] Journal:** see the note under ST-113 (events.yaml `Title` in the data of EVT-FileDetailsChanged versus "title stays out of the journal").
- Good: invariants of AGG-File (title, exactly one file category, removed stays removed) each have a rejection scenario.
- No open question. Ready after the And line (or as is).

## ST-117 – file overview (size L, risk medium)

Reasons: first paged list (G40 is built here), filter semantics of HS-36, the AI state composed from AI assistance for the 25 shown
or for all remaining when the state filter is set (two modules, merge in memory), AI-off handling of a bookmarked filter.

- **[Medium] depends_on changed from ST-115 to ST-114.** The story's own note says ST-115 is needed only because "attached to nothing"
  can otherwise not happen. ST-114 does the same trick (sets attachments up in the test data). A dependency for test data is a planning wish; the order is the same
  because ST-115 and ST-116 have lower IDs. Revert if the user prefers the stricter chain.
- **[Medium] Scenario "No file yet says what to do" is soft** ("says that there are no files yet and how one comes in"). Quote the exact
  text from the Context: „Noch keine Dateien. Eine Datei kommt über „Datei anhängen“ auf der Seite eines Geräts dazu.“ with a link to „Geräte“.
- **[Medium] G40 "a page past the end shows the last page" is in the Context but in no scenario.** The story says G40 is tested once here. Add an And to the paging
  scenario: "an address with page 9 shows page 2".
- **[Open question] Retired machines in the filter "Angehängt an".** Recommend **yes**, at the end of the group „Geräte“ as „LG-041 · Ausgemustert“:
  HS-36 counts retired machines for a machine model, their files stay attached and their machine record exists. Add a third example row to the outline:
  option „LG-041 · Ausgemustert“ finds "Model manual" and "Retired notes". No new scenario.
- **[Low] Filter select size:** one native select with groups "Geräte" and "Modelle" holds all machines plus models (some hundred
  options); fine on a phone and without JavaScript. No prototype needed; mention in the test plan that the group's order is museum number, then title.
- **[Low] Interplay with ST-114's way back.** "Zurück zu den Dateien" with the filters and page is the third origin of the closed set (see ST-114).
- UX: G19 row 8a, G40, G4, G5, G7, G18, G37, G32 present; "Angehängt an" deliberately absent from the entry (G18). Good.

## ST-118 – search (size L, risk medium)

Reasons: first PostgreSQL full-text search in the project; a stored word list per passage (a migration over existing passages, no
re-indexing); German and English stemming together; the first in-memory merge across two modules; ordering by three keys. Medium, not high,
because the stack (PostgreSQL) is known and ADR 0018 fixed the shape; high would be right without ADR 0018.

- **[Medium] Tokenization must be defined first.** The story says punctuation separates words ("LG-042", "medieval_manual-v2.pdf"). PostgreSQL's
  default parser keeps `lg-042` and file-like tokens as units and also emits parts. Input for the test plan: normalise words in the application
  (same function for the stored passage text, the original file name, titles and the query), then give the normalised text to `to_tsvector`. First test: the example
  rows of the outline. If this proves harder than expected, that is a spike inside the test plan, not a new story.
- **[Medium] Backfill migration size.** The migration computes the word list for every existing passage in the Vercel build (Hobby, 300 s). Count the passages
  of production first; a few hundred files with some thousand passages is fine. If it ever is not: run in batches inside the migration. Do not add a mechanism to fit Hobby (hosting decision).
  No Vercel preview testing: the migration test (`isolatedTestDatabase`) is the proof.
- **[Low] Wording vs behaviour.** The sentence under the field says content is searched "nur bei Dateien, die für die KI erfasst sind" but a file that waits for the
  *current* embedding model while holding entries of an *old* one is still content-searchable (scenario 7, last line). Either say "für die KI erfasst (auch mit früherem Modell)" in the Context or accept the small imprecision; the sentence is user-facing, so a
  technician may wonder. Recommend leaving the text and adding one line to the Notes.
- **[Low] Scenario 7 holds three assertions** (AI off; no request; other embedding model). Testable, but split the last "And the same holds..." into its own test row when planning.
- **[Low] Scenario 4** (order) is the only scenario about ranking; the three-key order (words in own data, then rank, then content rank, then newest) beyond "own data before content" is not asserted. Acceptable for a first version; note in Out of Scope or add as test-plan unit test of the merge function.
- Depends on ST-106 (the passages) added; transitively ST-113 (original file name).
- Module boundary check is in the Definition of done; good.

## ST-119 – add a file from the overview (size L, risk medium)

Reasons: a form with direct browser upload (ST-085/099), JS-only title prefill, attach choice reused from ST-115, the original file name as download name
(a presigned address carrying a response header from a browser-supplied name), and `/security-review`. The AI scenario crosses all three AI facts.

- **[High, small fix] Missing dependency: ST-116.** Scenario "The original file name is kept and is the name of a download" starts with "a team member corrects the
  first file's title" (CMD-ChangeFileDetails, ST-116). Added to `depends_on`. Alternative: remove that step from the scenario and keep the claim "never changes when the title is corrected" in ST-116.
- **[Medium] Download name behaviour needs one clarification in the test plan:** "saving it offers that name" is asserted on the response header carried by the presigned address, not on a browser dialog. State that in the scenario ("the address that opens the file carries the original file name as its download name"), and cover a hostile name (quotes, CR/LF, path parts) in the security review.
- **[Medium] Optional split** if size is a concern: (a) add from the overview, attached to something or to nothing; (b) original file name shown and used as download name. (b) touches the opener route shared with ST-114's page. Recommend one story unless ST-119 slips.
- **[Low] Scenario 3** has three outcomes (prefill, never over typed text, no prefill without JavaScript); fine as one test with two browser contexts, but tests run locally only (no preview). Needs the e2e project with JavaScript off for the third part.
- **[Low] The hook's G11 note is a false positive** ("not logged in" is not a role). No change.
- Value: "attached to nothing" is the premise of ADR 0018 and needs this story to be reachable from the UI; keep `should`.
- Vision check: no non-goal touched (no OCR, no duplicate detection: "same content twice becomes two files" matches).

## Open questions - recommendations

| Row | Question | Recommendation |
|---|---|---|
| ST-114 (way back, landing) | Origin in the address or always "Dateien" | **Accept the recommendation** (origin through the address), as a closed set of three origins (see ST-114, open-redirect point), and move the removal into its own story (decision 2) so the 10-scenario limit holds. Without an origin: "Zurück zu den Geräten" until ST-117. |
| ST-114 (refresh) | Does "KI-Erfassung" refresh while waiting | **No self-refresh.** A waiting file can wait forever (ADR 0017), the form "KI" does not refresh, and a retry starts a run that ends within minutes; the person reloads. Record as a narrowing of G35 for a file on the details page (ux-designer, `docs/product/ux-guidelines.md`). |
| ST-115 (retired machine, one tap) | One tap everywhere | **Accept**; add one sentence to G10a. |
| ST-117 (retired machines in the filter) | Offer them | **Yes**, at the end of "Geräte" as „LG-041 · Ausgemustert“; one more example row. |

## Spikes, tech tasks, ADR input

- **No spike needed.** The two uncertain items (tokenizer for ST-118, migration of existing data in ST-113) are proven inside the test plans as their first tests.
- **Tech task candidate (optional):** none. The foundation is ST-113 and has observable behaviour. Do not extract "owner columns out" as a tech task; it has no test of its own.
- **ADR input (not decisions):**
  - ST-114: the origin parameter as a closed set (a security point, no ADR needed; conventions line).
  - ST-118: tokenization in the application before `to_tsvector`; German and English stemming in one `tsvector`; where the word list is stored (beside the passage). ADR 0018 already says PostgreSQL full-text search; the details belong in the conventions or a short ADR addendum.
  - ST-119: the original file name becomes a response header through the storage seam (presigned address with a response content disposition): check both adapters (S3 and the in-memory one).
- **Testing:** everything runs locally (SeaweedFS and PostgreSQL via `npm run db:up`); nothing in these stories requires a Vercel preview. The hosting constraints (Hobby, 300 s) affect only the two migrations.

## Decisions needed from the user (recommendations given)

1. **Split ST-113?** Recommend **yes**: 113a (attachments, migration, machine record, `CMD-AddFile`, upload bound to the team member, `EVT-FileAdded` starts AI work) and 113b (AI assessment follows attachments, journal events without machine, cost reading, form "KI"). 113a is L/high, 113b M/medium. If no: one story XL/high, built first and alone.
2. **Split the removal off ST-114?** Recommend **yes**: the way back (answer to the open question) does not fit into the 10-scenario limit otherwise. ST-114 stays page and "KI-Erfassung" (M or L), the new story "Remove a file on its details page" is M.
3. **Accept the three open-question recommendations** (way back / no self-refresh / retired machines in the filter), and the fourth (one tap for a retired machine) - they are small and reversible.

## Small fixes applied directly

- Frontmatter (`size`, `risk`, `priority`, `depends_on`) in all seven stories, as in the table. Changes beyond size and risk:
  ST-114 `+ ST-038, ST-109`; ST-115 `+ ST-094`; ST-117 `ST-115 -> ST-114`; ST-118 `priority: could`, `+ ST-106`; ST-119 `+ ST-116`.
- Status not changed. Stories with `[OPEN]` (ST-114, ST-115, ST-117) cannot become `ready` before the answers are in `OPEN_QUESTIONS.md`.

## Small fixes for the requirements engineer (not applied: not my fields)

1. ST-113 Notes: list the done-story tests whose setup changes (ST-106 two scenarios, ST-107 two, `makesAiWork` unit test).
2. ST-114 scenario 1 or 3: add "no run was started".
3. ST-115 scenario "Attaching what is already attached...": reword to a controllable sequence; drop the restated G27 And in the rejection outline.
4. ST-116 scenario 1: add the journal And.
5. ST-117: quote the exact empty text in the scenario; add the page-past-the-end And; add the retired-machine example row after the answer.
6. ST-118 Notes: one line on a file that waits for the current model but still has entries of an older one.
7. ST-119 scenario 4: state the assertion on the address's download name; keep the ST-116 dependency or drop the step.
8. events.yaml: one sentence reconciling `Title` in event data with "typed text stays out of the journal" (domain-architect).
