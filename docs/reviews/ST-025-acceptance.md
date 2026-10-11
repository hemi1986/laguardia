# Acceptance – ST-025: Claim or take over a defect
Date: 2026-10-11 · Tests run: `npx vitest run` → 83 files, 506 passed, 0 failed; `npx vitest run src/modules/repair/claim-defect-concurrency` ×5 → 5/5 passed (stable); `npx playwright test e2e/claim-defect.spec.ts` → 4 passed · Preview: not exercised (deployment protection; team pages are covered by the local browser run at 360 px). `check-scenarios.ts ST-025`: 6/6 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Team member claims an unclaimed defect | `e2e/claim-defect.spec.ts` | Given: unclaimed (list and page show no "übernommen" before). When: real button on the defect's page, 360 px. Then: confirmation text, "Von dir übernommen", list shows the claimant (to Tom as "Von dir übernommen", to a helper as "Übernommen von E2E Technician"). Complete. Tom's claim is never asserted by a stored value, only through the page – fine for a browser test. | pass |
| Taking over a claimed defect | `claim-defect-command.integration.test.ts` | Given: suitable for helpers, claimed by Tom (via the real command). When: Anna (helper) claims. Then: result `takenOverFrom` Tom, read model claimant Anna, stored claim, journal of both events. "Tom is no longer claimant" is asserted by the claimant being Anna (at most one). Complete. Browser variant (second e2e test) also covers the button text and confirmation with "Vorher". | pass |
| Helpers can only claim defects suitable for helpers | same file | Both Given variants (unclaimed / claimed by Tom) set up; rejection with `not-suitable-for-helpers`; claimant kept; journal unchanged. Complete. | pass |
| Two team members claim at the same time | `claim-defect-concurrency.integration.test.ts` | Two real transactions at version 0, order forced by a row lock, Tom stored first. Asserts Tom claimed, Eva `version-conflict`, journal has only Tom's event, and the literal German text. Stable over 5 runs. Complete at the command seam. NOT checked in the browser: that Eva's form actually shows the conflict (see edge cases). | pass |
| Resolved defects cannot be claimed | same command file | Given resolved via stand-in; both roles rejected `defect-not-open`; no claim stored. Complete. | pass |
| Filter "claimed by me" | `open-defects.integration.test.ts` | Given: Anna claims Rubber cracked, Tom claims Left flipper weak (plus an unclaimed third). When: page data function with `mine=1` for Anna, rendered by the view. Then: only "Rubber cracked" listed, others absent from the HTML, checkbox stays checked. Complete; also the combination with a priority filter and the empty text. Entry point is the data function plus view, not the page; the e2e test additionally goes through the real form. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | `pageWidth <= 360` asserted after claim, in the list, after take-over and with the filter | OK |
| List pages fast with realistic data | yes (open defects list) | One extra query for names (`teamMemberNames`, only for matching claimants); claimant column is a plain column. No measurement, no concern | OK |
| Command writes its journal entry | yes | `EVT-DefectClaimed` asserted incl. actor and `takenOverFrom` (take-over test); rejected claims leave the journal unchanged | OK |
| Texts from the message catalogs | yes | All new texts in `team.de.ts`; error texts via `commandErrorText`. No English page text needed (team page) | OK |
| No personal data in logs | yes | Journal holds IDs only (`claimedBy`, `takenOverFrom`), names are read from Team | OK |
| Migration committed | yes | `drizzle/0015_defect_claim.sql`, `meta/0015_snapshot.json`, `_journal.json` tracked; CHECK `claimed_by`/`claimed_at` together, hand-written FK per ADR 0002 | OK |
| Works without JavaScript | yes | e2e "without JavaScript" claims a defect | OK |
| Screen block of the story | yes | Texts match: „Übernehmen“, „Von {name} übernehmen“, „Übernommen von {name}“, „Von dir übernommen“, „Du hast „…“ übernommen.“ + „ Vorher: {name}.“, „Nur von mir übernommene“, conflict text. No button for helper on unsuitable defect (e2e), resolved/retirement (`canClaim` + decision table `it.each`), own claim (e2e). Control lives on the defect's page, not in the list | OK |
| Conventions note added | yes | SKILL.md paragraph "A command behind a single button" | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Claim posted with a stale version in the browser (Eva's form after Tom claimed): the form is wired to show the rejection and posts the version of the page (`claim-defect-form.tsx`, `claimDefectInput`), but no browser or component test exercises it; only the command seam does. Scenario "Two team members claim" says "Eva is told ... asked to reload" – a user-visible line proven only at the command/text level. | Story Context, Screen "Concurrent claim" | Remark (minor): add an e2e/component test that submits a stale form and expects the text. Code reading suggests it works. |
| After the conflict the form keeps the stale version in its hidden field, and the button stays, so a second click yields the same conflict until reload (the text does say reload). | Text asks to reload | Question / acceptable |
| `?claimed=1` opened by a non-claimant: no confirmation shown (`details.claimant?.you` guard; tested). Opened by the claimant any time later (bookmark, back button): the confirmation "Du hast … übernommen" is shown again, with "Vorher: Tom." even long after. | G3 says confirm after claiming | Question; harmless |
| Double submit: button `disabled` while pending; without JS a second POST arrives at a new version and is answered with a conflict or `already-claimed-by-you` (text exists, claim time not renewed – tested at the command). | Context 3a | OK |
| Claim on a defect closed on retirement: rejected `defect-not-open` (decision table covers both states); no integration test with a real retirement, and button hidden via `canClaim`. | Context | OK |
| Filter "claimed by me" combined with machine/priority/helpers: combination with priority tested; with the three others only by construction (same query builder). Empty text for several filters is the generic one, tested. | Screen "combines" | OK |
| Claimant whose account no longer exists: name falls back to "" (shows "Übernommen von "); FK `ON DELETE RESTRICT` prevents it | Comment in code | OK |
| Technician and helper roles of the other side: helper sees "Nicht für Helfer:innen geeignet" without button (e2e); technician claims anything. A helper's claimed unsuitable defect (technician later unticks "suitable for helpers" – not possible in current stories) not applicable. | – | OK |
| Releasing a claim / stale claims | Out of scope (ST-026, ST-048) | – |

## Findings by severity
- Blocker: 0
- Major: 0
- Minor: 1 – the browser-level conflict display for a stale claim has no test (the command level has).
- Questions: 2 (repeated confirmation on a later visit with `?claimed=1`; stale version stays in the form after a conflict).

No finding passes the follow-up hurdle.

## Verdict
**accepted with remarks**

## Resolution (implementation, 2026-10-11)

- **Minor fixed:** `e2e/claim-defect.spec.ts` – "a claim made meanwhile is answered with a conflict, not a silent takeover – then the page offers taking over": two phones, the second claim is rejected with „Jemand hat das inzwischen geändert …“ in the page.
- **Question 2 answered by that test:** after the conflict the page is rendered again with the defect as it is now – it names the new claimant and offers „Von … übernehmen“, which then works; nobody is stuck with the old version.
- **Question 1 not changed:** a reloaded or bookmarked `?claimed=1` shows the confirmation again to the claimant, like the other confirmations of the application.
