# Code review – arch-team-messages-areas: team texts in area files, one code for an unknown machine
Base: main · Commits: 2 · Date: 2026-10-23

Refactoring branch from architecture review 2026-10-18, candidate 5 (no story). Checked against the conventions
("UI texts"), ADR 0002 (module boundaries: the catalog is platform code, no module imports it), the glossary, and
against the old `team.de.ts` for content. `tsc --noEmit` is clean, ESLint reports nothing in `src/platform/messages`,
and `check-language.ts` reports no warning in the changed files (its 13 warnings are all in untouched files). The
tests in `src/platform/messages`, `src/modules/maintenance` and `src/modules/repair` pass (40 files, 265 tests).

Correct as built. Behaviour is unchanged.
- **One code (5fef690):** `machine-unknown` (Maintenance) and `machine-not-found` (Repair) had the same team text
  as Collection's `unknown-machine` ("Dieses Gerät gibt es nicht."). So merging them changes no text. The visitor key
  was renamed in both catalogs, with its text kept. The visitor key test keeps `de`/`en` in step. No page, override or
  `whyNot` comparison in `src/app` named either old code. The decision tests, the command tests and the policy's
  result-type test (`problem-report-policies.integration.test.ts`) were updated, not weakened.
- **The split (626ccf4):** every one-line doc comment of the old file appears in the new files, and none was lost.
  The old header now lives in `shared.ts`. I mapped each error code to the source files that produce it, and every
  code sits in the right file. The codes in `shared.ts` really are produced by two or more of photo, upload, the
  command layer, Collection, Maintenance and Repair. Every area file's code is produced only by its own module.
  `name-required` is also produced by the Team module, but Team's texts come from `accountErrors`, never from
  `commandErrors`, so it rightly stays in Maintenance's file.
- **The uniqueness test is needed.** Spreading `{...a, ...b}` silently overwrites a duplicate key, and the type
  checker does not catch that. The test fails exactly in that case. Its expected value (`[]`) does not depend on the
  code, so the test is not tautological.
