# Backlog grooming – 2026-10-01

First run of `/groom-backlog`. Scope: all **63 stories that are not `done`**. Challenged in parallel by
`product-owner`, `lead-dev` and `ux-designer`, against `docs/reviews/_change-list-2026-10-01.md` – what has changed
since the backlog was derived in one go on 2026-09-26, when no code existed.

`/review-stories` asks "is this new story ready to build?". This run asked: **would we still write this story today?**

---

## 1. Mechanical health check

`node .claude/skills/groom-backlog/scripts/backlog-health.ts` – **no findings**. No dependency cycles, no story
waiting for a dropped or missing one, no priority inversions, no `ready` blocked by `draft`, no reference to an
`events.yaml` ID that no longer exists (checked deliberately, because the domain model was restructured the same
day), no parked `[OPEN]` marker, no open question older than 30 days.

What it did report is **depth**, and one of those turned out to matter:

| Story | Depth | Verdict after the challenge |
|---|---|---|
| ST-050 new since last visit | 9 | **Depth is real, the content is wrong at that depth** – see finding 2 below |
| ST-030 reopen a defect | 8 | Real. The defect lifecycle in its natural order; every scenario sets up state only the previous command can produce |
| ST-049 helper dashboard | 8 | Real but not minimal – a basic/rich split exists if helpers ever need something sooner |
| ST-026, ST-028 | 7 | Real, same reason as ST-030 |

Shortening those chains would mean testing against fabricated persistence instead of commands, which the
engineering conventions forbid. The depth is the cost of honest test data.

---

## 2. The three findings that change what we build next

### Finding 1 – ST-007 has nowhere to be reached from (the only blocker of this run)

ST-007 builds the first form on the new house pattern. Guideline **G2a** says creating a thing happens on its own
page, reached by a button under the heading of a list. **That list does not exist**: ST-008, the machine overview,
*depends on* ST-007. At the moment ST-007 ships, no page links to it (**G17**).

`ux-designer` proposes: ST-007 delivers the machine overview as a plain list (museum number, machine model title,
location, machine status) with "Neues Gerät" under the heading; **ST-008 then adds the counts, the filter and the
search to a list that already exists.** That also makes ST-008 the first team page with a second destination, so
the team navigation is decided there – see finding 3.

### Finding 2 – ST-050 carries a retrofit whose price rises every week

ST-050's foundation checklist says, verbatim: *"Every command built so far maps its events to journal entries
through its module's catalogue; no per-command mapping is left under `src/`."* That is the **event catalogue**
(architecture review Q4/Q15). Today **two** commands have a journal mapping. At ST-050's position – ninth in its
chain – it would be roughly twenty.

This is the one place where "pull foundation in just in time" inverts: ST-018's `context.run` and ST-012's history
helper are needed by nobody before they are built, so late is free. A retrofit is the opposite – late is
expensive, and ST-050 is the story that notices last. `lead-dev` recommends splitting the catalogue into its own
tech task, placed right after ST-018, before the Repair module keeps growing.

Verified by the main session against the story file, not taken on trust.

### Finding 3 – four screens have no owner, and six stories each add a destination to a navigation nobody decides

- **The machine record:** eleven stories add to it (ST-009, 011, 012, 015, 021, 033, 034, 035, 037, 039, 047) –
  fourteen things on one phone page, in an order no story fixes.
- **The technician dashboard:** four stories add to it (ST-048, 050, 058, and ST-049 for helpers).
- **The team navigation:** ST-007, ST-008, ST-017, ST-021, ST-040 and ST-043 each silently add one destination.
  By the end of the MVP it needs ~10; today it is five in two rows at 360 px. The ux-designer's own screen review
  parked this on ST-048 – **that was wrong, and this run corrects it**: ST-048 is 40th in the order, and four
  destinations arrive before it.
- Two lists are rendered twice: ST-048 vs ST-017 (untriaged problem reports) and ST-058/ST-049 vs ST-043 (due
  maintenance). Not a replacement – two implementations of one list, which drift.

---

## 3. Priorities – the MVP was not a slice

**52 of 63 open stories were `must`.** That cannot be a minimum. `product-owner` moved seven:

| Story | Change | Reason |
|---|---|---|
| ST-049 helper dashboard | should → **must** | The vision names "see which simple tasks are open" as the key need of the helpers – the largest user group. Without it they have no answer to "what can I do right now". `ux-designer` reached the same conclusion independently |
| ST-037 attach files | must → should | Vision goal 4 is real, but no success criterion measures it and nothing in `must` depends on it |
| ST-054 camera photo as a file | must → should | Follows ST-037 |
| ST-034 move a machine | must → should | The story's own rule calls the location informational |
| ST-055 retired machines in views | must → should | A short trial is very unlikely to retire a machine |
| ST-045 record maintenance for several machines | must → should | An efficiency layer over ST-044, which stays `must` |
| ST-046 report a finding during maintenance | could → **wont** | Its only value over ST-015 is not re-selecting the machine. One tap |

