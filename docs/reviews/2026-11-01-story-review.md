# Story review 2026-11-01 – ST-112 and ST-106 after the spike ST-105

Scope: both stories went back to `review` when ST-105 (done 2026-11-01) found that the project is on Vercel Hobby
(300 s per function, run budget ≈ 250 s, ≈ 280 PDF pages per run) and ADR 0015 (still `proposed`) gained page-by-page
progress of a PDF. Read: ST-105 *Result*, ADR 0015, `docs/architecture/data-model.md` (progress record of a PDF),
`docs/domain/events.yaml` (`CMD-IndexFileForAi`). All three lenses in one pass; neither story has a screen, so the UX
lens is not applicable (ST-109 shows the index).

| Story | Testable | size | risk | priority | Verdict |
|---|---|---|---|---|---|
| ST-112 background work (tech task) | yes (checklist) | M | high | should | needs small edits |
| ST-106 index files for AI | yes, after edits | L | high | should | needs split (progress across runs becomes its own story) |

Frontmatter set: ST-112 `size: M`, `risk: high`, `priority: should`, `depends_on: [ST-104, ST-105]` (added ST-104: the
run takes the AI seam as an injected dependency, and the settings/key it reads come from ST-104). ST-106 unchanged:
`size: L`, `risk: high`, `priority: should`, `depends_on: [ST-104, ST-112]`. Status untouched.

---

## ST-112 – Background work for AI

Verdict: needs small edits (the spike changes numbers and adds one technical record; scope stays M).

Does the story reflect the spike? Only in the Notes. The checklist still says the old thing – that is the defect.

Proposed edits
1. Checklist item 3 (worker route): `maxDuration = 800` becomes `maxDuration = 300` (Hobby; a longer value fails the
   deployment, ST-105). Drop "more memory only if ST-105 asks for it" – ST-105 answered: ≈ 320 MB, no extra memory.
2. Checklist item 5 (budget): "about 600 of its 800 seconds" becomes "a budget of about 250 of its 300 seconds, a
   setting (a self-hosted server gives it far more)". Add the testable half: a test sets the budget through the injected
   clock/setting and sees the run stop taking work at the budget and call the worker route once. Note for the
   implementer: `maxDuration` must be a literal in the route file, so only the budget can be the setting.
3. New checklist item (continuation across runs, the point of the spike): a stand-in piece of work that needs more than
   one run is continued by the next run from where the previous stopped, and a test drives two or three runs in a
   row with the injected clock. Without it the mechanism ST-106 relies on for 3 files and for PDFs is unproven.
4. New checklist item (hold renewal): a run that stores partial work renews its hold; a hold that is not renewed runs
   out after 15 minutes. Needed because a self-hosted budget can exceed 15 minutes (ADR 0015, "storing renews the hold").
   Test with the injected clock: a piece worked on for 20 minutes with renewals is not taken by a second run; one without
   renewal is.
5. New checklist item (order): a run takes the kinds in the fixed order, and within waiting files those with partial
   progress before the others ("a started PDF finishes before the next one starts"). The stand-in kind can carry a flag
   for it; the real PDF record is ST-106/ST-113's.
6. Task text and Notes: the sentence "the progress record of a PDF is a second kind of technical record beside the
   hold" is ambiguous about who builds it. Say explicitly: **ST-112 builds the hold, its renewal and the order; the
   progress record of a PDF (table, conditional write, drop on removal) belongs to the PDF indexing story**, because it
   holds page numbers and embeddings and `CMD-RemoveFile` has to drop it. Remove "(a longer value fails the deployment)"
   duplication only if you want brevity.
7. Operations item: add that Hobby crons run once a day at most with hourly (not exact) precision – fine for ST-108's
   nightly job, but "at night" is approximate. Also verify (not assume) that "Protection Bypass for Automation" is
   available on Hobby for previews; if not, the preview self-call cannot work and the operations text must say the
   chain on previews is started only by hand/by the next action.
8. Notes, last bullet: "a run of up to 800 seconds" becomes "up to 300 seconds"; the size/risk estimate stands (risk
   high: self-call on previews, first route that starts paid work, connections against a database that scales to zero).
9. First checklist item: ADR 0015 is `proposed`; the item already requires acceptance before building – keep, and
   the user must accept the updated ADR (progress record) before `/implement`.

Testability: every checklist item is checkable. Items 3 and 5 of the old list become numeric after edits 1-2.
Slicing: horizontal by nature (tech task, allowed); stays M after edits 3-5 (each is one test on the same run function).
Dependencies: ST-104 added; ST-105 done.

---

## ST-106 – Files are indexed for AI

