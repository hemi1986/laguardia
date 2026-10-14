# Code review – ST-027: Prioritize a defect
Base: main · Commits: 6 · Date: 2026-10-14

Checked: ADR-0002 command shape (`aggregateCommand`: load → pure decision → save at the seen version → journal, one
transaction), `allowedActors: ["technician"]` as the server-side authorization, CSRF through `proxy.ts` for the Server
Action, journal `data` holding only the priority (no free text, no names), IDs `CMD-PrioritizeDefect` /
`EVT-DefectPrioritized` from `events.yaml`, the AGG-Defect invariant "a resolved defect can only be reopened – no …
prioritizing" (`state !== "open"` also covers *closed on retirement*), the form input read through an allowlist
(`priorities.find`), the G11/G21/G22 placement (the fold „Verwalten“ for technicians only, „Priorität ändern“ after
„Zuweisen“ and „Übernahme … aufheben“, a form page of its own that repeats the defect and lands on the defect's page with
the G3 confirmation), and the convention "a new command on a defect" (action + refusal in `defect-actions.ts`, event in
`actionOfEvent`, confirmation and form page in the maps of `defect-details.tsx`). All four scenarios have a test with the
exact title, and each checks its "Then" (the read model, the open defects list filtered by priority, the unchanged
priority and journal for both rejections); the browser test covers the 360 px flow. `check-language.ts` reports nothing
in the diff; the four integration test files pass (40 tests).

Worth keeping: replacing `action !== "assign"` with `work.some(…)` in `defect-details.tsx` turns the work buttons into an
allowlist – without it „Priorität ändern“ would also have appeared as a work button under the header.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Domain rules / traceability | `docs/domain/events.yaml:318` (`CMD-PrioritizeDefect`), `src/modules/repair/prioritize-defect.ts:51-53` | The two rules agreed with the user – a priority must be chosen (`priority-required`), and it must differ from the one the defect has (`priority-unchanged`) – live only in the code. `CMD-PrioritizeDefect` has no `rules:` in `events.yaml`, and the story's Context does not list them, so the next reader of the discovery artifacts cannot see why the form leaves out the current priority. | CLAUDE.md "Don't guess" / Sources of Truth (`events.yaml` is the model); `CMD-ResolveDefect` lists its rule the same way | Add `rules:` to `CMD-PrioritizeDefect` (technicians only is the actor; "only an open defect"; "a priority other than the current one") – a one-line change to `events.yaml`, validated by the hook. |
| 2 | minor | Design / smell | `src/modules/repair/prioritize-defect.ts:37-44` vs `src/modules/repair/claim-defect.ts:72-79` | `prioritizeRefusal` is character for character `assignRefusal` (technicians only, only an open defect). ST-031 ("Titel und Eignung ändern", also behind „Verwalten“, technicians only) will be the third copy. | Duplicated Code; locality (codebase-design) | Leave it for now. When ST-031 arrives, name one refusal for "managing an open defect" that the three refusals use, so the G22 rule for the fold sits in one place. |
| 3 | minor | Design | `src/app/(team)/team/defects/[defectId]/defect-form-data.ts:15`, `.../zuweisen/assign-defect-data.ts:42` | `priority` was added to the shared `DefectForForm`, which only the priority page reads. Because `loadDefectForAssigning` builds its `DefectForForm` by hand instead of through `loadDefectForForm`, the change also had to touch the assign page (the existing duplicate shows up here). | Shotgun Surgery (pre-existing duplicate of the shared loader) | Fine as it is – a form page that repeats the defect may well show its priority. If it is touched again, let `loadDefectForAssigning` build on `loadDefectForForm` so new fields land in one place. |
| 4 | minor | Naming | `src/app/(team)/team/defects/[defectId]/prioritaet/prioritize-defect-data.ts:403` (doc comment of `loadDefectForPrioritizing`) | The doc comment ("The defect as every form page of a defect loads it.") was copied from the shared loader. It does not say what this function adds: the priorities `CMD-PrioritizeDefect` would accept. | Mysterious Name (misleading comment) | Reword it to say it is the shared form data plus the priorities other than the current one (G11). |
| 5 | minor | Language / UI texts | `.../prioritaet/page.tsx:33`, `prioritize-defect-form.tsx:58`, `defect-details.tsx:78` | The German priority labels are read from `teamMessages.recordDefect.priorities` – the namespace of one form – on the defect's page, in its confirmation and on the new form page (and, already, in the open defects list). The glossary term *Priority* is shared, but the catalog places it under "record defect". This existed before the story; the story adds three more reads. | Feature Envy on a message namespace; G12 (one word, the same on every screen) | Judgement call: move `priorities` next to the other glossary terms in the catalog (`terms`) when the catalog is next touched. Not needed for this story. |

**Verdict:** ready to merge
Most important: the agreed `priority-unchanged` / `priority-required` rules are only in the code – add them as `rules:` of `CMD-PrioritizeDefect` in `events.yaml` (finding 1). No blockers, no majors, and nothing meets the follow-up hurdle.

## Disposition (`/implement`, 2026-10-14)

- **#1 fixed** – `CMD-PrioritizeDefect` lists its rules in `docs/domain/events.yaml` (open defect; a priority chosen that differs from the current one).
- **#4 fixed** – the doc comment of `loadDefectForPrioritizing` says what it adds.
- **#2 skipped – revisit in ST-031**: `prioritizeRefusal` and `assignRefusal` say the same today; the third command managing an open defect (CMD-ChangeDefectDetails) is the moment to name the shared rule.
- **#3 skipped – revisit when `zuweisen/assign-defect-data.ts` is next touched**: route it through `loadDefectForForm`.
- **#5 skipped – revisit when a page outside the defect forms needs the priority labels**: move them from `recordDefect.priorities` to `terms`.