Deliberately **not** demoted: ST-022/ST-052/ST-053 (linking duplicate problem reports) – it looks like a
convenience cluster but it is the direct answer to the vision's first problem statement, *"defects get lost,
forgotten or reported twice"*.

**MVP slice** (`product-owner`), on top of the twelve done stories:
ST-069 → ST-007 → ST-008 → ST-009 → ST-060 → ST-010 → ST-011 → ST-012 → ST-013 → ST-015 → ST-017 → ST-018 →
ST-021 → ST-025 → ST-024 → ST-028 → ST-033 → ST-064 → ST-048.

---

## 4. Estimates against reality – the spikes paid off

Every `size` and `risk` in the backlog was guessed against an **empty repository**. `lead-dev` re-estimated against
the code:

| Story | Change | Reason |
|---|---|---|
| ST-043 due maintenance list | risk high → **medium** | Month arithmetic, leap years, DST and the overdue grace period are built and table-tested in `src/platform/time.ts` |
| ST-056 not on display / return to display | risk high → **medium** | `graceDays(start, months)` is literally documented "e.g. the return to display, ST-056" |
| ST-016 photo on a problem report | risk high → **medium** | The camera spike is done and ADR 0007 is accepted. Still legitimately **L**, but the uncertainty is gone |
| ST-050 new since last visit | risk medium → **high** | Finding 2 |
| ST-033 repair history | risk low → **medium** | Not a domain risk – a **test-infrastructure** gap: "loads in under 2 seconds with 5 years of realistic data" has no seam in the seam catalog and no fixture builder anywhere in `src/test-support/` |
| ST-036 correct a machine model | size XS → **S**, `depends_on` + ST-010, ST-043 | Its own scenarios assert "the visitor machine page shows 1997" (ST-010) and "is no longer listed as **due**" (ST-043). The dependencies were missing, not fictional |
| ST-030 reopen a defect | `depends_on` + ST-018 | Its text says the status change works "as in ST-018" – it reuses `context.run`. Already satisfied transitively; now explicit |

**No fictional dependencies found.** The defect lifecycle and dashboard chains were checked specifically: every
edge is load-bearing because the scenarios set up state through the command they depend on.

---

## 5. Conflicts between the three – named, not averaged

1. **How far forward does ST-036 go?** `ux-designer` (screen review) wants it right after ST-007, because it is
   the story that gives a machine model its own page, which G2a and G3 now require. `product-owner` supports the
   value but says the position is a UI argument, not a value one, and its only product requirement is "before
   ST-042 (go-live)". `lead-dev` shows it cannot move as a whole – two of its three scenario groups need ST-010 and
   ST-043. **Resolution proposed:** split into **ST-036a** (the machine model's own page; correct title,
   manufacturer, category – depends on ST-006, ST-007, ST-009, ST-010) and **ST-036b** (correcting the technology
   recalculates which maintenance tasks apply – depends on ST-036a, ST-043, ST-044). Only 036a moves forward.
2. **Who decides the navigation?** The ux-designer's screen review said ST-048; this run says ST-008. The later
   answer wins and is the reason given above: four destinations arrive before ST-048.
3. **Does G10a (what can be undone is undoable) cover retiring a machine and removing a file?** ST-039 lists
   undoing a retirement as out of scope, ST-038 calls removal permanent – both written before G10a existed.
   `ux-designer` recommends **no**, and narrowing G10a in writing: it is about states a person *sets* to manage
   access or visibility, not about recorded facts or deleted bytes. Both keep G10's confirmation instead. **This
   is a user decision, not ours.**

---

## 6. What the stories are missing, measured

