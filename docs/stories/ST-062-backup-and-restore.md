---
id: ST-062
title: Backup and restore of database and object storage
type: tech-task
context: BC-Repair
priority: must
size: S
risk: medium
events: []
depends_on: [ST-061]
labels: [mvp, foundation]
status: ready
---

## Task
Make sure the repair history, files and photos survive a mistake or a provider failure (story review 2026-09-26, TT-E, decision D10). Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

- Use the database provider's automatic backups and do one real test restore.
- Object storage (files and photos) gets a periodic backup, since the provider does not keep deleted content.
- Written recovery steps that the single maintainer can follow.

## Acceptance Criteria
- [ ] Automatic database backups are enabled for production; their retention is documented.
- [ ] One test restore of the production database into a separate environment has been done and its duration documented.
- [ ] Object storage is backed up at least weekly to a separate location in the EU.
- [ ] One file and one photo have been restored from the storage backup.
- [ ] The recovery steps for database and storage are written down in the repository.

## Out of Scope
- Restoring removed files on request (removal is permanent, ST-038)

## Open Questions
- none
