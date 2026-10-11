# Code review – ST-024: Log work on a defect
Base: main · Commits: 6 · Date: 2026-10-11

Reviewed: the committed state `b91a953` (`git diff main...HEAD`, 34 files).

Checked: context pack, ADR 0002, `CONTEXT.md` (Work log entry, Claim, Suitable for helpers, Helper, Closed on
retirement), the engineering conventions (commands, *Histories are append-only lists*, *An action on a defect that
needs input*, Server Actions, event journal, version check, seam catalog), UX guidelines G3, G5, G8, G11, G14, G21,
`.github/workflows/e2e-preview.yml` (for the Playwright change), `check-language.ts` (7 warnings, the same as on
`main`, none in a file of this story). Run by this review: the type check (`tsc --noEmit`, clean), lint on the changed
directories (clean) and the unit project (`vitest --project unit`, 32 files, 243 tests, green). **The integration and
browser tests were not run**: the integration run drops and migrates the shared `laguardia_test`, the acceptance
tester works in parallel, and the browser tests need port 3100 – the findings on those tests come from reading them.

How each finding is to be handled is said in the last column: *fix in this story*, *skipped minor*, *for the user*, or
*revisit when …*. None passes the follow-up hurdle – no new story.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | UI text / concurrency | `src/platform/messages/team.de.ts:410`; `src/modules/repair/log-work-command.ts:23`; `src/app/(team)/team/defects/[defectId]/arbeitsschritt/log-work-form.tsx:36,61-65` | CMD-LogWork uses the version check (approved in the test plan). Unlike resolving, nothing domain-specific explains a conflict here: any claim, any other work log entry, any later change of priority or hold made while the person types answers with `version-conflict` – and logging work is the command people will run most often on a defect, two of them at the same bench. The form then shows the shared text „Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.“ That instruction is wrong for this form: per the conventions the rejected form already posts the version stored now, so pressing the button again logs the work (the form test proves it by posting version `1`) – whereas reloading the page, as the text asks, drops what was typed (with JavaScript it is a fresh GET). The text predates this story; this is the first form where it is the expected rejection rather than a rare one. | G8 ("the message says what to do next", "keep what was typed"); conventions *A form on an existing aggregate* (after a rejection the form posts the version stored now). | **For the user to decide; fix in this story if wanted (minutes):** a wording for this form's conflict that says to send it again instead of reloading – or accept the shared text. Not a blocker: nothing is lost unless the person follows the text literally. |
| 2 | minor | Conventions | `.claude/skills/engineering-conventions/SKILL.md:203-208` | The paragraph *An action on a defect that needs input* names `defect-to-resolve-data.ts` as the form page's loader. This story deleted that file and replaced it with the shared `…/[defectId]/defect-form-data.ts` (`loadDefectForForm(db, defectId, refusal)`), and added the second use of the pattern (`…/arbeitsschritt/`, `?logged=1`, a confirmation tied to "the newest entry is yours"). The conventions file is not in the diff, so it now points at a file that does not exist. | conventions, first paragraph ("When the code and this file disagree, raise it"); CLAUDE.md sources of truth (conventions: user approves). | **Fix in this story**, a few minutes, user approves the wording: name the shared loader and the second use; say that the defect's store saves two histories. |
| 3 | minor | Design | `src/modules/repair/defects.ts:14-80` | Third history on a hand-written `AggregateStore` wrapper (machine status history, resolutions, now the work log). The row store's `toState` knowingly returns an incomplete state twice over (`workLog: []`, `resolutions: []`), `load` patches both in (`const [workLog, resolutions] = [await …, await …]` – a sequential read dressed as a tuple), and `saveHistories` knows the one column that needs `undefined → null`. The knowledge "a history is loaded with the aggregate and saved after its row passed the version check" lives in two modules and three places. The user decided to extend the wrapper by hand in this story. | codebase-design: locality, deletion test (the wrapper's complexity reappears per aggregate and per history); smell: Duplicated Code; ST-028 review #2. | The deepening: `aggregateStore` takes the aggregate's histories and loads and saves them itself. **Skipped minor here (user decision) – revisit at the next `/improve-codebase-architecture`**; ST-029 (hold) and ST-032 (photos on entries) will touch the same wrapper. |
| 4 | minor | Design | `src/app/(team)/team/defects/[defectId]/defect-form-data.ts:30`; `src/modules/repair/defects.ts:259-277` | The shared loader of both form pages is a good consolidation (one generic function, the command's refusal passed in – no second copy of a rule). It still reads through `defectDetails`, the defect page's read model, which with this story also loads the **whole work log**, besides every problem report of the defect and the latest resolution – to show a title, a museum number, a machine model title and a version. ST-028 #3 narrowed the page-level data (no names, no photo addresses); the query underneath keeps growing with every story that adds to the defect's page, and both form pages pay for it. Nothing breaks and the amounts are small. | conventions *Read models* ("selects only what the page shows"); smell: Feature Envy. | **Skipped minor – revisit when a third form page of the defect arrives (ST-029 hold, ST-030 reopen)** or at the next architecture scan: a narrow Repair query for "the defect a form acts on" (title, machine, state, suitable for helpers, version). |
| 5 | minor | Tests | `src/modules/repair/log-work-command.integration.test.ts:186-211` | The scenario test "Work log entries cannot be changed" has two halves. The first is exactly the scenario: a stand-in command tries to rewrite and to drop the entry, as helper and as technician, and `defectDetails` still shows Tom's entry unchanged – through the public interface, expected value a literal read before the attempts. The second half verifies through a side channel: raw SQL on `defect_work_log_entry` reading the system column `xmin`, with three commands run inside an outer `db.transaction` (nested transactions) that is not needed for the assertion. It breaks when the table is renamed or the history is stored differently although the behaviour is the same; and "insert-only, never updated" is the guarantee of `saveHistory`, which the conventions say is proven once at the platform seam (`history.integration.test.ts`, a trigger that refuses UPDATE). The final `defectDetails` assertion in that block (Tom's entry still first after logging, claiming, resolving) is fine and worth keeping. | tdd skill: implementation-coupled ("verifies through a side channel – querying the database instead of using the interface"); seam catalog ("not tested at: Drizzle queries in isolation"); conventions *Histories are append-only lists*. | **Fix in this story (minutes) or skip – the main session decides, the test plan was approved with it:** drop the `xmin` reads and the outer transaction, keep the three later commands and the read-model assertion. Not weakening the scenario: its "Then" is checked by the first half. |
| 6 | minor | Tests | `src/app/(team)/team/defects/[defectId]/defect-details.integration.test.ts:391-403`; `defect-details-data.ts:153`; `defect-details.tsx:61` | The confirmation after logging work is shown when the address says `?logged=1` **and** the newest entry is the viewer's (`youLoggedLast`). The test pins "the address alone confirms nothing" only for an empty work log. The case the rule exists for – the newest entry is someone else's and another team member opens the address – is not exercised: replacing `youLoggedLast` by `workLog.length > 0` would pass every test. (ST-028 pinned the equivalent for resolving with the other person.) | tdd skill: a comment/title must not promise more than the assertions check; G3. | **Fix in this story**, a few minutes: in the same test, let Tom look at the page with `justLoggedWork` after Anna's entry and expect no confirmation. |
| 7 | minor | Test infrastructure | `playwright.config.ts:26-28` | Judgement asked for: **acceptable.** The limit applies only to local runs (`baseURL` unset); the preview run in CI sets `BASE_URL` (`e2e-preview.yml`) and keeps Playwright's default, so nothing in CI changes and no test was weakened – fewer workers against one `next dev` is a load setting, not a looser assertion or a longer timeout. Three notes: (a) `4` is a fixed number, not a cap – Playwright's default is half the logical cores, so on a machine with fewer than eight cores this now *raises* the number of workers; the comment's "8 here" describes one machine. (b) The cause stays (one dev server compiling routes on demand), so the 30 s timeout returns as the suite grows – the comment should say that this is the knob. (c) The conventions' *Tests* section describes the local browser run in detail and does not mention it. | conventions *Tests* (local browser tests, ST-083); smell: magic number bound to one machine. | **Fix in this story, 5 minutes, or skip:** make it a cap (the smaller of 4 and the default) and add one line to the conventions' browser-test paragraph. No story. |
| 8 | minor | Language / UI text / G21 | `src/platform/messages/team.de.ts:295-305,400`; `src/app/(team)/team/defects/[defectId]/defect-details.tsx:76-103` | (a) Nine German texts are not from the story and were written by the implementer: „Arbeitsschritte“, „Noch kein Arbeitsschritt eingetragen.“, „Verwendete Teile: …“, „Letzter Arbeitsschritt: 06.10.2026, 11:30 · Anna“, „Arbeitsschritt eintragen“ (button, page title and submit – one wording for the action, G14), „Was wurde gemacht?“, „Verwendete Teile (optional)“, „Arbeitsschritt zu „…“ eingetragen.“, „Bitte kurz beschreiben, was gemacht wurde.“ They use the glossary's „Arbeitsschritt“ from `terms` consistently, the rejection says what to do (G8), the confirmation names the defect (G3). "Parts used" has no `_UI (de)_` word – it is an attribute of the work log entry, not a glossary term, so no rule is broken; ST-033 (repair history) will show it again and should reuse „Verwendete Teile“. (b) The defect's page now offers three actions in the order claim / take over, „Arbeitsschritt eintragen“ (outline), „Beheben“. G21 wants the order "fixed by the stories that add them"; ST-024 says nothing about the place of its button, so the order was chosen in the code. | CONTEXT.md (`_UI (de)_`), UX guidelines G3, G8, G14, G21; CLAUDE.md "Don't guess". | **For the user to confirm at acceptance** (as ST-028 #5): the texts and the button order. If the order is confirmed, one line in the G21 entry of the UX guidelines (ux-designer) keeps ST-029/ST-030 from guessing again. No code change unless the user wants another wording. |
| 9 | minor | Smell | `e2e/log-work.spec.ts:17-92`; `src/modules/repair/problem-report-stand-ins.test-support.ts:239-269` | (a) `unique`, `logIn`, `aMachine`, `aHelper`, `anOpenDefect`, `openDefect`, `pageWidth` are defined once more in this spec (ST-025 #12, ST-028 #7). (b) The stand-in `tamperWithWorkLogForTest` – a command on a defect – lives in a file named after problem reports, next to `storedDefect`; the file's name no longer says what it holds. | smell: Duplicated Code, Mysterious Name. | **Skipped minor** – below the follow-up hurdle; two lines for the next `/improve-codebase-architecture` (shared browser-test helpers into `e2e/fixtures.ts`; split or rename the Repair test support). |

## Checked, no finding

- **Command layer (ADR 0002).** `aggregateCommand`, `CMD-LogWork` / `EVT-WorkLogged` / `AGG-Defect` by ID, the version
  in `target`, authorization in `allowedActors` (`helper`, `technician` – no visitor, no system), the decision pure
  (acting person, clock and ID generator from the context – no `new Date()`, no `randomUUID()`), one aggregate, no
  policy and no `runs`. The journal entry holds the work log entry's ID, who logged it and the machine – **not** what
  was done or the parts used (conventions: no free text in the journal; tested). The Server Action calls only the
  runner after `requireTeamMember()`; the acting person comes from the session, forged `loggedBy` / `loggedAt` /
  `defectId` fields are ignored (tested).
- **Domain rules.** Not open is refused for resolved and closed on retirement alike (`state !== "open"`); what was
  done is required after trimming; empty parts become "none"; every team member may log, with or without a claim,
  also on a defect not suitable for helpers (the decision never looks at claim, role or the mark – HS-8); logging
  does not claim and does not change the state. The entry gets its ID from the injected generator, the acting person
  and the command's point in time; it is appended, never replaced. Insert-only storage through `saveHistory`, saved
  only after the row passed the version check. Hold (ST-029) and photos (ST-032) are not built.
- **`logWorkRefusal` (G11).** One rule, applied by the decision and asked by both pages; the button is not offered on
  a defect that is not open, and the form's address then says why – unless there is an action state to keep
  (`whyNot && !state`), as the conventions require.
- **Schema and migration.** `defect_work_log_entry` has its own `id` without a default, the owner column, `position
  bigserial`, an index on the owner; loaded ordered by position. The foreign key to `team_member` is hand-written at
  the end of the migration (`ON DELETE RESTRICT`), `schema.ts` imports nothing of Team. No trigger on the real table,
  as the conventions decide.
- **Read models.** `openDefects.lastWorkLogEntry` is computed on read (two correlated subqueries by `position`, the
  entry stored last) and carries IDs only; the page composes the name through Team's `teamMemberNames`. The list
  shows when and who, not the text (G5, approved). `defectDetails.workLog` is oldest first, the page reverses it. No
  new `RM-…` invented; "Last work log entry" is a field of `RM-OpenDefects` in `events.yaml`.
- **Module boundaries.** Pages import Repair, Collection and Team through `index.ts` only; `index.ts` exports the
  command, the refusal and types – no table, no store.
- **The changed ST-018 assertion** (`record-defect-command.integration.test.ts`: `workLog: []`) and the builder in
  `claim-defect.test.ts`: the aggregate gained a required list that is empty for a new defect; the `toEqual`
  assertion got stricter, not weaker.
- **Scenarios.** All six have a test with the exact title. Five at the command seam, observed through
  `defectDetails`, `openDefects` and `journalOf`; "Defect details show all work log entries newest first" at the
  page-data seam with the view rendered (Monday 05.10., Tuesday 06.10., Wednesday 07.10.2026 – real weekdays; order
  checked on the data and on the markup, expected values literals). "Team member logs work" checks who, trimmed
  texts, the time, the open defects list (by ID at the read model, by name and date in the page test) and the
  journal. The rejections check that nothing was logged and nothing journaled. The browser test covers the flow at
  360 px, the helper case, a defect resolved meanwhile and the form without JavaScript.
- **UX guidelines.** G21: a button-styled link on the defect's page, a form page of its own that repeats the defect
  and its machine, landing on the defect's page. G3: the confirmation names the defect and the new entry stands at
  the top of the work log. G8: the reason directly above the submit, the field marked only when it is the reason,
  both texts kept, with and without JavaScript. The form is on shadcn's `Field`.
- **Security.** No visitor page touched. What was done and the parts used are rendered as text (React escapes,
  `whitespace-pre-line`), never journaled or logged. `?logged=1` alone makes the page say nothing. Neither text has
  an upper length – as the closing note, which the user accepted in ST-028; a malformed bound `defectId` reaches the
  store as in the claim and resolve actions – not new.
- **Language.** Work log / work log entry / parts used / logged by as in `CONTEXT.md` and the data model; „Arbeitsschritt“
  comes from the catalogue's `terms`. No `_Avoid_` word (no "comment", "note", "repair order") in the diff.
- **Scope.** No photos, nothing on the machine record, no behaviour on hold.

## Verdict

ready to merge – no blocker and no major: no ADR, domain rule, security rule or scenario is violated.
Most important finding: a version conflict is the expected rejection of this form, and the shared text tells the person to reload the page – which drops what they typed, while sending again would have worked (finding 1).

## Resolution (implementation, 2026-10-11)

- **#1 fixed, for the user to confirm:** a version conflict at this form reads „Jemand hat den Defekt inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal eintragen.“ (`defects.logWorkConflict`); the shared conflict text of the other forms is unchanged. The browser test "a claim made meanwhile asks to send again…" walks conflict → texts kept → sent again → logged.
- **#2 fixed, for the user to approve:** the conventions name `defect-form-data.ts`, and say that local browser tests use at most 4 workers.
- **#3 skipped (user's decision in the test plan):** the store wrapper in `defects.ts` saves both histories by hand. Revisit at the next `/improve-codebase-architecture`.
- **#4 skipped:** `loadDefectForForm` reads the defect through `defectDetails`. Revisit when ST-029 or ST-030 adds a third form page.
- **#5 fixed in part:** the outer transaction is gone; the `xmin` check stays – it is what fails when a history save updates a stored row with equal content (tried: an upsert in `saveHistory` fails this test).
- **#6 fixed:** the page test logs an entry by someone else and expects no confirmation for `?logged=1`.
- **#7 fixed:** the local worker count is capped at 4, never raised (`Math.min(4, half the cores)`), with a line in the conventions.
- **#8 for the user to confirm at acceptance:** the German texts and the order of the buttons on the defect's page (claim, „Arbeitsschritt eintragen“, „Beheben“).
- **#9 skipped:** duplicated e2e helpers and the name of the test-support file – a line for the next architecture scan.

Security review: done inline by the implementing session on its own diff, no finding – not an independent review. `/code-review` not run: size S, no change to the command layer.

### After the user's acceptance (2026-10-11)

- **#1, #8 confirmed by the user:** the German texts – including the form's own text for a change made meanwhile – and the order of the buttons on the defect's page (claim, „Arbeitsschritt eintragen“, „Beheben“) stay as written.
- **#2, #7 approved by the user:** at most 4 local workers for the browser tests, and the two changed lines of the engineering conventions.
