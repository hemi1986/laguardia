# Code review – Architecture review 2026-10-25, candidate 3: Repair says what a defect's form may offer
Base: main · Commits: 1 (de86523) · Date: 2026-10-25 · Branch: `arch-defect-form-offers` (refactoring, no story)

Checked: `git diff main...HEAD`, the conventions ("What a team member can do to a defect", "Naming what read models
return by ID", "Where an action sits on the defect's page"), ADR 0002, the context map. `vitest run` on
`src/app/(team)/team/defects/[defectId]` and `src/modules/repair`: 43 files, 277 tests green. `check-language.ts`: no
warning in the changed files.

## Behaviour equivalence per form

| Form | Before | After | Same? |
|---|---|---|---|
| `zuweisen` (assign) | `activeTeamMembers` read only when `whyNot` is undefined; filtered by `id !== viewer.id` and `assigneeRefusal` | `offers.assign`: `refused` (= `whyNot !== undefined`) gives `[]` without the read; same filter with `teamMember.teamMemberId` (= `viewer.id`) | yes |
| `prioritaet` (prioritize) | `priorities.filter(priorityRefusal(...) === undefined)` | the same filter in `offers.prioritize`, independent of the refusal as before | yes |
| `wieder-oeffnen` (reopen) | machine always read; dropped unless `viewer.role === "technician"` | machine read only when `mayChangeMachineStatusWhileReopening(teamMember)` – the same predicate the decision now applies; a helper gets `machine: undefined` as before, and one read less | yes (G11 gap closed) |
| `titel-und-eignung` (change-details) | claimant's role from Team, `claimReleasedByRemovingTheMark(defect, role)`, regardless of the refusal | the same in `offers["change-details"]`, also regardless of `refused`; no claim → `undefined` without the role read (the function returned `undefined` then too) | yes |
| `titel-und-eignung` naming | `named` over the claimant | `named` over `releasesClaimOf` only – the claimant's name was only ever used when it was the released one | yes (output identical) |

Every form page in the folder that loads a defect goes through `defectForAction`: `zuweisen` and `titel-und-eignung`
directly, `beheben`, `arbeitsschritt`, `pausieren`, `prioritaet`, `wieder-oeffnen` through `loadDefectForForm`. The
defect's own page (`page.tsx`) reads `defectDetails`, not a form read. No page imports a refusal function any more.

Module boundaries: Repair reading Team's `activeTeamMembers` and `teamMemberRole` for its command rules matches the
context map (Team → Repair, Conformist) and is what `claim-defect-command.ts` and `change-defect-details-command.ts`
already do; ADR 0002 allows read models to read across modules. No import of another module's internals.

## Findings

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Design / conventions | `src/modules/repair/defect-form-offers.ts:20`, `:56-61`; `src/app/(team)/team/defects/[defectId]/zuweisen/assign-defect-data.ts:2,17,35` | `offer.assignees` is Team's `ActiveTeamMember[]` (ID, **name**, role), so Repair's read model `defectForAction` now returns team member names, and its interface exports a Team type. The conventions say read models return team members by ID and the page names them through `named` (architecture review 2026-10-25, candidate 1). Before, the page took the names from Team itself, so the names did not go through Repair. | Conventions "Naming what read models return by ID"; ADR 0002 (reference by ID); Leaking module | Offer the assignees as IDs (`TeamMemberId[]`, in Team's order by name) and let `assign-defect-data.ts` name them with `named` – add `defect.offer.assignees` to the references it already passes. The page type can keep `{ id, name }`. About half an hour. |
| 2 | minor | Docs | `.claude/skills/engineering-conventions/SKILL.md:263-266` | "Where an action sits on the defect's page" still says a choice of team members "comes from Team's `activeTeamMembers`, filtered with the command's own rule per team member (`assigneeRefusal`)". That reads as an instruction to the page, which the new sentence ("never a filter in the page") now forbids, and `assigneeRefusal` is no longer exported. The new sentence at `:219-222` is also one unwrapped line of about 220 characters, unlike the rest of the file. | Divergent documentation | Point that sentence at `offer.assignees` from `defectForAction` (Repair filters with `assigneeRefusal`; the command still reads the chosen role itself). Wrap the new sentence. |
| 3 | minor | Design | `src/modules/repair/defect-form-offers.ts:35-45`, `src/modules/repair/defects.ts:439` | `refused: boolean` is a flag argument that only `assign` reads. It also ties the offer to the refusal that `defectForAction` happened to compute, not to the command's rule. `assignRefusal(defect, teamMember)` is pure and cheap, so the `assign` entry can ask it itself. | Flag argument; Feature Envy (light) | Drop `refused`. In `offers.assign`, skip the read when `assignRefusal(defect, teamMember) !== undefined`. |
| 4 | minor | Type-level dispatch | `src/modules/repair/defect-form-offers.ts:31-33`, `:42-44` | The cast is justified: TypeScript cannot correlate `offers[action]` with `DefectFormOffer<Action>` for a generic key, and the comment says so. But `action in offers` also matches inherited properties (`"toString" in {}` is true). That is harmless for today's ten keys, but it is the wrong check. The partial table also forces the `Record<never, never>` branch of the conditional type. | Judgement call | Use `Object.hasOwn(offers, action)`, or make `offers` total over `DefectAction` with `{}` entries for actions without a choice. That drops both the `in` check and the conditional's fallback; the single cast stays. |
| 5 | minor | Performance | `src/modules/repair/defects.ts:439`; `zuweisen/assign-defect-data.ts:31`; `titel-und-eignung/change-defect-details-data.ts:25-26` | Two reads that used to run in parallel now run one after the other: `activeTeamMembers` → `named`, and `teamMemberRole` → `named`. That is one extra database round trip on two form pages and has no visible effect. | Judgement call | No action needed. If #1 is fixed, `named` has to wait for the assignee IDs anyway. |
| 6 | minor | Tests | `src/modules/repair/defect-form-offers.ts` | No test sits at Repair's seam for `offer`. The offers are covered through the app data loaders' integration tests (assign, prioritize, reopen with helper and technician, change-details), which are the seams that already existed. That is acceptable for a refactoring that must not change tests. | tdd skill (seams) | No action; if the module grows, test `defectForAction(...).offer` at Repair's seam. |

No follow-up story: nothing here is a security or data-loss risk, and nothing here blocks a named story.

ready to merge
Most important: #1. `offer.assignees` makes Repair's read model return Team's names, but read models should return IDs and the page should name them with `named`. Fix it in this PR by offering IDs.

## Resolutions (2026-10-25)

| # | Resolution |
|---|---|
| 1 | Fixed: `offer.assignees` is `{ teamMemberId, role }[]` in Team's order; `assign-defect-data.ts` names them with `named`. Repair no longer returns names or exports a Team type. |
| 2 | Fixed: "Where an action sits on the defect's page" now says the choice of team members is Repair's offer; the long line is wrapped. |
| 3 | Fixed: no `refused` flag – the assign entry asks `assignRefusal` itself (the same rule as `whyNot`). |
| 4 | Fixed: `Object.hasOwn`. |
| 5 | Kept: one extra round trip on two form pages, no action needed. |
| 6 | Kept: the four form pages' integration tests cover the offers. |
