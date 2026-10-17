---
id: ST-063
title: Dependency and security update routine
type: tech-task
context: BC-Repair
priority: must
size: XS
risk: low
events: []
depends_on: [ST-059]
labels: [mvp, foundation]
status: in-progress
---

## Task
Turn the "upgrade and security discipline" of `docs/adr/0001-tech-stack.md` into a written routine (story review 2026-09-26, TT-F). The visitor pages are public, so critical advisories must be applied quickly. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

## Acceptance Criteria
- [x] Automated dependency update pull requests run through CI (ST-059) before they can be merged. – `.github/dependabot.yml` (weekly, since ST-003); branch protection on `main` requires `verify` and `e2e`, enforced for admins; e.g. Dependabot PR #73 passed both before its merge.
- [x] The Definition of Done in the repository states the patch deadline: critical Next.js / React advisories are applied within 48 hours. – DoD in `docs/stories/ST-059-ci-and-test-harness.md`; also in the acceptance-tester checklist (`.claude/agents/acceptance-tester.md`).
- [x] Security advisories for the used frameworks are delivered to the maintainer (e.g. repository security alerts are switched on). – Dependabot alerts and Dependabot security updates switched on for `hemi1986/laguardia` (2026-10-17, GitHub API: `vulnerability-alerts` 204, `automated-security-fixes` enabled); 0 open alerts.
- [x] The routine is documented in the repository in a few lines. – `docs/operations/updates-and-security.md`.

## Out of Scope
- Penetration testing

## Open Questions
- none
