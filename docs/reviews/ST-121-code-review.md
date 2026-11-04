# Code review – ST-121: Remove a file on its details page
Base: main · Commits: 9 · Date: 2026-11-04

Scope: `git diff main...HEAD` (29 files). The new question page, its data/view/form/action, the `fileForRemoval` and
`fileRemovedBy` queries, the former `datei-entfernen` address as a redirect, the removal button on the file details and
the confirmations on the machine record, „Einstellungen“ and the machine overview. Verified locally: ESLint 0 errors
(13 pre-existing warnings), typecheck clean, 608 unit tests pass, the story's 9 integration tests pass, the touched
neighbours (`machine-record`, `machine-confirmation`, `remove-file-command`, `file-details`, `ai-settings`,
`machine-overview`) pass, `check-scenarios` 8/8 and all stories OK, `check-commands` OK, `check-language` has one new
real hit (`attachmentsOf`). Playwright was not run here.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Design / test quality | `src/modules/collection/files.ts:134-179`, `src/modules/collection/remove-file-command.integration.test.ts:17-21,104-115`, `src/modules/collection/remove-file.ts:38` | `machineFile` was the old question page's query. After ST-121 only the removal confirmation uses it, yet `MachineFile` still carries `version`, `removed` and `machineModel`; no production code reads them. Its test „names the machine model … the question says where else it disappears“ now tests behaviour of a page that no longer uses the function – that behaviour lives in `fileForRemoval` and its own test. The test header still points to the deleted `datei-entfernen/[fileId]/remove-file.integration.test.ts`, and `mayRemoveFiles`'s comment still says the machine record asks it before offering „Entfernen“. | Speculative Generality (dead fields), stale test and comment; Story Notes: the ST-038 tests move with the removal | Shrink `machineFile` to what the confirmation needs (`title` and the machine/model membership), delete the stale test block and refresh the header and the `remove-file.ts` comment. The membership case stays covered by `machine-confirmation.integration.test.ts:72`. Small enough for this story. |
| 2 | minor | Domain rule / UI | `src/app/(team)/team/dateien/[fileId]/details/entfernen/remove-file-view.tsx:27-43`, `src/modules/collection/file-details.ts:120-138` | For a file already removed, the page renders the whole question and „Sie verschwindet bei:“ with its former attachments, next to "Diese Datei wurde schon entfernt." The data model says a removed file's attachments no longer count and it shows nowhere; the scenario only asks for the rejection. | AGG-File invariant, data model *Removal*; story scenario "A file already removed cannot be removed again" | When `removed`, show the rejection and „Zurück“ only – or keep the question and drop the list, which is now false. |
| 3 | minor | Test quality | `src/app/(team)/team/dateien/[fileId]/details/entfernen/remove-file.integration.test.ts:225` | Scenario 1's Then "the file is still attached" is checked with `fileDetails(db, manual)).toBeDefined()`, which also passes for a file attached to nothing. It proves "not removed", not "still attached". | tdd: the test must check the Then | Assert `attachedTo` still lists both LG-042 and the machine model. |
| 4 | minor | Test quality / security | `src/app/(team)/team/dateien/[fileId]/details/entfernen/actions.ts:24-35`; `remove-file.integration.test.ts:317-325,343-351` | The action's `originOf` re-check and its `removalLanding` redirect are not exercised: the tests build their own `formRunner` and call `removalLanding` themselves, and the e2e covers only the machine origin. Removing the `originOf` line or wiring another origin in the action would fail no test. | tdd (the composition in `actions.ts` is only read, not run), conventions *Server Action runner* seam; same shape as ST-114's review finding 7 | Export the action's definition (like ST-095's `changeMachinesDefinition`) and drive it through `formRunner`, or add an e2e for the settings origin and a forged `from`. |
| 5 | minor | Test quality | `src/app/(team)/team/machines/page.tsx:31-32`; `remove-file.integration.test.ts:168-181` | Scenario 5's test rebuilds the machine overview page's `fileRemovedBy` call itself; the page wiring is untested, unlike the `?registered=` confirmation (`e2e/machine-overview.spec.ts:26`). A page that never read `params.fileRemoved` would still pass. | tdd, seam catalog *page data function + view*; G3 | Add the e2e for the no-origin landing, or move the confirmation read into a page data function the test can call. |
| 6 | minor | Test quality / UX | `remove-file.integration.test.ts:214-236`; `src/app/(team)/team/machines/[museumNumber]/machine-record.integration.test.ts:537-551` | G30's "only the verb of a question page is red" is no longer checked for the removal question: the old `classOf(html, "Entfernen")` check is removed and the new question page is not added to ST-092's class test. The code is right (`destructive` verb, `outline` details link), but a later change could break it silently. | G30; ST-092 test "Only the verb of a question page is red" | Extend that test with the removal question, or assert the classes in the new integration test. |
| 7 | minor | Security hardening | `src/app/(team)/team/machines/[museumNumber]/datei-entfernen/[fileId]/page.tsx:16-18` | The former address interpolates the decoded `fileId` into the Location without `isId`/`encodeURIComponent`; the old page checked `isId`, the new one relies on the details page checking it. This is not an open redirect – the target always starts with `/team/dateien/` and stays same-origin (dot-segment traversal checked) – but a malformed value creates a nonsense Location that only ends on the 404 page. | Security, input handling; conventions "An address that is no aggregate ID is checked with `isId`" | `if (!isId(fileId)) notFound();` before building the address, or encode the segment. |
| 8 | minor | Language | `src/modules/collection/file-details.ts:50` | `attachmentsOf` adds a new hit for "attachment", an `_Avoid_` word under *File*; `check-language.ts` warns. | `CONTEXT.md` *File*; check-language | `attachedToOf` – the type it returns is already `FileAttachedTo`. |
| 9 | minor | Dead code | `src/platform/messages/team/collection.ts:231` | `removeFile.unknown` („Diese Datei gehört nicht zu …“) is unreachable: the question page 404s an unknown file and no longer relates a file to a machine. | Speculative Generality; story Notes (the machine relation leaves the page) | Delete the text. |
| 10 | minor | Naming | `src/app/(team)/team/machines/machine-overview.tsx:51`, `src/app/(team)/team/museum-settings/ai-settings-data.ts:38`, `ai-settings-section.tsx:75` | `removedFile` holds the removed file's *title*, not the file; three call sites read `removed?.title` into it. | Mysterious Name | `removedFileTitle`. |
| 11 | minor | Duplicated code | `src/app/(team)/team/dateien/[fileId]/details/file-details-view.tsx:42-54`, `.../entfernen/remove-file-view.tsx:32-39` | Both views map `FileAttachedTo` to the „Angehängt an“ wording with their own switch. The wording is deliberately shared, but a change (ST-115's detach control, a retired label) must touch both. | Duplicated Code | One `attachedToLabel(target)` beside the details; the texts stay in the catalogue. |
| 12 | minor | Design | `src/app/(team)/team/dateien/[fileId]/details/file-origin.ts:46-68`; `src/app/(team)/team/machines/[museumNumber]/datei-entfernen/[fileId]/page.tsx:2` | `removeFileAddress`/`removalLanding` extend the address helper inside one route folder; `removalLanding` is a third switch over `FileOrigin` beside `originValue` and `wayBack`, and the machine route and AI settings import the folder from outside. ST-114's review (findings 1 and 3) asked to move the builder out before the four named follow-up stories; ST-121 adds to it instead. | Repeated Switches / Shotgun Surgery; ST-114 review finding 1 | One address helper outside the route folder and one switch that yields both the way back and the removal landing; ST-117's „Dateien“ origin then lands in one place. Or record the deferral explicitly. |
| 13 | minor | Test quality | `remove-file.integration.test.ts:200-211`; `.../details/file-details.integration.test.ts:115,130` | `queryOf`, `hrefOf` and the `<li>` extraction are copied between the two sibling page tests; a change to one must be made twice. | Duplicated Code (tests) | Move them to `src/test-support/html.ts`, which already holds the HTML-reading helpers. |

## Security pass

- **Helper:** cannot see the control (`file-details-data.ts:80`, `mayRemoveFiles`), cannot open the question page
  (`entfernen/page.tsx:21`, `requireTechnician`), cannot run the action (`actions.ts:24`, `requireTechnician`) and the
  command refuses the helper (`removingActors`, `allowedActors`). The integration test covers data/view and the command;
  the e2e covers the page redirect.
- **Forged `from` – no open redirect.** `originOf` accepts only `settings` (technicians) and `machine:<museum number>`
  looked up in the database; everything else becomes `none`. `removalLanding` builds the target from `teamMachinePage()`
  (URL-encoded) or a literal, never from the request. A foreign URL, `//host`, `machine:https://…` and an unknown
  machine all become `none` (tested at the question page). The action checks the bound origin again before it lands
  (`actions.ts:27`), so a bound value can at worst give the default landing. Dot-segment values in the old address also
  stay on the host (checked with the URL parser).
- **File ID:** checked with `isId` on the question page (`remove-file-data.ts:34`); the command answers `not-found` for
  an unknown aggregate. The former-address redirect does not check it (finding 7) but only builds a same-origin path
  whose target checks it and 404s.
- **CSRF / action:** the form is a POST to a Server Action; `src/proxy.ts` rejects a missing or foreign `Origin` and
  Next.js checks it again. The actor comes from `currentPerson()` inside `formAction`, never from the form.
- **Version check:** kept. The page shows `file.version` and posts it (`VersionField`); the command's `target` checks it.
  The version-conflict test keeps the content and the attachment; the runner deletes removed content only after a
  successful command.
- **Removed file:** the page keeps the question and shows „Diese Datei wurde schon entfernt.“; the command rejects
  `file-removed` before the save; the test shows the journal unchanged. The content is deleted only after the commit
  (`removesContent`, ADR 0009).
- **Removal and AI:** the action runs Collection's command composed with `POL-RemovedFileLeavesAiIndex` (ADR 0010); the
  policy runs as the system in the same transaction, also while AI is off. The removal lock (ADR 0014) is unchanged.
- **No personal data:** no logging added; the journal keeps the file and machine/model IDs and the actor only.

## Notes

- **Scope:** no out-of-scope behaviour found. Removing „Entfernen“ and its question from the machine record, keeping its
  address as a redirect, passing the origin through and landing with the confirmation are all asked for by the story.
  The BACKLOG/status changes are the scripts' output.
- **Tests:** the scenario traceability is complete (8/8), the moved ST-038 tests keep their titles, and ST-091's
  superseded scenario is listed with ST-121. The gaps listed above are about the Then being checked weakly (3, 5), the
  action composition not being run (4) and G30 no longer being asserted (6), not about a scenario missing its test.
- **Follow-up hurdle:** no finding qualifies. None is a security or data-loss risk, all are fixable in this story or are
  judgement calls, and no existing story can take them. No new story is proposed.

**Verdict: ready to merge.** No blocker; the major finding should be fixed in this story first.
**Most important: finding 1** – `machineFile` and its test still describe the old question page; shrink the query and its test to the removal confirmation.

## Resolution (implementation, 2026-11-04)

- **Fixed (major 1):** `machineFile` now returns only `id` and `title`; the stale `machineFile` test block is gone, the
  test header points to the new runner test, and `mayRemoveFiles`' comment names the file details.
- **Fixed (minor 2):** a removed file's question page shows only the rejection and „Zurück“ – no question and no list of
  attachments that no longer count.
- **Fixed (minor 3):** scenario 1 asserts the file's attachments are still exactly LG-042 and the machine model.
- **Fixed (minor 6):** the removal question and the details link are asserted in the new integration test – only
  „Endgültig entfernen“ carries `bg-destructive` (G30).
- **Fixed (minor 7):** the former address checks the file ID with `isId` before it builds the redirect.
- **Fixed (minor 8):** `attachmentsOf` → `attachedToOf`.
- **Fixed (minor 9):** the dead `removeFile.unknown` text is gone.
- **Fixed (minor 10):** `removedFile` → `removedFileTitle` at all three call sites.
- **Fixed (minor 11):** one `attachedToText(target)` beside the details is used by both views.
- **Fixed (minor 13):** `hrefOf`, `queryOf` and `listTexts` live in `src/test-support/html.ts`.
- **Fixed (acceptance remark 6):** the settings landing carries `#ki`, so the confirmation in the last section is visible.
- **Skipped (minor 4):** the action composition is two calls (`originOf`, `removalLanding`), each tested at its own
  seam; driving `actions.ts` itself would need a runner seam the catalog does not have. The new e2e for the no-origin
  landing runs the real action and the overview page.
- **Skipped (minor 5):** the machine overview's page wiring is now covered by that e2e (real action → overview with
  `?fileRemoved=` and its confirmation). A separate data function would duplicate the page's one call.
- **Skipped (minor 12):** moving the origin/address builder out of the route folder is a cross-story refactor; ST-117
  adds the third origin („Dateien“) and will touch the helper anyway – revisit there (line in this review, no story).
