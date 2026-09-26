---
id: ST-061
title: Environments and operations
type: tech-task
context: BC-Repair
priority: must
size: S
risk: medium
events: []
depends_on: [ST-001]
labels: [mvp, foundation]
status: ready
---

## Task
Separate the preview and production environments and make problems in production visible without anyone having to look (story review 2026-09-26, TT-D). Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

- Separate database and object storage for preview deployments and for production; preview deployments never see production data.
- Secrets per environment; none in the repository.
- Error monitoring for production, with no personal data (no problem report text, no photos, no names) in error reports or logs.
- An uptime check on the visitor machine page and the login page.

## Acceptance Criteria
- [ ] A preview deployment uses its own database and storage; a change there does not appear in production.
- [ ] Secrets differ per environment and are not stored in the repository.
- [ ] A deliberately raised error in production appears in the error monitoring within 5 minutes.
- [ ] Error reports and logs contain no problem report descriptions, photos or team member names (checked on a sample).
- [ ] The uptime check alerts the maintainer (by whatever channel the monitoring offers) when the visitor machine page is unreachable for 5 minutes.

## Out of Scope
- Backups (ST-062)
- Notifications to team members (non-goal – the alert only goes to the maintainer's monitoring account)

## Open Questions
- none
