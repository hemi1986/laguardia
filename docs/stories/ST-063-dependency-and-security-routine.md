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
status: ready
---

## Task
Turn the "upgrade and security discipline" of `docs/adr/0001-tech-stack.md` into a written routine (story review 2026-09-26, TT-F). The visitor pages are public, so critical advisories must be applied quickly. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

## Acceptance Criteria
- [ ] Automated dependency update pull requests run through CI (ST-059) before they can be merged.
- [ ] The Definition of Done in the repository states the patch deadline: critical Next.js / React advisories are applied within 48 hours.
- [ ] Security advisories for the used frameworks are delivered to the maintainer (e.g. repository security alerts are switched on).
- [ ] The routine is documented in the repository in a few lines.

## Out of Scope
- Penetration testing

## Open Questions
- none