Verdict: needs split. The spike's page-by-page progress is a whole extra behaviour (persisted partial work across runs)
and the story is already at the 10-scenario ceiling (10 scenarios, the outline counted once). Adding the new
behaviour as scenarios would exceed it; folding it into the Definition of done would repeat the mistake the rule
about hidden implementation foundations describes.

Does the story reflect the spike? Notes only. Scope, Context, Definition of done and scenarios do not.

Proposed split (recommended, new story would be ST-113, not created by this review)
- **ST-106 (keeps):** everything up to one run – PDF page by page (scenario 1), Markdown/text/images, format and
  readability failures, OpenRouter failure outline, turn on = chain of runs for several files, turning AI off,
  removal in the same step, removal during indexing, indexed once. Size L, risk high.
- **ST-113 (new, proposed):** "A PDF too long for one run is indexed across several runs". `depends_on: [ST-106]`,
  events EVT-FileIndexedForAi, EVT-FileIndexingFailed, EVT-FileLeftAiIndex. Size M, risk high. Scenarios (about 7):
  1. A 568-page-style PDF (use a small budget in the test) is indexed over several runs and the AI index entry appears
     only after the last page, with all pages and one cost (sum of all runs).
  2. While the PDF is half done it counts as waiting and the AI index shows nothing of it (invariant: replace as a whole).
  3. AI turned off in the middle: no further request; the file stays waiting; AI on again with the same embedding
     model continues at the page where it stopped (no page embedded and paid twice).
  4. A different embedding model drops the record and starts again at page 1.
  5. A file removed between two runs: record gone, nothing of it indexed, the later run records nothing
     (extends POL-RemovedFileLeavesAiIndex; touches Collection's `CMD-RemoveFile`).
  6. A failure at OpenRouter in a later run records one failure, keeps no page, and a retry starts at page 1.
  7. Two runs never store pages of the same PDF interleaved (conditional write on last page done) and a started PDF
     finishes before the next one starts.
  Then "if L proves too large" Note in ST-106 can be dropped or points to ST-113.

Why this split and not "PDF out of ST-106": the single-run PDF (scenario 1) is the same code path as one chunk of the
across-runs one; splitting by "across runs" is a clean by-workflow-step slice and keeps ST-106 usable end to end.
Interim limitation to record in ST-106's Notes: until ST-113 is merged a PDF of more than ≈ 280 pages cannot finish on
Hobby and a retry would pay for the same pages again. Nobody is exposed as long as no key is saved (AI is off without
one, ST-104), so building ST-113 directly after ST-106 and before turning AI on in production is enough. Feature order
becomes ST-104 → ST-105 → ST-112 → ST-106 → ST-113 → ST-107 → ST-108 → ST-109 → ST-110 → ST-111 (ST-107 does not
strictly depend on ST-113; do not invent the dependency, say the order in the Notes and use `/implement ST-NNN`).

Edits to ST-106 itself
1. Context, "only while AI is on": „nothing of the file is kept“ conflicts with ADR 0015 / data model (the progress
   record stays when AI is turned off). Reword to: "nothing of the file is in the AI index and no failure is
   recorded; a PDF's progress, a technical record, stays (ST-113)". Scenario 7's Then lines ("nothing of ... is in the
   AI index, no failure recorded, counts as waiting") are already consistent and need no change.
2. Definition of done 1: "its way of indexing a large PDF is followed" is vague. Replace with: the Notes' result is
   followed, namely `wasmUrl` and `iccUrl` so a scanned page does not render blank, and the store check below.
3. A silent-failure guard needs a scenario or an explicit test hook: a scanned page that renders blank must not be
   embedded (ST-105: pdfjs renders blank without an error if the WASM decoders are missing). Cheapest: tie it to
   scenario 1 – page 2 is a scan and "its page image is not blank" (assert non-empty image bytes/size) – no new scenario.
4. "A file whose content is not in the store must fail as not readable" (spike) is only in the Notes. Add it to the
   Context sentence on "not readable" and make scenario 4 an outline with two examples: "a damaged PDF" and "a file
   record whose content is missing from the store" – still one scenario.
5. Scenario 6 wording: "without waiting for the next day" is not testable. Replace the Then with "all 3 are indexed by
   the runs the turning on started, each run beyond the first started by the run before it" and keep the Given
   ("more than one run is needed" – achieved in the test by the injected clock/budget).
6. Scenario 1: "counts 3 pages" and "each with its page number" are fine; add nothing. "The cost of the indexing is
   recorded" – make it a number (e.g. "equal to what the AI seam reported for the 3 pages and their text passages").
7. Notes: the spike summary stays; delete "Back to `review` for the page-by-page progress" at status `ready`.
   Add the interim limitation and the feature order above. Add: tests drive the run function with a small budget and
   a fake clock; no test renders the 568-page manual.
8. Out of Scope: add "A PDF too long for one run – the progress across runs (ST-113)".
9. Cost cap: the spike's figures (≈ 0,00019 $ per page, ≈ 0,11 $ for the largest manual) help ST-110's estimate;
   nothing to change here, but ST-110 (status `ready`) needs a tokens-per-item figure: 258 tokens per page image,
   ≈ 274 per text passage. Recommendation: add that to ST-110's Notes in its next touch.

Testability: after edits 3-6 every scenario maps 1:1 to a test with the injected run function; the "two runs at the same
time" scenario needs a real database in the test (not a mock) – allowed by the seams in `docs/engineering/conventions.md`.
Effort: L is right after taking the progress out. XL otherwise.
Risk: high – native canvas and pdfjs on untrusted PDFs, silent blank renders, first use of the pgvector extension in
production data, removal-lock change in Collection.
Priority: `should`, same as the rest of the feature `ai-assessment`; the feature as a whole is optional for the museum
(vision: AI never blocks the repair workflow), so no `must`.
Value lens: real user (team member), fits the vision, touches no non-goal (no OCR, video, audio; zero data retention is
a Definition-of-done item).
UX lens: no screen; not applicable.

---

## Conflicts with earlier decisions / for ADRs

- ADR 0015 is `proposed`; ST-112 and ST-106 both require its acceptance. The user must accept the updated text before
  either is built.
- ST-112's Notes and ST-106's Notes quote "Hobby, ≈ 250 s"; the checklist of ST-112 still says 800/600 – edits 1-2
  fix this. The `ST-105` story's own Question text still says 800/600, which is historical and stays (done is final).
- Input for the ADR: the progress record stores ≈ 7 MB of vectors for the largest PDF; fine. The decision "a run
  stores pages only directly after the record's last page done (a conditional write)" needs one more word on
  *when* a run stores: after each page, every N pages, or at budget end? A crash between stores loses the unstored
  pages (paid twice). Recommendation: store in small batches (every 10 pages or 60 s), always through the same path,
  also for short PDFs, so there is one code path; ST-113 scenario 3 then holds.
- Also for the ADR: `maxDuration` cannot be an environment variable (static route config), the budget can.
- Hobby cron: once a day, ±59 minutes; acceptable for ADR 0015's daily retry.

## Questions for the user (at most 3)

1. Split ST-106 so that the progress across runs becomes a new story ST-113 (M, built right after ST-106)?
   Recommended answer: yes. The alternative (all in ST-106) breaks the 10-scenario limit and makes it XL.
2. May ST-112 build only the hold, its renewal and the order, and ST-113 the progress record of a PDF?
   Recommended answer: yes (the record is PDF-specific and `CMD-RemoveFile` has to drop it).
3. Should a PDF's progress be stored in batches (every 10 pages or 60 s) for every PDF, also short ones?
   Recommended answer: yes, one code path, at most about 10 pages (≈ 0,002 $) paid twice after a crash.

## Decisions (user, 2026-11-01)

- **D1 – No design around the Vercel Hobby time limit.** No page-by-page progress across runs, no PDF progress
  record, no hold renewal, no size limit or "too large" state. A run indexes a whole file or nothing. The design
  targets a runtime without a short time limit (self-hosting is planned). The proposed split into ST-106 + ST-113 and
  questions 1–3 of this review are void.
- **D2 – Testing during implementation is local** (the local Docker setup), not on Vercel previews. The operations
  item about "Protection Bypass for Automation" on previews is dropped.
- Consequence, accepted: on Hobby a PDF that does not fit one run (≈ 280 pages) does not finish there.
- **D3 – No cron, no automatic retry** (user, 2026-11-01). The daily cron job and every automatic retry of AI work
  are removed (HS-32's daily retry of failed files included). Failed work shows up as failed and is tried again
  only by hand („Erneut versuchen“), or the file is removed. A piece of work broken off by a crash, a deployment or
  the time limit – its hold ran out without a result – is shown as failed (reason: broken off) and likewise only
  retried by hand; it is never taken again automatically, so it never costs twice by itself. Waiting work left by a
  broken self-continuation chain is taken by the next run that any trigger starts (upload, request, turning AI on).
  The Vercel preview bypass secret goes too (D2). ST-085's cleanup of abandoned uploads is not affected.
- **HS-35 (user, 2026-11-01):** opening the form „KI“ starts a run when a hold has run out, like the defect page.
  UI word for *broken off*: „abgebrochen“. *Timed out* stays a separate AI-assessment reason (OpenRouter only).
