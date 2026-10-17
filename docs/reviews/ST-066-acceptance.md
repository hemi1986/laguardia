# Acceptance – ST-066: Remove the spike configuration and data
Date: 2026-10-17 · Tests run: `npx vitest run src/platform/spike-leftovers.test.ts` → 2 passed, 0 failed; `check-scenarios.ts ST-066` → 0/0 scenarios, traceability OK (tech task, no scenarios) · Preview: none (no pull request yet; production `https://eschbach.michaelschempp.de` checked)

## Scenarios
Tech task: no Gherkin scenarios. The checklist items are the acceptance criteria.

| Checklist item | Evidence found | Really checked? | Result |
|---|---|---|---|
| No `SPIKE_PASSWORD` in any Vercel environment | Recorded Vercel API listing (2026-10-17); line removed from `.env.development.local`. I cannot query Vercel. `grep -rn SPIKE .github/` finds nothing, and `spike-leftovers.test.ts` (passes) guards the code. | Recorded evidence is specific (tool, date, all three targets) and consistent with the repo state. | OK (recorded) |
| Secret `PREVIEW_SPIKE_PASSWORD` gone, browser tests green without it | `gh secret list` and `gh secret list --app dependabot` both show only `VERCEL_AUTOMATION_BYPASS_SECRET`. Workflows have no SPIKE reference. | Secret deletion verified by me. The "`e2e` green on this story's pull request" claim is not yet true: no PR exists, and the `Browser tests on preview` and `CI` runs on the branch were still `in_progress` when I checked. | Open – condition |
| Blob store has 0 blobs under `spike/` | Store is OIDC-only, so no prefix listing from outside. Manual deletion in the Vercel UI. Store metadata went from 4 blobs / 109 MB to 1 blob / 254 KB. | Sufficient. The drop of 3 blobs and about 109 MB fits the deletion of the spike files and photos, and the remaining 254 KB blob is a plausible non-spike object. The item's "scripted listing" wording is not met, but the story text states why. Not independently reproducible. | OK (with remark) |
| `problem_report.machine_id` and `reporter_team_member_id` follow the ID convention; no stray rows | I checked the migrations. `0003_problem_report_reporter_team_member.sql` sets `reporter_team_member_id` to `uuid` and adds an FK to `team_member`. `0005_machine.sql` sets `machine_id` to `uuid` and adds an FK to `machine`. A SQL count on the production branch gave 0 (user, recorded). | The type argument holds, because a `uuid` column cannot store `"test-machine"`. The FK also closes the gap. Preview branches are covered by the argument that migrations run in every deployment build (ADR 0006), not by a listing. | OK |
| Production `/spike`, `/spike/files`, `/spike/photos`, `/api/spike`, `/api/spike/upload` return 404; `/` shows neither test machine nor spike links | I re-ran the requests: all five return 404. `/` contains no `test-machine` and no `/spike` (match count 0). | Verified by me. | OK |
| Production builds and runs without `SPIKE_PASSWORD` | Production deployment of `0c5b210` (PR #85) is `READY` (recorded). `/` is served and the spike routes return 404 now. | Plausible and consistent with the live checks. | OK (recorded) |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px usable | No (no UI) | – | n/a |
| List pages fast | No | – | n/a |
| Every command writes its journal entry | No (`events: []`, no commands) | – | n/a |
| Texts from message catalogs | No | The diff only touches Markdown. | n/a |
| No personal data in logs | Indirectly | The goal of the story is to remove blobs that may show people (spike photos). Their deletion is the main compliance outcome. | OK |
| Critical advisories within 48 h | No | No dependency change in the diff. | n/a |
| Diff vs engineering conventions and domain language | Yes | The diff is `ST-066-remove-spike-scaffolding.md` plus the regenerated `BACKLOG.md`. It has the expected generated shape: ST-066 moves to "In Progress", counts 1/30. English throughout, terms match `CONTEXT.md`. | OK, minors below |

Minors:
1. The checklist item 2 is ticked `[x]` with "`e2e` green on this story's pull request" before the PR exists. This is a claim ahead of the evidence. Re-check once the PR's checks are green.
2. The story keeps the "Back to `review` on 2026-09-29" note as the last Notes line, after the 2026-10-17 entry. The order is not chronological. Cosmetic.
3. Item 3 says "scripted listing", but the evidence is manual UI deletion plus store metadata. The item text could say so, but the evidence line already explains it.

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Preview deployments of old branches that still carry spike code and `spike/` blob routes | Not stated. The OIDC store is shared, but blobs are gone. | Question: no action. Old previews cannot recreate blobs without `SPIKE_PASSWORD`. |
| A Neon preview branch created before migration 0005 still holding a `"test-machine"` text row | The story argues migrations run per deployment build. Branches never redeployed since are not covered. | Question: low risk, no personal data. No new story, because the follow-up hurdle is not met. |
| Vercel deployment logs or build artifacts from the spike era that contain spike photo URLs | None | Question: the URLs point to deleted blobs. No action. |
| Other secrets/tokens that the spike introduced (e.g. a blob read-write token) | Not listed in the story | Question for the user: confirm that no spike-only token remains. The Vercel listing in item 1 covered `SPIKE_PASSWORD` only. |
| Re-introduction of spike code | Guarded by `spike-leftovers.test.ts` (ST-078) | Covered. |

## Verdict
**accepted with remarks.** Condition: the `e2e` / `CI` runs on the branch (and later on the pull request) must finish green, because checklist item 2 is already ticked on that basis. Both were `in_progress` when I checked, and no PR exists. Everything I could verify myself (GitHub secrets, `.github/`, all five production 404s, the clean `/`, migration column types and FKs, the leftover guard test) matches the story. The Vercel env-var listing, the blob deletion and the production SQL count rest on recorded evidence that I judge sufficient. No finding passes the follow-up hurdle, so no new story is needed.

## Resolution (main session)
- Condition (item 2, `e2e` without the secret): checked on the pull request before the merge – see its checks.
- Minor (Notes order): fixed, the 2026-10-17 line is now last.
- Minor ("scripted listing" vs. manual blob evidence): skipped – the evidence line states why a prefix listing is impossible for an OIDC-only store; the wording of the criterion stays as reviewed.
- Question (other spike-only tokens): none. The full Vercel listing of 2026-10-17 has no long-lived Blob read-write token for preview or production (OIDC); the only `BLOB_READ_WRITE_TOKEN` belongs to the separate development store `store_inCVXU98UqGtH1KP`, which the local development uses and which never held the spike's data.
- Question (preview branches from before migration 0005): revisit when hosting is evaluated (ST-065) – the maintainer deleted the old preview branches on 2026-10-17 to free the Neon branch limit; a remaining branch is migrated again whenever its Git branch deploys, and previews hold test data only. Low risk, not listed branch by branch.
