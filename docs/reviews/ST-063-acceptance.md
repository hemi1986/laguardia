# Acceptance – ST-063: Dependency and security update routine
Date: 2026-10-17 · Tests run: `check-scenarios.ts ST-063` → traceability OK (tech task, 0 scenarios; no code, no tests); settings verified with `gh api` · Preview: none (light lane, no code)

## Checklist (tech task)
| Item | Evidence found | Result |
|---|---|---|
| Update PRs run through CI before merge | `.github/dependabot.yml` (weekly, 3 ecosystems); branch protection on `main`: contexts `verify`, `e2e`, `enforce_admins` true (confirmed via API); PR #73 checks `verify` pass, `e2e` pass | OK |
| DoD states 48 h deadline | ST-059 DoD line: "Critical Next.js / React security advisories are applied within 48 hours"; also in acceptance-tester step 5 (diff confirmed) | OK |
| Advisories delivered to the maintainer | `vulnerability-alerts` → 204 (on); `automated-security-fixes` → enabled, not paused. **But the story says "0 open alerts"; the API lists 5 open alerts** (see remarks) | OK, with a wrong claim in the story |
| Routine documented in a few lines | `docs/operations/updates-and-security.md` (5 bullets) | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px, list performance, journal, message catalogs | no (no UI, no command) | – | n/a |
| No personal data in logs | no | – | n/a |
| Critical Next.js / React advisories within 48 h | yes (it is the deliverable) | documented; currently no open Next.js / React alert | OK |

## Accuracy of the routine document
| Claim | Check | Result |
|---|---|---|
| Grouped minor/patch PRs every Monday for app, `.claude/` and Actions | npm ecosystems: yes (`ignore` majors, groups minor/patch). The `github-actions` entry has group `patterns: ["*"]` without `update-types` and no major `ignore` – so Actions PRs also include **major** bumps | Inaccurate for Actions |
| "Major versions are not opened by the weekly round" | Same: not true for GitHub Actions | Inaccurate for Actions |
| Security updates open fix PRs outside the weekly schedule | Matches GitHub behaviour (PR #82 source-map-js is such a PR, opened today) | OK |
| Security updates not affected by `ignore`/limits (yml comment) | Plausible per GitHub docs (security updates use their own limit); cannot be confirmed from the repo | Unconfirmed |
| Alerts reach the maintainer via personal notification settings | Cannot be verified from the repo (account setting); document correctly tells where to check | Unconfirmed |
| Maintainer merges "within the week" | Process promise, not checkable | – |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| 5 open Dependabot alerts now: 2x critical + 1 medium `handlebars` (dev, fix 4.7.10), high `source-map-js` (runtime, fix PR #82 open), medium `esbuild` (dev). "Critical" non-Next.js/React alerts fall under "next weekly round", but critical dev-only alerts have no stated deadline | Doc: other alerts "with the next weekly round" – consistent, but the first round has not cleared them | Fix now: correct "0 open alerts" in the story to the real state or re-check after PR #82; triage the handlebars/esbuild alerts (likely lockfile-only update) |
| Alert on a dev-only dependency with critical severity (handlebars) vs. the 48 h rule limited to Next.js / React | Rule is explicit about Next.js / React only | Question: should "critical, runtime-reachable" also get a deadline? |
| Dependabot cannot fix (no patched version) | Doc covers manual `security-<package>` branch | OK |
| Who acts when the maintainer is on holiday (48 h) | Not in any rule | Question |
| Open-PR limit 2 may be consumed by minor updates while a security PR waits | Security updates have a separate limit (GitHub behaviour, unconfirmed here) | Question |

## Conventions and domain language (minors)
- Documentation-only diff; no code, events, UI or tests – the conventions in `engineering-conventions` do not apply beyond English language, which is respected. Domain terms: none misused.
- `docs/stories/BACKLOG.md` change is the generated hook output (In Progress 1) – fine.
- Minor: `docs/operations/` is a new folder not listed in the CLAUDE.md Sources of Truth table (acceptable; mention in ST-061 if operations docs grow).
- Minor: the Actions inaccuracy above also contradicts the sentence in the story/doc "Major versions are taken deliberately".

## Follow-up hurdle
No finding qualifies for a new story: all are fixable within the hour in this story (doc wording, story text) and none blocks a named story.

## Verdict
**accepted with remarks.** Required before merge (small): (1) correct "0 open alerts" in the ST-063 checklist item (5 are open: handlebars x3, source-map-js, esbuild); (2) fix the doc's statements about major versions / grouping so they say Actions PRs are not restricted to minor/patch, or add `ignore` for majors and `update-types` to the Actions group in `dependabot.yml`.

## Resolution (main session)
- Gap 1 (open alerts): the story's evidence now names the 5 alerts of the first scan. `handlebars` fixed in this story (`overrides` to 4.7.10 – `eslint-plugin-boundaries` pins 4.7.9 exactly, so Dependabot can't); `source-map-js` by Dependabot pull request #82; `esbuild` 0.18 (development only, via `drizzle-kit` → `@esbuild-kit`; the advisory concerns esbuild's dev server, which the project never runs) left to the maintainer to dismiss or override.
- Gap 2 (GitHub Actions majors): the routine document now says the Actions round includes majors – kept that way on purpose, the workflows follow the current major of each action.
- Gap 3 (unconfirmed claims): the routine document no longer relies on how `ignore` treats security updates; it covers the manual path instead. The notification setting is the maintainer's step and is named as such.
- Minor (`docs/operations/` not in the sources of truth): added to `CLAUDE.md`.
- Questions (deadline for other runtime alerts, cover for the maintainer's absence): passed to the user; the story asks only for the Next.js / React deadline.
