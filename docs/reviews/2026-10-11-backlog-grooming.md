# Backlog grooming 2026-10-11

Scope: every story that is not `done` – 45 open stories. Challenged by product-owner, lead-dev and ux-designer in
parallel, after ST-024 and the architecture review of 2026-10-11. 24 of 58 domain stories are done (226 of 441
scenarios).

The user's stance for this run (2026-10-11): finish the first version, proceed pragmatically, no flood of additional
stories; refactorings are done directly instead of becoming tech-task stories.

**Status of this file:** decided by the user on 2026-10-12 and applied – see section 8. Sections 1–7 are the
proposals as they were put to the user.

## 1. Health check

| Finding | What it turned out to mean |
|---|---|
| ST-080 has an `[OPEN]` marker | Real, and small: login and account creation are not commands, so they cannot use `formAction`. Lead-dev: settle it in the change itself (wrap them in the same `{ error, values }` contract). See ST-080 below. |
| 13 stories may lack the "is not offered" half (G11) | No story change: the commands' refusal rules now decide what a page offers (`defect-actions.ts` for the defect; the same pattern elsewhere). ux-designer: none needs a sentence for it. |
| 11 stories may not say what happens to what was typed (G8) | No story change: every form on the runner keeps its input after a rejection; G8a covers the photo. |
| 9 stories may have no empty case (G7) | Only ST-043 needs a scenario ("Nothing is due"); the others follow the existing "nothing matches" pattern. |
| ST-045/046/047/050 sit three stories deep | Harmless – they are `should`/`wont`. |
| After the product-owner's priority changes: 4 priority inversions (ST-033 waits for ST-029, ST-030, ST-039; ST-042 waits for ST-070) | The consequence of the proposed first-version cut – resolved by the decisions in section 5 (cut the dependencies, or keep the priorities). |

No dependency cycles, no references to IDs `events.yaml` no longer has, no open question older than 30 days.

## 2. What changed since the last grooming (2026-10-01)

- Done: ST-007–ST-013, ST-015–ST-025, ST-028, ST-052, ST-060, ST-064, ST-083 – reporting, triage with all four outcomes
  (also in the same step as reporting), open defects list, the defect's page, claim, log work, resolve.
- Not started: Maintenance (the module is an empty `index.ts`), dashboards, retirement, files.
- Architecture review 2026-10-11 (merged): one module answers what a team member can do to a defect; the aggregate
  store keeps histories; a reopening is an entry of its own (data model); shared test setup; shared form parts.
- User decisions: free-text fields get no maximum length; refactorings directly, not as stories.

## 3. Per story

Priority changes are the product-owner's (already in the files); size/risk changes the lead-dev's (already in the
files); everything else is a proposal.

### First version – stays `must`

| Story | Verdict | Reason / who |
|---|---|---|
| ST-026 Assign and release claims | keep | "Who works on what" (PO). Needs the verbs of G22 in the glossary first (UX). |
| ST-027 Prioritize | keep | Technicians set priorities (PO). |
| ST-048 Technician dashboard | keep; owner of the page | The technician's entry point without notifications (PO). All dependencies done – build it first among the dashboards (lead-dev). Owns the page and its section order (UX, G18). |
| ST-033 Repair history on the machine record | keep; **revise** | Vision success criterion (PO). Answers the open question of 2026-10-04: it already has the scenario "Machine record shows open defects" – it fills ST-009's sections 4 and 7 (PO, UX). Its dependencies on ST-029, ST-030, ST-039 – see conflict A. |
| ST-040 Maintenance plan – view and add | keep; size S/low → **M/medium** | First Maintenance story: schema, module, navigation destination, the store's list kind for entries that change (lead-dev). |
| ST-043 Due maintenance list | keep; **revise** | Must show each due task with its counts first (G4a) and gets a scenario "Nothing is due" (UX). |
| ST-044 Record maintenance | keep | Goal 5 (PO). |
| ST-056 Not on display / return to display | keep | Without it the 5–10 machines not on display are overdue forever (PO). Lacks the `ui` label (UX). |
| ST-061, ST-062, ST-063, ST-065 | keep | Operations, backup, updates, hosting on the museum's team (PO). |
| ST-066 Remove spike scaffolding | keep; **fold into ST-065** | Its code part is done (ST-078); what is left is deleting the spike variable, blobs and rows on the old account – that belongs to moving the hosting (lead-dev). |
| ST-042 Go-live readiness | keep | Loses its dependency on ST-070 if that becomes `should` (PO). |
| ST-068 Browser test of the real visitor flow | **conflict B** | PO: keep `must`. Lead-dev: drop for the first version or `should`. |

