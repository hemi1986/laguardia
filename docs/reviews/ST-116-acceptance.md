# Acceptance – ST-116: Correct a file's title and file category
Date: 2026-11-06 · Tests run: `npm test -- -t "ST-116"` → 7 passed, 1 failed (3 of 3 runs); the AI test file run without `-t` → 2 passed; `npm run typecheck` ok, `npm run lint` 0 errors · Preview: none

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A helper corrects title and file category | change-file-details.integration.test.ts | Yes. The helper (Anna) saves through the real form runner and the real form definition. Asserts the landing, the confirmation text on the details page, LG-042's files with the new title and group, and a journal entry with `changedDetails` and no typed title. | pass |
| The form is headed with the file and has its current values | same | Yes. Heading, labels, input value, preselected category, the four options in order, submit text, back link. | pass |
| An empty title is rejected | same | Yes. Error code, kept values, rejection text, nothing changed, no journal entry. The "„Titel“ is marked" part (aria-invalid) is not in this test but is in the e2e (which skips without a team account). | pass (remark 1) |
| A file without a file category is rejected | same | Yes. Missing and forged category, text, title kept, no change. | pass |
| Saving without a change is confirmed and records nothing | same | Yes. Landing and confirmation, no journal entry, version unchanged, and a stale version is not a conflict. | pass |
| A change made meanwhile rejects the form and keeps what was typed | same | Yes for the behaviour: error, kept values, the other correction is still there. The text differs from the scenario (see decision below). | pass (remark 2) |
| A removed file cannot be corrected | same | Yes. Rejection text, the file shows nowhere, form without submit, unknown or forged ID gives no file. | pass |
| A corrected title shows in earlier references and costs nothing | ai-assessment-attachments.integration.test.ts | The Given, When and Then lines are asserted correctly (reference title, no AI-work start, request count, index entry and cost). **But the test fails when run alone** (`expected 8 to be 7` at `seam.requests.length`). It passes only when the whole file runs, so it depends on the state left by the ST-115 test before it. | **FAIL** |
| Someone not logged in cannot correct a file | e2e/change-file-details.spec.ts | The GET of the form address is redirected to the login and no „Titel“ field shows. "or sends the form" is not tested. Server side, `requireTeamMember()` is called in the action. | pass (remark 3); not run (no e2e environment) |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Texts from the catalogs | yes | `collection.ts` catalog (`changeFileDetails`, `fileDetails.edit` and `.saved`); rejections via `rejectionText` | yes |
| Shared page frames | yes | `Page`, `BackLink`, `Field`, `NativeSelect`, `Rejection`, `VersionField` and `keptKey` from form-parts | yes |
| Every command writes its journal entry | yes | `EVT-FileDetailsChanged` is in the catalogue; the unchanged case writes none, as the rule says | yes |
| No personal data in logs/journal | yes | Title kept out of the journal (asserted) | yes |
| Domain language | yes | „Dateikategorie“, „Datei bearbeiten“, "file category" in code | yes |
| Phone usability | yes | One field and one select, a single column; an e2e at phone size exists but needs a team account | not run |
| Performance with realistic data | n/a | One file, one row | n/a |
| Tests green for the story | yes | One of 9 fails when run with `-t` | **no** |
| Security advisories | n/a | No change to dependencies | n/a |

## Decision: version-conflict text
The form-runner convention text („Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.“) is **acceptable**. The scenario's own Then asks for "Bitte die Seite neu laden", which would be wrong here because the form keeps the typed input and the page re-renders with the current version. ST-100/103/104 set the precedent, and `rejection-text.ts` states the reason. The behaviour the scenario protects is checked: the conflict is rejected, the input stays, and the other correction stays. The story text is now out of step with the build. I recommend the story's Context and scenario are aligned to the convention text, or the rule is stated once in G8, so that nobody checks against the literal later. This does not block acceptance.

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Two team members open the form at once, and one of them has just attached or detached (the version rises) | Yes: Context says rare and harmless | none |
| Title with only spaces or very long | Spaces: the empty-title rule (the test uses "  "). Length: no rule, and by memory no question about it. | none |
| Title edited to the same text with different case or surrounding spaces | The decision trims; an unchanged title after trimming counts as no change. Not stated in the story. | question (minor) |
| Retired machine, or a file attached only to models, as origin | Origin handling is from ST-114 | none |
| Another language | UI is German only | none |
| Forged `from=` parameter on the form | `originOf` checks against the closed set (G17) | none |
| The form is open, the file is then removed, and the page is reopened | Covered by the "again" check in the removed-file test | none |

## Minors (diff against conventions)
1. The "„Titel“ is marked" line of the empty-title scenario is asserted only in the e2e, which skips without a team account (known CI issue). The integration test could check `aria-invalid` on the rendered form.
2. The scenario's literal conflict text is not asserted (see the decision).
3. The not-logged-in scenario says "or sends the form". Only the GET is tested. A test of the action without a session would close this.
4. The `fieldOf` map, the `category === ""` logic and the "Bitte wählen" placeholder are in line with G8 and G20. Nothing found against the catalogs.
5. The e2e test name for the happy path does not start with `ST-116:`. That is allowed, because the scenario is covered by the integration test, but it is inconsistent.

## Verdict: not accepted
Blocker: `ST-116: A corrected title shows in earlier references and costs nothing` fails reproducibly when run as `npm test -- -t "ST-116"` (also with the file path): `seam.requests.length` is 8, not 7, after the correction. It passes only with the other tests of the file around it. Either one more request really goes to the seam after the title correction (a scenario violation: "no request goes to OpenRouter"), or the test counts a request caused by its own set-up (`requestAiAssessment` / the read with `dependencies: ai()`) and is order-dependent. The implementer must find out which. The rest of the story is sound; with this fixed, the verdict is accepted with remarks.