- **Design choice: flat merge instead of a per-area override.** This meets the candidate. The goal is locality: an
  area's texts and codes live in its file, and the shared codes live in one place. A shared text is a fallback in the
  sense that an area doesn't repeat it. An *override* has no user today. The three merged codes had identical texts.
  Forms that know more already pass their own text through `rejectionText(…, overrides)`. The one area with its own
  wording for shared codes (Team: "Dieses Konto gibt es nicht mehr.") has its own `accountErrors` section. A per-area
  lookup would be a seam with one adapter. It would also change `commandErrorText`/`rejectionText` for nothing. The
  wording "shared codes as fallback" in the candidate should be read this way when the candidate is closed (see #5).
- **Outside `src/`:** `events.yaml`, ADRs, `CONTEXT.md`, the data model, `docs/operations`, `.claude/` tooling and
  `e2e/` name neither old code nor `team.de.ts`. The conventions line is updated. `team.de.ts` is still named in the
  done stories ST-016, ST-037, ST-076, ST-077 and ST-078, and older reviews name the old codes. These are historical
  records: done stories are never reopened, so leave them.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Comments | `src/platform/messages/team/shared.ts:44-58` | The section comment lists the shared groups as "photo, upload, the command layer, a machine that is unknown or retired". It leaves out `title-required` (Collection's file title, Repair's defect title) and `technology-does-not-fit-machine-category` (Collection, Maintenance). Also, `title-required` now sits directly under `/** The photo errors (ST-016) … */`, with nothing between it and the four photo codes, so it reads as a fifth photo error. In the old file the same order was hidden among 80 codes. | Comments must stay true after a move; Mysterious Name (grouping) | Give each group a one-line comment: photo (ST-016), upload (ST-037), codes several contexts' forms share (`title-required`, `unknown-machine`, `machine-retired`, `technology-does-not-fit-machine-category`), command layer (`not-authorized`, `not-found`, `version-conflict`). Then the section comment can just say "codes several areas share". |
| 2 | minor | Comments | `src/platform/messages/team/collection.ts:163-185` | `/** Attaching a file (ST-037). */` used to head a run that `file-required`, `content-gone` and `unknown-machine` interrupted. Those three moved to `shared.ts`, so the comment now seems to cover the machine model codes too (`manufacturer-required`, `year-must-be-four-digits`, `machine-category-required`). The registration and status codes (`machine-model-required` … `no-museum-number-free`) have no heading at all, unlike the per-command headings in `repairErrors` and `maintenanceErrors`. | Comments that moved with the sections (task); consistency with the sibling files | Add one heading per command group: creating or correcting a machine model, registering a machine, moving it (already there), changing the machine status. |
| 3 | minor | Placement | `src/platform/messages/team/accounts.ts:2,13-29` | `accounts.ts` holds the `team` section: the team shell's navigation labels for every area (`maintenance`, `triage`, `defects`, `machines`, `dashboard`, `logout`, …). That is the shell of ST-076, not the Team context's accounts, and the file header ("logging in, the team members' accounts, one's own password") does not mention it. A maintainer looking for the navigation label of a new Repair page would not look in `accounts.ts`. | Locality; header says one thing, file holds another | Move `team` to `shared.ts` (it is what every page shares, like `forms`), or name it in the header. Moving it is one cut-and-paste, and the uniqueness test guards it. |
| 4 | minor | Conventions | `.claude/skills/engineering-conventions/SKILL.md:487`, `src/platform/messages/team/accounts.ts:57` | The new convention line says each bounded context's file has "its commands' error texts (`…Errors`)". Accounts has no such export. Its codes stay the `accountErrors` *text* section, because Team's functions are not commands on the form runner and their pages read `accountErrors` directly. That is why `teamAreas.errors` has no accounts entry and accounts may repeat `not-authorized`/`not-found` with its own wording. This is correct, but nothing says so. The next reader may "fix" it into `commandErrors`, where `not-found` would collide. | Conventions as the source of truth for patterns | Add half a sentence to the convention line (and the `accounts.ts` header): the Team context's rejections are `accountErrors` (ST-005), outside `commandErrors`. |
| 5 | minor | Conventions / design choice | `.claude/skills/engineering-conventions/SKILL.md:487` | The line says "a code that a second area starts to use moves to `shared.ts`". It does not say what happens when the second area needs a *different* text for that code. A flat merge cannot override a shared text per area, and that is deliberate (see above). Without the answer, someone may add a second key in their area and only learn the rule from the uniqueness test. | Interface = everything a caller must know (codebase-design) | Add: "a form that needs a different text for a shared code passes it to `rejectionText(…, overrides)`; a different meaning gets its own code". When closing candidate 5, note in the architecture review's resolution that "fallback" is a flat merge without overrides. |
| 6 | minor | Design (duplication) | `src/platform/messages/team/index.ts:14-28` | The list of areas is written twice: once as the spreads of `teamMessages`, once as `teamAreas`. A new area file added to `teamMessages` but forgotten in `teamAreas` escapes the uniqueness test, which is exactly the case the test exists for. `teamAreas` is also a production export used only by the test. | Duplicated Code; Shotgun Surgery (small) | Make one list the source: build `teamMessages` from `teamAreas`, e.g. spread `teamAreas.texts.*` and `teamAreas.errors.*`, so a forgotten area breaks the type check of the form that needs it. Or accept the duplication, since it is six lines next to each other. Main session decides. |
| 7 | minor | Test quality | `src/platform/messages/messages.test.ts:57` | The last line checks the `unknown-machine` text inside the test titled "every team text key and every team error code lives in one area file only". It is a check of commit 1 (one code, one text), unrelated to that title. If it fails, the message points at the wrong rule. | tdd: a test reads like a specification | Move it to its own `it` ("Maintenance, Repair and Collection share one text for an unknown machine"), or drop it. The type check already requires the key for the forms that show it. |

**Verdict: ready to merge** (no blockers, no majors).
Most important: #1. The shared section's comment and its leftover photo heading misdescribe what `shared.ts` holds,
and `shared.ts` is the file the new convention sends every code to once a second area uses it.

## Resolution (2026-10-23)

All seven minors are fixed:
- **#1:** the section comment in `shared.ts` names what qualifies a code (several areas produce it) and groups the codes under headings: photo, upload, Collection/Repair/Maintenance, command layer.
- **#2:** `collectionErrors` is grouped by command (machine model, machine, move, status, attach file).
- **#3:** the `team` navigation section moved to `shared.ts`, the team UI's frame.
- **#4 and #5:** the convention says that `commandErrors` is a flat merge without per-area overrides: other words come through `rejectionText(…, overrides)`, another meaning gets a new code. It also says that `accountErrors` stays outside.
- **#6:** the uniqueness test also checks that `teamMessages` is made of exactly the areas in `teamAreas`.
- **#7:** the `unknown-machine` check has its own test, now with both visitor catalogs.