### After go-live – `must` → `should` (product-owner)

| Story | Reason | Remarks of the others |
|---|---|---|
| ST-029 Hold / resume | A defect can stay open with a work log entry on day one. | lead-dev plans it in the `must` order – conflict A. |
| ST-030 Reopen | Nothing is resolved long enough in the first weeks; workaround: a new problem report. | lead-dev: risk medium → **low** (history design decided). Conflict A. |
| ST-053 Link reopens a resolved defect | Sits on ST-030. | UX: the story still says "in the triage list" – must offer „Mit Defekt verknüpfen“ for a recently resolved defect (G21, G6a). |
| ST-031 Change defect details | A typo can wait. | lead-dev would merge it with ST-027 – not while their priorities differ. |
| ST-039 Retire a machine | A short trial will not retire a machine. | lead-dev: its scenario names "move it" and "record maintenance", which it does not depend on – move those two rejections into ST-034 and ST-044. UX: the form page names what retiring closes (G10); a retired machine's record shows „Ausgemustert“ in place of the status. |
| ST-049 Helper dashboard | The need "which simple tasks are open" is met by ST-021's filter. | lead-dev: risk low → **medium** (third reader of the journal). UX: owner of the helper dashboard; must not repeat the due maintenance list. |
| ST-058 Technician dashboard: changes, stale claims, overdue | Three extras on top of ST-048. | UX: adds sections 3–5 to ST-048's page; lacks the `ui` label and empty cases. |
| ST-047 Maintenance on the machine record | The due list already answers it. | UX: ST-009 has no section for it – "Section 5 „Wartung“". |
| ST-036 Correct a machine model | A typo workaround exists. | UX: without it the G2a exception of `/team/machine-models` never ends – it must say that a machine model gets its own page. |
| ST-070 Full Content Security Policy | Hardening; basic headers exist. | – |
| ST-079 Event catalogue per module | The journal has one kind of reader. | lead-dev: **drop as a story** – convert the mappings as the opening refactoring of ST-049 (the first story that needs typed journal reads). |
| ST-080 Pre-runner forms | – | lead-dev and UX: **drop as a story**, do it directly; shrink to the login and the own-password page (the members page is rebuilt by ST-081, the machine models page by ST-036). |

### Lower still (product-owner)

- `must` → `could`: ST-081 Find a team member, ST-082 Deactivation asks once – **merge into one S story** (10–15
  people need no search).
- `should` → `could`: ST-032, ST-034, ST-038, ST-054, ST-055, ST-057, ST-067, ST-084.

### Stays as it is

ST-037 Attach files (`should` – conflict C), ST-041, ST-045, ST-050, ST-051 (`should`; UX: ST-051 needs an entry point,
ST-041 asks once before removing), ST-014, ST-035 (`could`), ST-046 (`wont`).

## 4. Conflicts between the three

- **A – the defect lifecycle and the repair history.** The product-owner moves hold (ST-029), reopen (ST-030) and
  retirement (ST-039) behind go-live and wants ST-033 freed of its dependencies on them. The lead-dev says those
  dependencies are real – ST-033's scenarios use an on-hold reason, a reopened defect and "closed on retirement" – and
  plans the three in the `must` order. Both agree that ST-033 should not wait for retirement. Way out: ST-033 keeps only
  what exists at its time; each of the three later stories brings its own "shown in the repair history" scenario.
- **B – ST-068.** Product-owner: it guards the only entry point visitors have. Lead-dev: the flow is covered locally by
  seven tests; what is left is infrastructure (a database branch per preview, a production guard, a seed step) – not
  worth it for the first version.
- **C – ST-037 (files).** Not a conflict between reviewers, but a question only the user can answer: vision goal 4
  (manuals and schematics at the machine) is not met on day one unless ST-037 becomes `must`.

## 5. Decisions for the user

1. The first-version cut (section 3) and conflict A.
2. Conflict B (ST-068).
3. Conflict C (ST-037 on day one?).
4. The structural changes: ST-066 into ST-065; ST-079 and ST-080 no longer stories; ST-081 + ST-082 merged; ST-067
   settled directly (about eight lines of lint policy – the conventions already claim it is enforced, it is not).
5. The proposed guideline G22 for the defect's page (work as buttons, managing behind one fold for technicians) and the
   five verbs it needs in the glossary.
6. Revising the stories of the first version with the sentences in section 3 (ST-033, ST-043; the others when they are
   built).

## 6. Proposed guideline G22 (ux-designer)

