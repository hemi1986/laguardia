# Backlog

> Generated from `docs/stories/ST-*.md` – **do not edit manually**. Change the story files instead.

**51 stories** · In Progress: 0 · Ready: 0 · In Review: 51 · Draft: 0 · Done: 0

Within each section: ordered by priority, dependencies first. Open questions: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)

## In Review

| ID | Title | Type | Context | Priority | Size | Risk | Depends on |
|---|---|---|---|---|---|---|---|
| [ST-001](ST-001-walking-skeleton-vercel-eu.md) | Walking skeleton on Vercel with EU database and object storage | spike | Repair | should | – | – | – |
| [ST-002](ST-002-photo-upload-phone-camera.md) | Take photos with a phone camera and upload them safely | spike | Repair | should | – | – | ST-001 (review) |
| [ST-003](ST-003-command-layer-and-event-journal.md) | Module structure, command layer and event journal | tech-task | Team | should | – | – | ST-001 (review) |
| [ST-004](ST-004-team-member-login.md) | Log in as a team member | story | Team | should | – | – | ST-003 (review) |
| [ST-005](ST-005-manage-team-member-accounts.md) | Manage team member accounts | story | Team | should | – | – | ST-004 (review) |
| [ST-006](ST-006-create-machine-model.md) | Create a machine model | story | Collection | should | – | – | ST-004 (review) |
| [ST-007](ST-007-register-machine.md) | Register a machine with its museum number | story | Collection | should | – | – | ST-006 (review) |
| [ST-008](ST-008-machine-overview.md) | Machine overview with search | story | Collection | should | – | – | ST-007 (review) |
| [ST-009](ST-009-machine-record.md) | Machine record with machine status history | story | Collection | should | – | – | ST-008 (review) |
| [ST-010](ST-010-visitor-machine-page.md) | Visitor machine page in German and English | story | Repair | should | – | – | ST-007 (review) |
| [ST-011](ST-011-qr-sticker.md) | QR sticker leads visitors and team members to the machine | story | Collection | should | – | – | ST-009 (review), ST-010 (review) |
| [ST-012](ST-012-change-machine-status.md) | Change the machine status | story | Collection | should | – | – | ST-009 (review) |
| [ST-013](ST-013-visitor-reports-problem.md) | Visitor reports a problem at the machine | story | Repair | should | – | – | ST-010 (review) |
| [ST-014](ST-014-spam-protection-visitor-reports.md) | Spam protection for visitor problem reports | story | Repair | should | – | – | ST-013 (review) |
| [ST-015](ST-015-team-member-reports-problem.md) | Team member reports a problem from the machine record | story | Repair | should | – | – | ST-009 (review), ST-013 (review) |
| [ST-016](ST-016-photo-on-problem-report.md) | Add a photo to a problem report | story | Repair | should | – | – | ST-002 (review), ST-014 (review), ST-015 (review) |
| [ST-017](ST-017-triage-list.md) | Triage list of untriaged problem reports | story | Repair | should | – | – | ST-013 (review), ST-015 (review) |
| [ST-018](ST-018-record-defect.md) | Triage – record a defect, optionally changing the machine status | story | Repair | should | – | – | ST-012 (review), ST-017 (review) |
| [ST-019](ST-019-resolve-problem-on-the-spot.md) | Triage – resolve a problem on the spot | story | Repair | should | – | – | ST-017 (review) |
| [ST-020](ST-020-dismiss-problem-report.md) | Triage – dismiss a problem report, removing spam content | story | Repair | should | – | – | ST-017 (review) |
| [ST-021](ST-021-open-defects-list.md) | Open defects list and defect details | story | Repair | should | – | – | ST-008 (review), ST-018 (review) |
| [ST-022](ST-022-link-problem-report-to-defect.md) | Triage – link a problem report to an open defect | story | Repair | should | – | – | ST-018 (review) |
| [ST-023](ST-023-technician-reports-and-triages.md) | Report a problem and triage it in the same step | story | Repair | should | – | – | ST-015 (review), ST-018 (review), ST-019 (review), ST-022 (review) |
| [ST-024](ST-024-log-work.md) | Log work on a defect | story | Repair | should | – | – | ST-021 (review) |
| [ST-025](ST-025-claim-defect.md) | Claim or take over a defect | story | Repair | should | – | – | ST-021 (review) |
| [ST-026](ST-026-assign-and-release-claims.md) | Assign a defect and release claims | story | Repair | should | – | – | ST-025 (review) |
| [ST-027](ST-027-prioritize-defect.md) | Prioritize a defect | story | Repair | should | – | – | ST-021 (review) |
| [ST-028](ST-028-resolve-defect.md) | Resolve a defect with a closing note | story | Repair | should | – | – | ST-025 (review) |
| [ST-029](ST-029-put-defect-on-hold-and-resume.md) | Put a defect on hold and resume it | story | Repair | should | – | – | ST-028 (review) |
| [ST-030](ST-030-reopen-defect.md) | Reopen a resolved defect, also by linking a problem report | story | Repair | should | – | – | ST-022 (review), ST-028 (review) |
| [ST-031](ST-031-change-defect-details.md) | Change a defect's title or suitable-for-helpers mark | story | Repair | should | – | – | ST-025 (review) |
| [ST-032](ST-032-photos-on-work-log-entry.md) | Add photos to a work log entry | story | Repair | should | – | – | ST-002 (review), ST-024 (review) |
| [ST-033](ST-033-repair-history-on-machine-record.md) | Repair history on the machine record | story | Repair | should | – | – | ST-011 (review), ST-019 (review), ST-024 (review), ST-029 (review), ST-030 (review) |
| [ST-034](ST-034-move-machine.md) | Move a machine to a new location | story | Collection | should | – | – | ST-009 (review) |
| [ST-035](ST-035-correct-machine-details.md) | Correct a machine's museum number or serial number | story | Collection | should | – | – | ST-011 (review) |
| [ST-036](ST-036-correct-machine-model.md) | Correct a machine model | story | Collection | should | – | – | ST-009 (review) |
| [ST-037](ST-037-attach-file.md) | Attach files to a machine or machine model and find them by file category | story | Collection | should | – | – | ST-002 (review), ST-009 (review) |
| [ST-038](ST-038-remove-file.md) | Remove a file | story | Collection | should | – | – | ST-037 (review) |
| [ST-039](ST-039-retire-machine.md) | Retire a machine, closing its open defects and problem reports | story | Collection | should | – | – | ST-012 (review), ST-020 (review), ST-024 (review), ST-027 (review), ST-030 (review) |
| [ST-040](ST-040-maintenance-plan-add-task.md) | Maintenance plan – view and add maintenance tasks | story | Maintenance | should | – | – | ST-006 (review) |
| [ST-043](ST-043-due-maintenance-list.md) | Due maintenance list grouped by maintenance task | story | Maintenance | should | – | – | ST-012 (review), ST-040 (review) |
| [ST-041](ST-041-maintenance-plan-change-remove-task.md) | Maintenance plan – change or remove a maintenance task | story | Maintenance | should | – | – | ST-043 (review) |
| [ST-042](ST-042-seed-initial-maintenance-plan.md) | Seed the initial maintenance plan | tech-task | Maintenance | should | – | – | ST-043 (review) |
| [ST-044](ST-044-record-maintenance.md) | Record maintenance on a machine | story | Maintenance | should | – | – | ST-043 (review) |
| [ST-045](ST-045-record-maintenance-several-machines.md) | Record a maintenance task for several machines at once | story | Maintenance | should | – | – | ST-044 (review) |
| [ST-046](ST-046-report-finding-during-maintenance.md) | Report a finding during maintenance | story | Maintenance | should | – | – | ST-015 (review), ST-044 (review) |
| [ST-047](ST-047-maintenance-on-machine-record-and-overview.md) | Maintenance on the machine record and in the machine overview | story | Maintenance | should | – | – | ST-009 (review), ST-044 (review) |
| [ST-048](ST-048-technician-dashboard.md) | Technician dashboard | story | Repair | should | – | – | ST-017 (review), ST-026 (review), ST-030 (review), ST-043 (review) |
| [ST-049](ST-049-helper-dashboard.md) | Helper dashboard | story | Repair | should | – | – | ST-026 (review), ST-030 (review), ST-031 (review), ST-043 (review) |
| [ST-050](ST-050-new-since-last-visit.md) | Dashboards highlight what is new since the last visit | story | Repair | should | – | – | ST-048 (review), ST-049 (review) |
| [ST-051](ST-051-repair-times.md) | Repair times view | story | Repair | should | – | – | ST-024 (review), ST-039 (review) |
