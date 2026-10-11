# Code review – ST-028: Resolve a defect with a closing note
Base: main · Commits: 10 · Date: 2026-10-11

Reviewed: the committed state `bbbab34` (`git diff main...HEAD`, 34 files).

Checked: context pack, ADR 0002, `CONTEXT.md` (Closing note, Claim, Suitable for helpers, Closed on retirement), the
engineering conventions (commands, *Histories are append-only lists*, *A command behind a single button*, Server
Actions, event journal, seam catalog), UX guidelines G3, G8, G11, G14, G21, `docs/stories/ST-030-reopen-defect.md`,
`check-language.ts` (7 warnings, the same as on `main`, none in a file of this story). Run by this review: the unit
project (`vitest --project unit`, 32 files, 243 tests, green). **The integration and browser tests were not run**: the
integration run drops and migrates the shared `laguardia_test`, and the acceptance tester works in parallel – the
findings on those tests come from reading them.

How each finding is to be handled is said in the last column: *fix in this story*, *skipped minor*, or *revisit when …*.
None passes the follow-up hurdle – no new story.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Domain model / next story | `src/modules/repair/defect.ts:14-18`, `defects.ts:62-64`, `schema.ts:68-88`; `src/platform/command/history.ts:5-10`; `docs/architecture/data-model.md:172-181` | The resolutions are stored as an append-only history: `saveHistory` inserts entries it does not know and "never changes or deletes a stored one – whatever the state says about it". The data model, however, puts the reopening **on the Resolution** (*Reopen reason*, *Reopened by*, *Reopened at* – "one Resolution per resolve (with its reopening, if any)"), and the comment on `Resolution` says "Its reopening follows with ST-030". Built the obvious way – CMD-ReopenDefect sets the three attributes on the latest resolution in the state – ST-030 would lose them **silently**: the entry's ID is already stored, so nothing is written and nothing fails. Nothing is wrong today (the conventions name "defect resolutions" as a history, the user approved the table), but the trap is laid in this story and the comment points straight into it. Also: the code gives the Resolution an ID (required by Q13), the data model's Resolution rows have none (the work log entry has one). | CLAUDE.md: code and discovery artifacts change together; conventions *Histories are append-only lists* (Q13); data model *Resolution* entity; ST-030 scenario "the earlier resolution with its closing note and the reopen reason are kept". | **Revisit when ST-030 is planned** – it is the existing story that takes it (decide there: reopenings as their own appended entries, or the resolution saved outside `saveHistory`; domain-architect for the data model). **Fix in this story, a few minutes:** replace "Its reopening follows with ST-030" on `Resolution` and on `defectResolution` by one sentence saying that a stored resolution is never updated by the store, so the reopening needs its own decision in ST-030; and add the ID row to the data model's Resolution (domain-architect). |
| 2 | minor | Design | `src/modules/repair/defects.ts:8-64`; `src/modules/collection/machines.ts:19-65` | Second hand-written `AggregateStore`: a private row store whose `toState` returns a state that is knowingly incomplete (`resolutions: [] // loaded separately`), wrapped by an object that repeats `load` / `insert` / `update` to add the history – the same twelve lines as `machines.ts`, down to the comment. The knowledge "a history is loaded with the aggregate and saved after its row, only when the version check passed" now lives in two modules; the work log (ST-024) is the second history of the defect and would be the third use. `toRow` had to change from a spread to a list of columns for the same reason (the state now holds something that is not a column) – correct, and safer than the spread. | codebase-design: locality, a seam every caller re-implements (deletion test: the wrapper's complexity reappears per aggregate); smell: Duplicated Code. conventions *Histories are append-only lists* names only `saveHistory`, not who calls it. | The deepening: `aggregateStore` takes the aggregate's histories (table, owner column, entry ↔ row) and loads and saves them itself. Platform code, so not in this story – **revisit when ST-024 adds the work log**, or in the next `/improve-codebase-architecture`. Skipped minor here. |
| 3 | minor | Design | `src/app/(team)/team/defects/[defectId]/beheben/page.tsx:20`; `defect-details-data.ts:54-58,101,130-132` | (a) The form page calls `loadDefectDetails` – the whole defect page's data – to show a title, a museum number, a machine model title, a version and the refusal: it also loads every problem report of the defect, the names of reporters, claimant and resolver, and **issues short-lived view addresses for the problem reports' photos** (`photoViewAddresses`, a signing call per request), none of which the form page shows. No rule is broken (a team page, behind `requireTeamMember()`), but an address is issued that nobody looks at, and the form page breaks whenever the defect page's data grows (work log, hold). (b) `canResolve` and `whyNotResolvable` are one fact in two fields – the view reads one, the form the other. Without a `viewer` they disagree: `canResolve` is false, `whyNotResolvable` is undefined, and the form would be rendered. Unreachable today (both pages pass the viewer), but the optional `viewer` makes it a silent default. | conventions *Read models* ("selects only what the page shows"), *Photos* (view addresses are issued for a page that shows them); G11; smells: Feature Envy (a), Data Clumps / redundant state (b). | **Fix in this story** (about 20 minutes) or skip: (a) give the form page a narrow data function of its own next to `loadDefectDetails` (defect, machine label, refusal) – or at least keep it from signing photo addresses; (b) keep only `whyNotResolvable` (plus "may be asked at all") and derive the button from it. The main session decides. |
| 4 | minor | Smell | `src/app/(team)/team/defects/[defectId]/defect-details-data.ts:54`; `src/platform/messages/team.de.ts:285-286` | Two doc comments ended up on the wrong line after formatting: `canClaim: boolean; /** How it ended (ST-028) … */` – the comment meant for `resolution` now trails `canClaim`, so `resolution` has none; and in the catalogue the comment for the new texts sits **inside the value expression** of `noneClaimedByYou` (`"Du hast keinen offenen Defekt übernommen." /** Resolving a defect … */,`), which also split that text over two lines. | Readability; smell: Mysterious (misplaced) comment – neither lint nor the type check sees it. | **Fix in this story**, two minutes: put each comment on its own line above the property it describes. |
| 5 | minor | Language / UI text | `src/platform/messages/team.de.ts:287-293,387` | Seven German texts are not from the story and were written by the implementer: „Beheben“, „Defekt beheben · LG-042“, „Als behoben eintragen“, „Zurück zum Defekt“, „Behoben von Anna am …“, „Du hast „…“ behoben.“, „Bitte kurz beschreiben, wie der Defekt behoben wurde.“ They are consistent (the glossary's only fixed wording here is „Abschlussnotiz“, used from `terms`; „beheben / behoben“ matches „Direkt behoben“), the buttons say what happens (G14) and the rejection says what to do (G8). Two things for the user: (a) the button on the defect's page and the submit on the form page name the same action in two wordings („Beheben“ / „Als behoben eintragen“) – G14 allows it, G12 ("the same word on every screen") is about domain things, so this is a wording choice, not a violation; (b) `CONTEXT.md` has no `_UI (de)_` word for resolving a defect or for the state *resolved*, although ST-033 (repair history) and the dashboards will show that state. | CONTEXT.md (`_UI (de)_`), UX guidelines G12, G14, G8; CLAUDE.md "New term → add it to `CONTEXT.md` first". | **For the user to confirm at acceptance** (as in ST-025 #8). (b) is a line for the domain-model owner: when the first screen shows the state as a word (ST-033), „Behoben“ goes into the glossary first. No change needed in this story unless the user wants another wording. |
| 6 | minor | Tests | `src/app/(team)/team/defects/[defectId]/beheben/resolve-defect-rejection.integration.test.ts:110-118`; `src/modules/repair/resolve-defect-command.integration.test.ts:139-159` | (a) The test "answers a version nobody saw – or one someone changed meanwhile – with a conflict" posts `""`, `"abc"` and `"7"` – three versions nobody ever saw. The half of the title after the dash is not exercised: no change is made in between and the old, once-valid version posted. (The domain-explained variant – resolved meanwhile → „nicht mehr offen“ – is covered in the browser test; a *claim* made meanwhile → `version-conflict` with the note kept is not covered anywhere for this form.) (b) The order of the two refusals is not pinned: every "resolved again" case uses a defect suitable for helpers, so a helper on a resolved defect that is **not** suitable for helpers could answer either reason without a test noticing; ST-025 pinned the same order for claiming with a table test. The six scenario tests themselves each check their "Then" through read models and the journal (see below). | tdd skill: a test title is a specification – it must not promise more than the assertions check; seam catalog (decision table test "only where a rule has many cases" – two reasons are no table, one more case at the command seam is enough). | **Fix in this story**, a few minutes: (a) either add the case (claim the defect, then post version `0` → `version-conflict`, state still open) or shorten the title; (b) in "A resolved defect cannot be resolved again" use a defect not suitable for helpers for Anna's attempt, expecting `defect-not-open`. |
| 7 | minor | Tests | `e2e/resolve-defect.spec.ts:17-80` | `unique`, `logIn`, `aMachine`, `aHelper` and now `anOpenDefect`, `openDefect`, `pageWidth` are defined again in this spec – 44 definitions of the first four across the browser tests (27 at ST-025). No leftovers of the copied spec this time. | smell: Duplicated Code; ST-025 review #12. | **Skipped minor** – does not pass the follow-up hurdle; a line for the next `/improve-codebase-architecture` (shared helpers into `e2e/fixtures.ts`). |

## Checked, no finding

- **Command layer (ADR 0002).** `aggregateCommand`, `CMD-ResolveDefect` / `EVT-DefectResolved` / `AGG-Defect` by ID,
  the version in `target`, authorization in `allowedActors` (`helper`, `technician`), the decision pure (actor, clock
  and ID generator from the context – no `new Date()`, no `randomUUID()`), one aggregate, no policy or `runs` – the
  machine status is not touched (HS-6). The journal entry holds `resolvedBy` and the machine, **not** the closing note
  (conventions: no free text in the journal); `resolvedBy` repeats the entry's actor, which `events.yaml` lists as
  event data. The Server Action only calls the runner after `requireTeamMember()`; the acting person comes from the
  session, forged `resolvedBy` / `defectId` fields are ignored (tested).
- **Domain rules.** Not open (resolved and closed on retirement alike: `state !== "open"`), helpers only on defects
  suitable for helpers, closing note required after trimming, the claim ended (`claim: undefined` → both columns
  `null`), one Resolution appended per resolve with ID, resolver and the command's point in time – all in the
  decision. A concurrent second resolve fails the version check, is decided again on the fresh state and answered
  with `defect-not-open` (layer, browser test). "Closed on retirement" cannot be arranged through a command before
  ST-039, so it has no test here – acceptable. "Resolving ends any hold" is not built: out of scope (ST-029), noted
  in the decision.
- **`resolveRefusal` (G11).** One rule, applied by the decision and asked by the page's data function – the pattern
  the conventions describe for CMD-ClaimDefect, no second copy in the page.
- **Store and migration.** `defect_resolution` has its own `id` without a default, the owner column and
  `position bigserial`, loaded ordered by position – as the conventions require for a history. The foreign key to
  `team_member` is hand-written in the migration (`ON DELETE RESTRICT`), `schema.ts` imports nothing of Team. The
  history is saved only after the row passed the version check; a creating command saves an empty list.
  `linkingFacts` still locks the defect's row, so linking and resolving at the same moment wait for each other.
- **The changed ST-018 assertion** (`record-defect-command.integration.test.ts`: `resolutions: []`). Legitimate: the
  test compares the whole stored state with `toEqual`, and the aggregate gained a required list that is empty for a
  new defect. The assertion got stricter, not weaker. (It still reads through `storedDefect`, the side channel noted
  in ST-025 #10 – unchanged by this story.)
- **Replacing the stand-in.** `resolveDefectForTest` and its `CMD-Test…` / `EVT-Test…` IDs are gone; its seven
  callers run the real command with a closing note, for setup only – no assertion of those tests was changed.
- **Module boundaries.** The pages import Repair, Collection and Team through their `index.ts` only; the command
  test's `machineForReporting` is Collection's public query.
- **UX guidelines.** G21: the button on the defect's page leads to a form page of its own, which repeats the defect
  and its machine, keeps the input after a rejection and is not offered once the defect is resolved; landing on the
  defect's page with a confirmation that names the defect (G3). G8: the reason stands directly above the submit,
  the field is marked (`data-invalid`, `aria-invalid`, `aria-describedby`) only when the note is the reason; works
  without JavaScript (browser test). G11: no button for a helper on a defect not suitable for helpers, and the form's
  address says why instead of offering a form. The form is on shadcn's `Field`, not `LabelledField`. The page does
  not swap the form away after a rejection (`whyNot && !state`), as the conventions require.
- **Confirmation driven by `?resolved=1`.** Same pattern as `?claimed=1`: the address alone says nothing – only the
  resolver of a resolved defect is told so (tested: "the address alone makes the page say nothing").
- **Security.** No visitor page touched; the closing note is rendered as text (React escapes, `whitespace-pre-line`),
  never journaled or logged; no team member name or ID leaves the team pages. The closing note has no upper length –
  like every other free text typed by a signed-in team member except the problem report's description; not a finding.
  A forged, malformed bound `defectId` reaches the store unguarded exactly as in the claim action (ST-025) – not new.
- **Language.** Resolve / resolution / closing note / claim / suitable for helpers as in `CONTEXT.md`; the new term
  "Closing note" was added to the glossary with `_Avoid_` words and its `_UI (de)_` wording, and to the catalogue's
  `terms` (the unit test comparing both is green). No `_Avoid_` word in the diff.
- **Scenarios.** All six have a test with the exact title at the command seam, observed through `defectDetails`,
  `openDefects`, `openDefectTitles` and `journalOf` – no database query, no mocked collaborator, expected values are
  literals. "Technician resolves a defect" checks resolver, trimmed closing note, point in time, the ended claim, the
  open defects list and the visitor machine page's titles; "Machine status stays unchanged" checks the status **and**
  that `EVT-DefectResolved` is the only thing journaled for the machine. The first scenario also runs in the browser,
  including a visitor's phone.
- **Scope.** Nothing of ST-029 (hold), ST-030 (reopening) or ST-048 (highlighting) was built.

## Verdict

ready to merge – no blocker and no major: no ADR, domain rule, security rule or scenario is violated.
Most important finding: the append-only resolution history cannot take the reopening the data model puts on the Resolution, and the code comment suggests it can (finding 1) – one sentence now, the decision in ST-030.

## Resolution (implementation, 2026-10-11)

- **#1 fixed (comments), decision left to ST-030:** the comments on `Resolution` (`defect.ts`) and `defectResolution` (`schema.ts`) now say that a stored resolution is never updated and that ST-030 decides where a reopening is kept. Revisit when ST-030 is implemented – also the missing ID row of the Resolution in the data model (domain-architect).
- **#2 skipped:** the second hand-written `AggregateStore` wrapper stays. Revisit when ST-024 adds the work log or at the next `/improve-codebase-architecture` – `aggregateStore` taking its histories is platform code.
- **#3 fixed:** the form page loads only what it shows through `beheben/defect-to-resolve-data.ts` (no names, no photo view addresses). `whyNotResolvable` is gone from the defect page's data; `canResolve` is the one fact there, the form page has `whyNot`.
- **#4 fixed:** both doc comments sit where they belong.
- **#5 for the user to confirm at acceptance:** the German texts „Beheben“, „Defekt beheben · LG-042“, „Als behoben eintragen“, „Zurück zum Defekt“, „Behoben von … am …“, „Du hast „…“ behoben.“, „Bitte kurz beschreiben, wie der Defekt behoben wurde.“ and the new glossary term *Closing note* („Abschlussnotiz“). A UI word for the state *resolved* is due with ST-033.
- **#6 fixed:** the form test posts a version that was true until someone claimed the defect meanwhile; a command test pins the order of the refusals (a helper on a resolved defect not suitable for helpers gets `defect-not-open`).
- **#7 skipped:** the duplicated e2e helpers are a line for the next architecture scan.

Security review: done inline by the implementing session on its own diff, no finding – not an independent review. `/code-review` not run: size S, no change to the command layer.
