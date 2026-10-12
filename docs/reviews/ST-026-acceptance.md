# Acceptance – ST-026: Assign a defect and release claims
Date: 2026-10-12 · Tests run: `npx vitest run src/modules/repair "src/app/(team)/team/defects"` → 29 files, 223 passed, 0 failed; `npx playwright test e2e/assign-and-release-claim.spec.ts` (local, 360 px project) → 3 passed; `check-scenarios.ts ST-026` → 6/6 covered · Preview: none checked (browser tests need the e2e technician, not available there before ST-068)

Decisions of the test plan checkpoint (2026-10-12) taken as given: (1a) assigning an already claimed defect works like a takeover and names the previous claimant; (2a) the choice offers only active accounts, helpers only for defects suitable for helpers, not the technician themselves, not the current claimant.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician assigns a defect to a helper | `ST-026: Technician assigns a defect to a helper` (claim-defect-command.integration.test.ts) | Given: open defect suitable for helpers, unclaimed, real DB, fixed clock. When: `CMD-ClaimDefect` with `assignTo` via `executeCommand`, as technician Tom. Then: result ok; claimant in RM-OpenDefects is Anna; claim has `claimedBy` Anna, `assignedBy` Tom, literal `claimedAt`; journal entry type, actor Tom and data asserted. Complete. | pass |
| Helpers cannot be assigned defects not suitable for helpers | `ST-026: Helpers cannot be assigned defects not suitable for helpers` (same file) | Given: defect not suitable for helpers. When: Tom assigns to helper Anna. Then: `not-suitable-for-helpers`, no claimant, empty journal. Complete. | pass |
| Helpers cannot assign defects to others | `ST-026: Helpers cannot assign defects to others` (same file) | Given/When: helper Anna assigns to helper Ben on a defect that is suitable for helpers (so the rejection is really about the role). Then: `not-authorized`, still unclaimed, empty journal. Complete. | pass |
| Team member releases their own claim | `ST-026: Team member releases their own claim` (release-claim-command.integration.test.ts) | Given: defect claimed by Anna through the claim command. When: Anna releases at version 1. Then: not claimed in list and details, state still open, journal `EVT-DefectClaimReleased` by Anna. Complete. | pass |
| Helpers cannot release someone else's claim | `ST-026: Helpers cannot release someone else's claim` (same file) | Given: claimed by Tom. When: Anna releases. Then: `not-your-claim`; still claimed by Tom (list and details with literal timestamp); journal not extended. Both Then lines asserted. | pass |
| Technician releases any claim | `ST-026: Technician releases any claim` (same file) | Given: claimed by Anna. When: technician Eva releases. Then: not claimed, journal event with actor Eva. Complete. | pass |

All six go through the command layer (`executeCommand`), the real entry point of a command. The UI layer is covered additionally by `defect-details.integration.test.ts` ("assigning it and releasing its claim"), `assign-defect.integration.test.ts` and the three browser tests (360 px, with and without JavaScript). Unit tests `claim-defect.test.ts` / `release-claim.test.ts` pass.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Scenario tests titled exactly; verify green | yes | 6/6 titles found; vitest and e2e run green here; verify.ts reported green by the caller | yes |
| Commands via `aggregateCommand`, IDs from events.yaml, journal data without free text | yes | `claim-defect-command.ts`, `release-claim-command.ts`; journal data holds only IDs (`claimedBy`, `takenOverFrom`, `assignedBy`), `{}` for the release | yes |
| No `new Date()` / `randomUUID()` in domain code | yes | decisions use `clock.now()`; tests use `fixedClock` | yes (read in `claim-defect.ts`, `release-claim.ts`) |
| Server Action only through `formAction`, actor only from `currentPerson()` | yes | `zuweisen/actions.ts` uses `formAction`; the actor is not read from form data | yes |
| Texts from catalogs | yes | all new texts in `team.de.ts`, incl. error texts for the new error codes | yes |
| Only `index.ts` across modules | yes | page imports `@/modules/repair`, `@/modules/team` | yes |
| Migration when schema changed | yes | `schema.ts` touched (+2 lines); a migration is in the diff or none was needed – not verified by me in detail (code-reviewer) | question |
| 360 px usable | yes | browser tests run at the phone project; long labels wrap (`longLabel`) | yes |
| Controls offered only to who is not refused (G11), `<details>` works without JS (G22) | yes | detail-page tests assert `offered`; no-JS browser test passes | yes |
| No personal data in logs / journal | yes | journal holds IDs only | yes |
| List pages fast | n/a | no list changed beyond the claimant already shown | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Defect is resolved: assign / release | Yes – AGG-Defect: resolving ends the claim (`resolve-defect.ts`); assign gives `defect-not-open`; release gives `not-claimed`. Page offers neither (G11); the "offers no claim on a resolved defect" test covers claim. | OK. Minor: no test explicitly asserts the assign rejection `defect-not-open` or that „Zuweisen“/„Verwalten“ disappear on a resolved defect (unit test `claim-defect.test.ts` may cover the decision). Cover in this story if cheap. |
| Assigning to a deactivated or unknown account, or to nobody | Yes – decision (2a); test "assigns to nobody without an active account" covers banned, unknown, malformed ID, empty. | OK |
| Claimant's account was deactivated later | Technician can still release it (releaseRefusal ignores the account state) and the name is resolved via `teamMemberNames` (includes inactive). | OK |
| Concurrent change: Anna's release page is stale after Tom took over | Test expects `not-your-claim` (decision rejects before a conflict). The command's doc comment says "answered with a conflict", which is not what happens for a helper. For a technician with a stale version a conflict is expected. | Minor: align the comment with the behaviour; add a technician release-with-stale-version test if not present in `release-claim.test.ts`. |
| Two technicians assign the same defect concurrently | Optimistic version check (HS-16): the second gets the conflict. | OK by platform (ST-003); no story-specific test (acceptable) |
| Assigning to an already claimed defect (decision 1a) | Yes – covered by "assigns a claimed defect to someone else as a takeover", incl. `takenOverFrom` and the confirmation "Vorher: Anna." | OK |
| Assigning to a helper someone else has claimed, defect not suitable for helpers (claimant is a technician, assignee a helper) | Yes – `not-suitable-for-helpers`; the form does not offer the helper | OK |
| Technician assigns to themselves via the form | Not offered (2a); command treats `assignTo` = self as a normal claim without `assignedBy` | OK |
| Technician assigns to another technician | Allowed ("any team member"); E2E/choice shows the role in the label | OK |
| Confirmation texts | „Du hast „X“ Anna zugewiesen.“ (+ "Vorher: …"), „„X“ ist wieder frei.“; tests assert literal German text for assign and for the helper's own release. No test for the confirmation when a technician releases someone else's claim behind „Verwalten“ (the browser test covers the flow). | Minor: acceptable |
| Release confirmation does not say whose claim was released | The text is "ist wieder frei" – fine for G3 | Question for UX only, no action |
| Rejection of the one-tap „Übernahme aufheben“ | Opens the fold and shows the rejection (G8) – implemented, no test found for the opened state | Minor |
| Other language (English visitor pages) | Team pages are German only | n/a |
| Machine status (Not on display, retired) | A defect closed on retirement is not open → assign/release not offered; story has no rule beyond that | OK |
| Many team members in the choice | Select list of all active accounts sorted by name; fine for a museum-sized team | Question: long lists at 360 px are native selects, fine |

## Findings by severity
- Blocker: none
- Major: none
- Minor (stay as lines here, no new story):
  1. The doc comment of `release-claim-command.ts` promises a conflict for a claim taken over meanwhile, while a helper in that case gets `not-your-claim` (as the test expects). Align the comment.
  2. No explicit test of assigning / releasing on a resolved defect at command level, and none for the opened „Verwalten“ fold after a rejected release.
  3. Migration need for the two `schema.ts` lines not verified by me.

## Verdict
accepted with remarks

## After the review (2026-10-12)

- **Minor 1 fixed:** the comment of `release-claim-command.ts` says what happens (a helper is told the claim is not theirs any more, a technician gets a conflict); the command test checks both.
- **Minor 2 fixed:** command test "assigns no defect that is resolved"; browser test "a claim released meanwhile is said at the button – the fold „Verwalten“ stays open" – which found that the rejection was lost, fixed in the page.
- **Minor 3:** the migration `drizzle/0018_defect_claim_assigned_by.sql` adds the column, its CHECK and its foreign key; the code review found nothing on it.
