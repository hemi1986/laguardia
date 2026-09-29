# Acceptance – ST-078: Remove the spike scaffolding code
Date: 2026-09-29 · Tests run: `node .claude/skills/implement/scripts/verify.ts --e2e` → verify passed, browser tests 23 passed (local), 0 failed · Preview: none usable – the Vercel preview of commit b140397 failed to deploy (GitHub deployment 6744871479, `npx vercel inspect dpl_EUfk2M73pAqrbNrNExJve9WFM4pa --logs`)

The story is a tech task with no Gherkin scenarios (`check-scenarios.ts`: 0/0). The checklist items are checked instead.

## Checklist items
| # | Item | Evidence | Result |
|---|---|---|---|
| 1 | Files removed; scan fails when a reference returns | `git diff main...HEAD --stat` shows all listed files deleted. `src/platform/spike-leftovers.test.ts` scans src, e2e, scripts, config and workflows, and has a self-test with 5 leftover kinds and the one allowance (`e2e/home.spec.ts`). My own grep finds nothing else. The scan runs in `npm run verify` through the tests. | OK |
| 2 | `/` clean, spike addresses 404 on preview | Local: `e2e/home.spec.ts` (5 address checks and the page check) is green. **Preview: not proven.** The Vercel deployment failed, so the "Browser tests on preview" run (36627265736) failed in the step "Wait for the Vercel preview". Left unticked on purpose. | Open, correctly unticked |
| 3 | Placeholder page | `src/app/page.tsx` uses the `Page` component and `visitorMessages("de").home`. Museum name and login link are in both catalogs. `e2e/home.spec.ts` checks status 200, no redirect, heading, no spike text, width ≤ 360, and the link click. "ST-004: Team pages require login" is green. | OK |
| 4 | `src/photo/*` unchanged | `git diff main...HEAD --stat -- src/photo` is empty. | OK |
| 5 | `spike` block gone from team catalog, catalog test green | Removed in `team.de.ts`. `messages.test.ts` was changed only to use `home.teamLogin` in place of the removed `problemReport.submit` (same assertion type, both languages). | OK |
| 6 | `security.spec.ts` on `/login` | Two variants (foreign origin, no origin). Each takes the action ID from the server-rendered `/login` HTML and checks status ≥ 400, no `set-cookie`, and `/team` still redirecting to `/login`. A control test with the own origin proves the rejection comes from the Origin check. Needs only the bypass secret. Local run green. | OK |
| 7 | Headers test green on preview | The test asserts all 5 headers on `/login` and is green locally. No preview run exists. | Open, correctly unticked |
| 8 | Runs on preview without `SPIKE_PASSWORD`, run linked | The workflow no longer references `SPIKE_PASSWORD`. No green run exists. Run 36627265736 failed because the preview deployment failed. | Open, correctly unticked |
| 9 | `report-problem.spec.ts` deleted, PR states the gap, ST-068 records it | File is deleted. ST-068 (lines 18, 22, 37) records the gap. The PR statement does not exist yet. | Open, correctly unticked |
| 10 | Import rules without the spike element | `eslint.config.mjs` keeps the platform, module and UI rules. `module-boundaries.test.ts` now covers platform→module, platform→app and module→app with non-spike code, and asserts the message text (stricter than before). | OK |
| 11 | verify green, nothing weakened, build without `SPIKE_PASSWORD` | verify passed. CI "verify" is green, and the second CI run (36627265710) was still in progress at first look. Test diff: deleted `e2e/report-problem.spec.ts`, `report-problem-input.test.ts` and its source (user-approved, ST-007 got a follow-up item at line 99). `report-problem.test.ts` only renames `"test-machine"` to `"m-1"`. No assertion was weakened. Build evidence is as you stated; I did not re-run the build. | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes, for `/` | `home.spec.ts` checks `scrollWidth ≤ 360`. | OK |
| List pages fast | no | No list. | n/a |
| Journal entry per command | no | No command changed. | n/a |
| Texts from the message catalogs | yes | `home.museum` and `home.teamLogin` in `visitor.de` and `visitor.en`. | OK |
| No personal data in logs | no | Nothing logged. | n/a |
| Museum name text | yes | "Flipper- & Arcade Museum Eschbach" was decided by the user in the test plan. It is identical in DE and EN, which is consistent with a proper name. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| The Vercel preview build failed for b140397, so items 2, 7 and 8 cannot be proven. The cause is unknown (I did not read the Vercel logs). It may be an unrelated build or env issue, for example a missing `DATABASE_URL` in the preview. | Story item 2, 7 and 8 need a working preview. | Question: read the Vercel build log before the PR. If the cause lies in this branch, fix it now, since it blocks ticking three items. |
| The old visitor and English page `/en` and the language of the placeholder: `/` is German only, with the English strings unused. | Vision says visitor pages are also English. Not stated for a placeholder. | Question: fine as a placeholder until ST-010. |
| The `e2e/team-*` browser tests skip on the preview, so ST-004's "Team pages require login" is only proven locally. | Existing behaviour. | None. |
| The runner's browser proof (rejected input kept, JS disabled) has no browser test until ST-007. | Approved by the user, recorded in ST-007. | None. |
| The leftover scan only knows the list of config files and the directories in its code. A new top-level config that mentions `SPIKE_PASSWORD` would be missed. | None. | Note only. |

## Verdict: accepted with remarks
All items the branch can prove locally are met. The remarks:
1. Items 2, 7 and 8 (the preview proofs) are still open because the Vercel preview of b140397 failed to deploy. Read the Vercel log, fix it if the branch causes it, and re-run "Browser tests on preview". Then tick the items and link the run.
2. Item 9 needs the PR text stating that no browser test covers the visitor problem report flow until ST-068 (which needs ST-007 and ST-013). The story must not go `done` before items 2, 7, 8 and 9 are ticked.
3. The CI run 36627265710 was still in progress when I checked.