| Gap | How many stories | Who found it |
|---|---|---|
| A form whose story never says what happens to what was typed on a rejection (**G8**) | **20** (ST-007, 012, 018, 019, 020, 023, 024, 028, 029, 030, 031, 034, 035, 036, 037, 039, 040, 041, 044, 045). ST-013 and ST-016 get it right | ux-designer |
| A screen with no empty-case scenario (**G7**) | **12** (ST-008, 017, 021, 033, 037, 040, 043, 047, 048, 049, 051, 058). For ST-017, ST-043 and ST-048 "empty" is the *good* state and the story never says what is shown | ux-designer |
| A permission scenario that is only "the action is rejected" – a wall instead of no door (**G11**) | **13** (ST-007, 012, 018, 020, 022, 027, 031, 035, 036, 038, 039, 040, 041). ST-017, 030, 044, 048, 051 already do it right | ux-designer |
| Destructive and irreversible without a confirmation (**G10**) | **3** (ST-039 retiring, ST-020 spam dismissal deletes description and photo, ST-041 removing a maintenance task) | ux-designer |
| "Highlighted"/"marked" with nothing said in words (**G6/G9**) | **5** (ST-017, 043, 048, 050, 058) | ux-designer |
| The `ui` label, which routes a story to the ux-designer | **50 stories**; only the two done foundation tech tasks carry it today | lead-dev + ux-designer |

Concrete Gherkin for the empty, rejected, confirmation and permission scenarios is written out per story in the
ux-designer's report and is ready for the `requirements-engineer`.

---

## 7. New stories proposed

| # | Title | Type | Size | Depends on | Absorbs |
|---|---|---|---|---|---|
| N1 | Move the four pre-runner forms onto the house pattern (shadcn `Field`, `lucide-react`, typed rejection) | tech-task | S | ST-007 | UX findings **L1** (login throws the username away) and **M4** (a rejected account creation loses every value), and proposal **A** |
| N2 | The event catalogue per module | tech-task | M? | ST-018 | Taken **out of** ST-050's foundation checklist (finding 2) |
| N3 | Find a team member and act on one account at a time | story | M | – | UX findings M1–M3, M6, M8 |
| N4 | Deactivating a team member asks once, and can be undone | story | S | N3 | UX finding M5; **required by G10a**, which the user accepted today |
| N5 | ST-036a / ST-036b split | story | S / S | see conflict 1 | – |

On **N1**, `lead-dev` found the one real design question: login and account creation are **not** `aggregateCommand`s
(they call Better Auth-backed Team module functions), so they cannot use `formAction`. Either `formRunner` is
generalised to wrap a non-command async function with the same `{ error, values }` shape, or a hand-rolled
`useActionState` wrapper mirrors its contract. That is an engineering-conventions decision.
N1 deliberately leaves `changeRole`, `resetPassword`, `deactivateAccount` and `changeOwnPassword` on their current
mechanism – **N3** is about to move that page anyway, and converting them twice is waste.

---

## 8. Guideline gaps the backlog exposed

`ux-designer` proposes six new rules, written nothing yet, each caused by a concrete pile-up above:

- **G4a** – a grouped list shows the groups first, each with how many entries it has (ST-043, ST-045).
- **G6a** – an entry that is singled out says in words why (five stories say only "highlighted").
- **G8a** – what a browser cannot give back is said, not silently lost. A file or photo chooser cannot be refilled,
  so the message says it must be chosen again (ST-016 first, then ST-037, ST-054, ST-032).
- **G18** – a page several stories add to has one owner story that fixes its sections and their order (the machine
  record, the dashboards).
- **G19** – the navigation is decided once, with every destination the product will have (six stories add one).
- **G20** – an enumeration a person picks from has its German option texts decided in the story that first offers
  it; domain values go into `CONTEXT.md` first (ST-020, ST-029, ST-044 build three selects with **nine undecided
  option texts**).

---

## 9. Two glossary gaps, for the domain-model skill

- **"Dashboard" has no entry in `CONTEXT.md` at all** – and it is the navigation item a helper sees first. Needed
  before ST-048 is written. The ux-designer refused to invent a synonym, correctly.
- **Nine option texts** are domain values without German wording: dismissal reasons (*not a fault / spam / other*),
  hold reasons (*waiting for part / waiting for technician / other*), maintenance outcome (*done / partially done*).

---

## 10. What explicitly stays as it is

So the next run does not re-litigate it:

- **The dependency depth of ST-026, ST-028, ST-030, ST-049** – real, not convenience.
- **ST-022 / ST-052 / ST-053** – stay `must`; they answer the vision's first problem statement.
- **ST-014 and ST-035** – already `could` and deliberately conditional; that is the right shape.
- **ST-008's 60-entry list, ST-017, ST-021, ST-048, ST-058, ST-040, ST-041, ST-037, ST-051, ST-009, ST-010 and the
  machine model list** – checked against the museum's real scale and found fine. Dropped as findings rather than
  carried.
- **The machine model card** (title, then "Hersteller · Jahr · Kategorie · Technik") – the one thing the existing
  screens got right on the first try.
- **`src/app/(team)/navigation.tsx`** already hides technician-only destinations from helpers while the page and
  the Team module check the role again – G11 done right before G11 existed. The pattern every later story copies.
