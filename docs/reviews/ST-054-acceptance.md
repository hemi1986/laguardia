# Acceptance – ST-054: Attach a camera photo as a file of a machine
Date: 2026-10-25 · Tests run: `npx vitest run -t "ST-054"` → 5 passed, 0 failed; `npx vitest run src/upload` → 23 passed; e2e not re-run by me (needs technician account and Blob token; the caller reports `verify.ts --e2e` green at 8beff8d) · Preview: https://laguardia-heahsm17v-hemi6.vercel.app (not exercised: team login needed)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Team member attaches a camera photo to a machine | attach-photo.integration.test.ts | Given: real PG, runner with photo step, EXIF orientation 6 + GPS photo. When: via `formRunner` + form definition. Then: LG-042 shows title/category photo, sibling machine shows none; stored bytes have no EXIF, jpeg. Literal title. Machine record read via `machineRecord`. | pass |
| Photo of a machine model | same | Attaches with attachTo machine-model; both machines of the model show it (literals). Model is generic, not "Medieval Madness" – immaterial. | pass |
| Title is required | same | Blank title: state error `title-required`, no file, nothing left in storage. | pass |
| A rejection says the photo must be chosen again | e2e/attach-photo.spec.ts (+ integration asserts `photoAgain: true`) | Browser: photo chosen, no title, exact German text asserted, chooser empty ("Foto entfernen" gone), record shows no files, 360 px width. Skips without credentials/Blob token. | pass (per caller's green run) |
| Non-image content is rejected | same integration file | Text content with image MIME rejected as `not-an-image`, no `photoAgain` (matches G8a: not after photo rejection), nothing stored. | pass |

Extra tests: form sent without a photo -> `file-required`; page flow e2e (record -> page -> back, shows under Foto, opened as image/jpeg, no EXIF); `view-address.test.ts` covers `.jpg` content names.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | Both e2e tests assert scrollWidth <= 360 | OK |
| List pages fast | no | No list page | n/a |
| Command writes journal entry | yes | Reuses `attachFileCommand` (ST-037), unchanged transaction | OK |
| Texts from message catalogs | yes | `teamMessages.attachPhoto`, `machineRecord.attachPhoto` | OK |
| No personal data in logs | yes | None added | OK |
| Advisories | n/a | no dependency change | n/a |
| Rejected photo cleanup | yes | storage empty after rejection (tests) | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Machine "Not on display"/retired: button shown, attach allowed? | ST-037 rules apply; not verified by me for this page | question (confirm same as "Datei anhängen") |
| Unknown museum number on the photo page | Handled: "unknown" text shown | none |
| Other role (helper vs technician) | Story: every team member; test uses a helper | none |
| Photo over size limit / unsupported format (HEIC) | ST-016 texts apply; handled in the client form, not tested here | question: covered by ST-002/016 tests? |
| Photo stored before the command can reject (title) and deleted again | Runner behaviour, tested via empty storage | none |
| Double submit / slow upload on phone | none | question |
| Visitor/anonymous access to the page | `requireTeamMember` on page and action | none |

## Verdict
accepted with remarks – all five scenarios have real tests that pass; remarks: scenario 4 and the page flow rely on e2e that I could not run (credentials), so confirm green on the preview; confirm retired-machine behaviour matches "Datei anhängen". No finding passes the follow-up hurdle.