**The defect's page offers the work as buttons and the managing behind one fold.**
- *Work*, under the header, for everyone who may (G11), in this order: „Übernehmen“ / „Von Tom übernehmen“ (one's own
  claim: „Abgeben“ in its place) · „Arbeitsschritt eintragen“ · „Beheben“ · „Pausieren“ (or „Fortsetzen“ in its place).
- *„Verwalten“*, technicians only, a fold that opens without JavaScript: „Zuweisen“, „Übernahme von Tom aufheben“,
  „Priorität ändern“, „Titel und Eignung ändern“.
- *Resolved defect*: only „Wieder öffnen“, under „Abschlussnotiz“.
- Claiming and releasing are one tap; every other action has its form page (G21). Nothing asks first (G10). The header
  says a hold in words.
- Not yet in `CONTEXT.md`: „Abgeben“, „Zuweisen“, „Übernahme aufheben“, „Pausieren“, „Fortsetzen“.

Dashboards (G18): ST-048 owns the technician dashboard – sections in this order: problem reports to triage · machines
not playable without open defects · stale claims · overdue maintenance · recent changes (the last three by ST-058).
ST-049 owns the helper dashboard: my claimed defects · open defects for helpers · due maintenance for helpers. ST-050
adds "new since your last visit" to entries, no section. Neither dashboard repeats the due maintenance list – a task
with a count and a link to „Wartung“.

## 7. Not re-litigated

What the grooming of 2026-10-01 settled and nobody challenged: ST-014 only if spam occurs, ST-046 `wont`, ST-035
`could`, the navigation of G19.

## 8. Decisions (user, 2026-10-12) and what was applied

| # | Decision | Applied |
|---|---|---|
| 1a | The first-version cut of the product-owner. ST-033 no longer waits for hold, reopen and retirement – each of those stories brings its own "shown in the repair history" scenario. | 22 priorities (product-owner), 3 sizes/risks (lead-dev); ST-033 `depends_on: [ST-011, ST-019, ST-024]`, its hold / reopen / retirement scenarios moved to ST-029, ST-030, ST-039, which now depend on ST-033. |
| 2a | ST-068 after go-live. | `priority: should`. |
| 3a | Files at the machine (ST-037) are not needed on day one – first story after go-live. | stays `should`. |
| 4a | ST-066 folded into ST-065; ST-079 and ST-080 are no stories any more (ST-079: opening refactoring of ST-049; ST-080: login and own-password form moved directly); ST-081 + ST-082 one S story, `could`; ST-067 settled directly as a lint policy. | ST-066, ST-067, ST-079, ST-080, ST-082 `priority: wont` with the reason in the file; ST-065 took over ST-066's checklist; ST-081 merged; ST-042 without ST-066 and ST-070. The two direct changes follow on their own branch. |
| 5a | G22 for the defect's page and the dashboard owners. | `docs/product/ux-guidelines.md` (G22, G18, changelog – ux-designer); `CONTEXT.md`: *Assign* („Zuweisen“), *Release* („Abgeben“ / „Übernahme aufheben“), *Put on hold* („Pausieren“), *Resume* („Fortsetzen“). |
| 6a | Only the first-version stories are revised now. | ST-033, ST-043 (tasks with counts first, "Nothing is due"), ST-042, ST-065, ST-048 (owner of the technician dashboard), ST-056 (label `ui`). The sentences for the later stories stay in section 3 and are applied when the story is pulled. |

The open question "ST-009, ST-021" (open defects on the machine record) is answered: ST-033.

**After applying:** 81 stories valid; 13 open `must` stories (was 29): ST-026, ST-027, ST-048, ST-033, ST-040, ST-043,
ST-044, ST-056, ST-061, ST-062, ST-063, ST-065, ST-042. Health check: no priority inversion, no `[OPEN]` marker; the
three wording findings (G7, G8, G11) remain and are explained in section 1.

**Left for the story's own review or implementation** (requirements-engineer, not decided here):
- ST-033's scenario "Status and history directly from the QR address" says the repair history is shown "without further
  navigation", while section 7 of the machine record shows the most recent repairs and links to the full history.
- ST-043 reads differently in every scenario now (two-step list) – a ux-designer look before it is built.
- ST-065 took over six checklist items at size S – the lead-dev confirms the size when it is pulled.
- ST-068's body still says no browser test covers the flow; `e2e/report-problem.spec.ts` does.
- ST-081 is a draft with 13 scenarios and goes through `/review-stories` before it is built.
- Unanswered in `OPEN_QUESTIONS.md`: the status a retired machine's record shows (ST-039), the stricter-status rule
  when linking reopens a defect (ST-053), *note* as an `_Avoid_` word (ST-019 / ST-052).
