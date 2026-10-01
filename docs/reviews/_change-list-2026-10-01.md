# What changed since the backlog was written (for the 2026-10-01 grooming)

The backlog was derived in one go from the event storming on 2026-09-26. Since then:

## 12 stories are done
ST-001 walking skeleton · ST-002 photo upload · ST-003 module structure, command layer, event journal, time
convention · ST-059 CI and test harness · ST-004 login · ST-005 team member accounts · ST-071 commands as
load/decide/save · ST-073 Server Action runner · ST-076 UI foundation (shadcn, phone layout, team shell) ·
ST-077 account pages rebuilt on the shared components · ST-078 spike scaffolding removed · ST-006 create a
machine model (2026-09-30)

**What that means technically** – much of what the backlog assumed had to be built now exists:
- The command layer (`aggregateCommand`: load → pure decision → save → journal), the event journal, the
  optimistic version check, automatic policies, the fixed clock and `src/platform/time.ts`.
- The Server Action runner (`formAction`): the only way from a form to a command, acting person from
  `currentPerson()`, `{ error, values }` on a rejection, works without JavaScript.
- Login, sessions, throttling, team member accounts, roles, the team shell with its navigation.
- shadcn/ui on Tailwind v4, the `Page` container with the 360 px rules, `NativeSelect`, `Field`,
  `Confirmation`/`Rejection`, Card, Button, Input.
- The Collection module with its first aggregate (AGG-MachineModel), its store, a read model and a migration.
- CI (`npm run verify`, `--e2e`), Playwright at 360 px, integration tests against real PostgreSQL, Vercel
  previews per branch.
- `.claude/skills/engineering-conventions/SKILL.md` exists and is the written house style, incl. the seam catalog.

## ADRs
0001 tech stack · 0002 modular monolith, state-based persistence with event journal · 0003 PostgreSQL ·
0004 team authentication · 0006 hosting verified (Vercel Pro fra1, Neon Frankfurt, private Blob) ·
0007 photo and file storage consistency — all accepted. **0005 is superseded by 0006.**

## Decisions taken since, that the backlog has not caught up with

1. **Domain model restructured (2026-10-01).** An aggregate invariant is now stated **once, on the aggregate**;
   a command's `rules` list only what it adds beyond them. Six commands now carry no `rules` at all
   (CMD-LinkProblemReportToDefect, CMD-PrioritizeDefect, CMD-CloseDefectOnRetirement, CMD-CreateMachineModel,
   CMD-MoveMachine, CMD-CorrectMachineModel) — **a command with no rules is not a command with nothing to test**;
   its aggregate's invariants carry them. Two invariants grew: AGG-Defect ("a resolved defect can only be
   reopened – no claiming, prioritizing, hold, change of its details, work log entry, resolving again or closing
   on retirement") and AGG-Machine ("a retired machine is final – it stays retired and cannot change status, be
   moved, have its details corrected or be retired again").
2. **A year is now an invariant** of AGG-MachineModel: either none or a four-digit calendar year, no plausibility
   range. CMD-CorrectMachineModel is bound by it (ST-036).
3. **`CONTEXT.md` gained the term `Account` / `Konto`** (2026-10-01): the person is the *Teammitglied*, their
   access is the *Konto*. Resetting a password, changing a role and deactivating act on the account.
4. **`docs/product/ux-guidelines.md` exists** (accepted 2026-10-01) — 17 binding rules. The ones that change
   stories: G2a creating a thing happens on **its own page**, reached by a button under the heading (not a form
   below a list); G3 after a successful action the person sees what changed, with a confirmation naming the thing;
   G4 a list past ~20 entries shows a count and one way to narrow it; G5 a list entry shows what tells it apart,
   actions live on the entry's own page; G7 the empty case says what to do about it; G8 a rejected form keeps what
   was typed and marks the field; G10a deactivating an account is **reversible**; G11 someone who may not do a
   thing does not see the control.
5. **The UX review of the five existing screens** (`docs/reviews/2026-10-01-ux-review-existing-screens.md`):
   no blockers, eight majors. Its story proposals are the main input for this grooming — read it.
6. **shadcn decisions (2026-10-01):** the form layout moves to shadcn's `Field` (+ `label`, `separator`) for
   `data-invalid`/`aria-invalid`; `lucide-react` is installed as the icon library so a rejection carries a symbol
   and not only a colour. **Neither is built yet** — ST-007 is meant to be the first form on the new pattern, and
   the four older forms (login, team members, own password, machine models) need their own tech task. Until then
   two form patterns exist side by side, which is the one thing that must not spread.
7. **Open questions answered** (`docs/stories/OPEN_QUESTIONS.md`): ST-069 ordering (right after ST-073, before
   ST-007); a query internal to one bounded context needs no `RM-` ID; the ST-005 audit trail is its own feature
   after ST-005; `currentPerson()` delegates to the ST-004 session lookup.

## Parked lines in code reviews (candidates that may now be decidable)
`docs/reviews/ST-005-code-review.md`, `ST-006-code-review.md`, `ST-071-code-review.md` carry "skipped minor" and
"revisit when …" lines. ST-006's include: the read model returning the aggregate's state type (revisit with
ST-007), writing the event's fields out instead of spreading state (ST-036), moving the aggregate's vocabulary out
of the create command's file (ST-036), the shared `commandErrors["not-authorized"]` wording being
technician-specific (the first command a helper may also run), and the `logIn` helper duplicated across four
browser specs (ST-068 could take it).

## Mechanical health check – no findings
No dependency cycles, no dangling references, no priority inversions, no `ready` blocked by `draft`.
Only depth: **ST-050 sits 9 stories deep** in the dependency chain, ST-030 and ST-049 eight, ST-026 and ST-028 seven.
