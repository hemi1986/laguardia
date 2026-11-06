# Acceptance – ST-116: Correct a file's title and file category
Date: 2026-11-06 (re-check) · Tests run: `npm test -- -t "ST-116"` → 9 passed, 0 failed; per file with `-t "ST-116"`: change-file-details.integration.test.ts 8 passed, ai-assessment-attachments.integration.test.ts 1 passed (the other test there is skipped); scenario trace 9/9 · Preview: none

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
| A corrected title shows in earlier references and costs nothing | ai-assessment-attachments.integration.test.ts | Yes. The request count is taken before and asserted directly after the correction, no page read in between. Passes alone (`-t`) and with the file. | pass |
| Someone not logged in cannot correct a file | change-file-details.integration.test.ts (+ e2e for the GET) | Yes. The form is sent as a visitor through the real form runner: `not-authorized`, no landing, title and file category unchanged, no journal entry. The redirect on opening the address stays in the e2e (skips without a team account). | pass |

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
| Tests green for the story | yes | 9 of 9 pass with `-t` and per file | yes |
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

## Re-check
Blocker resolved: the request-count test passes alone. Minor 3 (sending the form as a visitor) is closed by the new test. The story now has a Note about the conflict text, so the conflict decision above stands without a remaining discrepancy. Open minors: 1 (aria-invalid only in e2e), 5 (e2e test name without the prefix). Neither blocks.

## Verdict: accepted with remarks
Remarks: the "„Titel“ is marked" line is verified only in the e2e, and the phone-size and login-redirect e2e checks did not run here (no team account).
