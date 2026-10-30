# Code review – refactor-latest-and-all: the machine record's histories as `Latest<Entry>` (architecture review 2026-10-30, K3)
Base: main · Commits: 1 · Date: 2026-10-30

No story: this is a refactoring branch. The yardstick is "no change in what the machine record shows", plus the engineering
conventions ("Read models load a history through its description", "A machine's history on a page of its own") and G24.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Test quality | `src/app/(team)/team/machines/[museumNumber]/latest-with-all.tsx:28` | `linkWhenAny` is now a flag the caller has to remember to pass. It is the only thing that keeps the repair history's rule (the link shows from the first entry, open defects included). No integration test covers the case where `total <= latest.length`, e.g. only an open defect, or 1–3 ended entries. The "3 of 6" test in `machine-record.integration.test.ts:403` passes with or without the flag, and so does "no repair history" (`:394`). Only `e2e/repair-history.spec.ts:41` ("Ganze Reparaturhistorie (1)") catches a dropped flag, and that spec runs locally only (it skips on the preview/CI). This gap was on main already, but the refactor makes the rule easier to lose. | tdd: the scenario's "Then" is guarded only by a test CI skips | Add a page-level integration test: a machine with one open defect (or one resolved defect) shows „Ganze Reparaturhistorie (1)“, and with an open defect only, no ended entry is listed. |
| 2 | minor | Code smell | `src/app/(team)/team/machines/[museumNumber]/machine-record-data.ts:111-130` | The same "name the people in a `Latest`" step is written out three times: `{ ...x, latest: x.latest.map((e) => ({ ...e, who: shown.name(e.who) })) }` for the status history, the repair history and the maintenance records. | Duplicated Code | A small `mapLatest(latest, fn)` next to `Latest`, or a local helper in the data loader. Optional. |
| 3 | minor | Conventions text | `.claude/skills/engineering-conventions/SKILL.md:444-445`, `:718-722` | (a) The first bullet says what a record shows of a history "is `history.latest(db, id, n)`". That holds only for the status history. The maintenance records (an aggregate's rows) and the repair history (put together from defects and problem reports) give a `Latest<Entry>` through their own limited queries. The second paragraph says it correctly ("comes from its module as a `Latest<Entry>`"). (b) Both texts name the link „Alle … (n)“, but the repair history's link is „Ganze Reparaturhistorie (n)“. (c) The new paragraph runs on in the same line as the `BackToMachine` sentence, past the file's usual wrap. | Locality of the convention: a reader should not take the first bullet as "every record history goes through `history()`" | (a) "…is a `Latest<Entry>` – for a history described with `history()`, `history.latest(db, id, n)` –, never the whole history sliced". (b) Say „Alle … (n)“ / „Ganze Reparaturhistorie (n)“, or "the link to the rest". (c) Start a new line. |
| 4 | minor | Test wording | `src/modules/collection/retire-machine-command.integration.test.ts:80` | The comment still says "the record still opens with both status history entries". The assertion now reads `statusHistoryOfMachine`, which is the whole status history (the record's page of its own), not the record. The assertion's meaning is unchanged; only the comment is stale. | tdd: the test reads like its specification | "Its full history stays: the record still opens, and its status history has both entries." |

## Checked, no finding

- **No test weakened.**
  - Every `record?.statusHistory[0]` became `statusHistoryOfMachine(db, record!.id)[0]`. Both are newest first: `load` orders by `position` ascending, then `.reverse()`.
  - Every `toHaveLength(1)` and the insert-only test (`history[1]` equal to `first`) compare the same values.
  - The retire test lists the same two statuses in the same order.
  - `machine-overview.integration.test.ts` still compares the whole record with `toEqual`. Only `statusHistory` moved out, and it is now asserted separately through `latestStatusChanges(…, 5)`, with `total: 1` added. That is stricter than before.
  - The `record!` non-null assertions fail with a TypeError instead of an assertion message when the record is missing. That is a test failure either way.
- **The `latest` query** (`src/platform/command/history.ts:65-79`):
  - It orders by `position desc` with `limit n`, which matches `load` + reverse, including entries saved by one command at the same `changedAt`. The `bigserial` position decides, never the time.
  - The count is filtered by the same owner column, and drizzle's `count()` maps to a number. An unknown ID gives `{ latest: [], total: 0 }`, which is tested.
  - The two statements run as `Promise.all` outside a transaction. A status change committed between them can make the count off by one for that one request. The page then shows the link one entry late, or not at all, until the next load. That is harmless for a read: it shows no wrong data and loses none. Under READ COMMITTED one transaction would not give one snapshot anyway, and `latestMaintenanceRecords` and `recentRepairHistory` did the same on main.
- **Empty states and link rules against main:**
  - Section 5 (maintenance): `total 0` shows „noch keine Wartung eingetragen“. Otherwise it shows the list, plus the link when `total > latest.length`. Same as main.
  - Section 6 (status history): no `emptyText`, because the registration is always an entry. Link when `total > latest.length`. Same as main, covered by the three ST-093 page tests (8 → link, short → none, 5 → none / 6 → link). The only difference: an empty `<ol>` is no longer rendered for an impossible empty history.
  - Section 7 (repair history): `total 0` shows „noch nichts repariert“ and no link. Otherwise the list only if there are ended entries, and the link whenever `total > 0` (`linkWhenAny`). Same as main (see finding 1 for its test).
  - The addresses come from `teamMachinePage("status-historie" | "reparaturhistorie")`, which encodes the museum number exactly like the inline template strings did.
- **Platform change:**
  - `history()` in `history.ts` is the only `History` implementer. `aggregateStore` uses histories only through `StoredList` (`load`/`save`), so the extra method doesn't touch it.
  - No test stand-in or fake `History` exists (searched `src/`), so nothing else had to change.
  - `Entities` is a separate `StoredList` and rightly doesn't gain `latest`.
- **Module boundaries (ADR-0002):**
  - `latestStatusChanges` is exported through Collection's `index.ts`, and the page composes the three modules' answers.
  - No module imports another module's internals.
  - `Latest` is a shape exported from `@/platform/command`, not a cross-module type.
- **Language:** `check-language.ts` reports no warnings in the touched files.
- **Formatting hunks in `machines.ts`** (`update`, `machineLabels`): they are Prettier's output for main's code (main's file fails `prettier --check`), not hand-made noise.

Verdict: ready to merge
Most important: the repair history's "link from the first entry" now hangs on the `linkWhenAny` flag, and only a browser spec that CI skips guards it. Add a page integration test for a repair history with one entry (finding 1).

## Resolution
- **Repair link rule fixed** – a page test with one resolved defect (the record shows every entry) expects „Ganze Reparaturhistorie (1)“; it fails without `linkWhenAny` (checked by removing the flag).
- **Conventions fixed** – `history.latest` named for histories described with `history()`; the link described as „Alle … (n)“ or the repair history's „Ganze Reparaturhistorie (n)“; the new paragraph starts on its own line.
- **Stale comment fixed** in `retire-machine-command.integration.test.ts`.
- **`mapLatest` skipped** – three short maps in one data function; a helper would need a generic key-renaming type for little gain.
