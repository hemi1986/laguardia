# Acceptance – ST-114: See a file's details
Date: 2026-11-03 · Tests run: `npx vitest run "src/app/(team)/team/dateien" src/modules/collection/file-details.test.ts` → 3 files, 24 passed, 0 failed (e2e not run, as instructed) · Preview: none

`check-scenarios.ts ST-114`: 10/10 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A team member opens a file's details from the machine record | `file-details.integration.test.ts` | Yes. The file is set up with 12.4 MB and category Manual, added by Tom on 2 Nov, and the helper Ben takes the address from the machine record's real „Details“ link. The page loader and view then render. Literals are asserted: heading, „Handbuch · PDF · 12,4 MB“, „Hinzugefügt von Tom am 02.11.2026“. „Datei öffnen“ is only asserted as an href to the ST-037 address. The e2e test adds the real 303 from that address. | pass |
| „Angehängt an“ names every machine and machine model | same | Yes. LG-042, a retired LG-041 and the model are set up, and the list lines are asserted as literals in order. The link of LG-041 goes to its machine record. | pass |
| „KI-Erfassung“ says how far the AI index got (outline, 3 examples) | same | Yes. A real indexing run is driven and a file added afterwards has no entry. All three texts are asserted as literals. „Started no run“ is shown by no OpenRouter requests and an unchanged journal. | pass |
| A technician tries a failed file again from its details | same | Yes. The test uses the real form runner and command, and checks the landing address, one run started, the confirmation text and „Wartet auf KI-Erfassung“. „Erneut versuchen“ is gone afterwards, there is no refresh mechanism in the markup, and a later run shows „Für die KI erfasst“. The origin is kept. | pass |
| While AI is off there is no section „KI-Erfassung“ | same | Yes. The key is removed. The section and the button are absent. The retry sent anyway is rejected with `file-indexing-ai-off`, no run starts and the journal is unchanged. One weak spot: `version` is computed as `0` or `-1` rather than read from the page. This is harmless because the rejection is by AI-off. | pass |
| A helper sees the details but cannot try a failed file again | same | Yes. Ben sees „Für die KI nicht lesbar“ and no button. A retry sent anyway gives `not-authorized`, starts nothing and leaves the journal unchanged. | pass |
| A removed file has no details page, and nobody outside the team reaches one | same plus `e2e/file-details.spec.ts` | Removed, unknown and forged ids give no data, which the page turns into `notFound()` (read in `page.tsx`). Not-logged-in is covered by the e2e test, which needs no account and asserts a redirect to `/login` with nothing of the file shown. The page's first step is `requireTeamMember()`. The e2e "removed" test is skipped without a team account. The page-level not-found is not rendered in a test, only the data function returns nothing, which is acceptable here. | pass |
| A failed file on the form „KI“ leads to its details | same | Yes. The link is taken from the rendered settings section, and its address is asserted as `…/details?from=settings`. The page then shows the attachment and the reason. | pass |
| The way back leads to where the person came from (outline) | same | Yes. The links come from the real machine record and settings pages. Each way-back text and href is asserted as a literal. A helper with `from=settings` gets the default (G11), as the Notes require. | pass |
| Without a known origin the way back leads to the machines (outline) | same | Yes. The test covers no origin, a foreign URL, `//evil`, a non-existent museum number and `machine:https://…`. Each gives „Zurück zu den Geräten“ → `/team/machines`, and no link or text from the address appears. The origin is a closed set, resolved server-side and the way-back href is built in code, so there is no open redirect. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from the message catalogs | yes | All new texts are in `platform/messages/team/collection.ts` and `ai-assistance.ts`. The view uses `teamMessages`. | yes |
| Domain language | yes | „Angehängt an“, „Ausgemustert“, „Dateikategorie“ and „Gerät“ are used as in the story. | yes |
| 360 px usable | yes | The view is a single column with `[overflow-wrap:anywhere]` on the list, and the buttons are `self-start`. The new „Details“ button sits beside „Entfernen“ in the machine record's file row. The e2e test is named "on a phone", but no layout assertion was seen and I did not run it. | unverified – see remark 1 |
| Every command writes its journal entry | yes | No new command. Retry reuses CMD-IndexFileForAi. The tests show the journal is unchanged for pages and rejected retries. | yes |
| Accessible name | yes | „Details“ carries `aria-label` „Details zu „<title>““, which tells identical links apart. | yes |
| No personal data in logs | n/a | No logging added. | yes |
| List speed with realistic data | n/a | The page shows one file. The machine record gains only a link per file. | yes |
| Security | yes | The origin is a closed set and checked server-side, and the retried confirmation is read from the journal, not trusted from the address. The id is validated with `isId`. | yes |
| Module boundaries | yes | The page composes Collection, AI assistance and Team through their `index.ts`. | yes |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| `?retried=1` forged by a person who did not retry | No confirmation is shown, because it is read from the journal for the viewer. | none (handled) |
| Retry from the page after the file was indexed meanwhile or AI was turned off | The Rejection component shows the command text, the page stays (G8). | covered by the command, minor: no page-level test |
| A file that is attached to nothing | „Nirgends angehängt“ is already in the catalog and the view, and ST-115 owns the scenario. | none |
| A very long file title or a long machine model title | `[overflow-wrap:anywhere]` is on the list. The heading and head line were not checked. | minor: look at 360 px |
| The removed-file e2e test needs a technician account, and CI has none for team specs (see memory) | n/a | minor |
| A machine record opened by the reserved museum number as origin | `originOf` resolves it to the current museum number. | none |
| Helper opening `from=machine:LG-042` | Allowed, since it is the helper's own page. | none |
| The „Details“ plus „Entfernen“ buttons in a narrow file row | Not checked. | minor, see remark 1 |

## Remarks (minor, none reaches the follow-up hurdle)
1. The 360 px layout of the machine record's file row (title, „Details“, „Entfernen“) and of the details page was not verified by a test or a run. Worth one look on a phone.
2. The scenario "While AI is off…" computes `version` as `0` or `-1` rather than reading it. This is cosmetic.
3. The page-level `notFound()` and the redirect are shown by the e2e tests, but the removed-file one is skipped without a technician account.

Verdict: **accepted with remarks**
