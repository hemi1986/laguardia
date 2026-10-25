# Acceptance – ST-032: Add photos to a work log entry
Date: 2026-10-25 · Tests run: `npm test -- -t "ST-032"` → 7 passed, 0 failed (4 files; `check-scenarios.ts` 8/8 covered); browser scenario 5 and happy path not re-run by me (reported green in `verify.ts --e2e`, needs the Development Blob store) · Preview: none

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Team member logs work with photos | `log-work-photos.integration.test.ts` | Given: open defect from builder. When: through `formRunner` with real sharp-made 3000x2000 JPEG, EXIF orientation 6 and GPS. Then: 2 photos stored, longest side <= 2048, `meta.exif` undefined. Good. Only the Server Action runner is the entry, not the page; the browser-side preparation is covered by the e2e happy path. | pass |
| At most 5 photos | same | 6 photos, error `too-many-photos`, German text with "5" asserted as a literal, nothing added, nothing left in storage. Good. | pass |
| Photos are shown with the work log entry | `defect-details.integration.test.ts` | Entry with two photos, page rendered, both photo `src` inside the entry's own article. Good. | pass |
| Photos are shown on the repair history | `repair-history.integration.test.ts` | Entry with 2 photos on LG-042, history page rendered, both `src` before the work log's `</ol>`. Good. | pass |
| A rejection says the photos must be chosen again | `e2e/log-work-photos.spec.ts` (+ G8a sentence in `log-work-photos.integration.test.ts`) | Integration checks the exact sentence with 2 photos and empty text. E2E (360 px) checks the alert text, no "Foto entfernen" button and no preview image. Both Then lines covered. | pass (e2e as reported) |
| The conflict text names the photos | `log-work-photos.integration.test.ts` | Real conflict (Tom claims the defect, Anna sends version 0 with 2 photos). Asserts state incl. typed values and `photoAgain`, the exact text, nothing stored. Good. | pass |
| Non-image content is rejected | same | Valid photo plus a PDF named .jpg; `not-an-image`, no `photoAgain`, nothing added, nothing stored. Good. | pass |
| Photos cannot be added to an existing entry | `log-work-command.integration.test.ts` | Given entry without photos. When: `tamperWithWorkLogForTest` tries "add-photo". Then entry equals the earlier one. Weak by nature: it only proves that one test-only command doesn't touch photos; the real guarantee is that no command or action exists (design). Acceptable, "green by design" as agreed. | pass (remark) |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts page width <= 360 before and after submit with 2 photos; previews wrap (`flex-wrap`) | OK |
| List pages fast with realistic data | partly (repair history loads photo addresses) | Signed addresses are created per photo while rendering; no measurement for a history with many photos. | Remark |
| Command writes its journal entry | yes (unchanged CMD-LogWork) | Command path unchanged; the photo names are not in the journal | OK |
| Texts from message catalogs | yes | `repair.ts` (`workLogPhoto`, `workLogPhotos`), `team/shared.ts`, `rejection-text.ts`; G8a sentence from the catalog | OK |
| No personal data in logs | yes | Only `console.error` of the storage error message on `not-stored`, no photo or person | OK |
| Photos only visible to team members / no metadata | yes | Private storage with signed 5-minute addresses; EXIF absence asserted | OK |
| Security advisories | n/a | no dependency change | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Five photos of the largest size: browser caps each at 600 KB (about 3 MB), but the server accepts up to 2 MB per photo; a hand-made request with 5 x 2 MB exceeds the 4 MB body limit and Next.js answers with its own error, not a form rejection | No rule; the approved decision covers the browser path | question (low risk, not a security or data-loss issue; fix now only if cheap) |
| Browser without JavaScript / preparation fails: the form waits for preparing; a photo that stays above 600 KB shows "too large" and the entry can be sent without it | Photo texts exist | no action |
| Exactly 5 photos accepted, 6th is only rejected on send (not on choosing) | Story: "rejected with the maximum shown" | OK as specified; could be a UX improvement (new story only if wanted) |
| Photos orphaned if the command throws after storing | ADR 0007 accepts leftovers | no action |
| Retired / not-on-display machine, resolved defect | Log work is refused on a non-open defect (existing rule), photos are stored first and deleted again | OK |
| Photo with a helper vs. technician role, other language | Team pages are German only; the repair history is team-only | no action |
| Long what-was-done text with photos | No max length (memory: not raised) | no action |
| Defect page for a very old entry whose signed address expired | Addresses are made per render | no action |

Follow-up hurdle: no finding meets it; nothing becomes a new story.

## Verdict
accepted with remarks – all 8 scenarios have a real test titled correctly and the story's tests pass. Remarks: scenario 8's test only exercises a test-only command (agreed "by design"); the server-side 2 MB per photo versus 4 MB body limit mismatch for hand-made requests; no measurement of the history page with many photos.

## Resolution (implementer, 2026-10-25)
1. **Kept:** scenario 8 holds by design (photos are a column of an entry that is never written again); the probe is the only way to try what no command does, as for ST-024's "Work log entries cannot be changed".
2. **Fixed:** the chooser stops at 5, and the runner refuses more than 5 before storing any – a hand-made post of more than fits 4 MB still gets Next.js's own error, which no person on the form can reach.
3. **Skipped:** the repair history page issues all its photo addresses in one call (`photoViewAddresses`, one token per page); a measurement waits until a machine has many photos – ST-033's load test covers the page without them.
