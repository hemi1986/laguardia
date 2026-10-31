# Backlog

> Generated from `docs/stories/ST-*.md` – **do not edit manually**. Change the story files instead.

**Progress: 68 of 71 domain stories done** · scenarios 646 of 674

**100 stories** · In Progress: 1 · Ready: 2 · In Review: 0 · Draft: 0 · Done: 86 · Superseded: 11

Within each section: by priority, then by story ID, with dependencies pulled in front. Open questions: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)

## In Progress

| ID | Title | Type | Context | Priority | Size | Risk | Depends on |
|---|---|---|---|---|---|---|---|
| [ST-101](ST-101-welcome-page-with-the-machines-on-display.md) | Welcome page with the machines on display to report a problem | story | Collection | should | M | low | ST-100 |

## Ready

| ID | Title | Type | Context | Priority | Size | Risk | Depends on |
|---|---|---|---|---|---|---|---|
| [ST-102](ST-102-logo-on-the-welcome-page.md) | Replace or remove the museum's logo on the welcome page | story | Collection | should | L | medium | ST-100 |
| [ST-103](ST-103-legal-texts-in-the-museum-settings.md) | Privacy notice and imprint written in the museum settings | story | Collection | should | M | medium | ST-100 |

## Done

| ID | Title | Type | Context | Priority | Size | Risk | Depends on |
|---|---|---|---|---|---|---|---|
| [ST-001](ST-001-walking-skeleton-vercel-eu.md) | Walking skeleton on Vercel with EU database and object storage | spike | Repair | must | M | high | – |
| [ST-002](ST-002-photo-upload-phone-camera.md) | Take photos with a phone camera and upload them safely | spike | Repair | must | M | high | ST-001 |
| [ST-059](ST-059-ci-and-test-harness.md) | CI and test harness | tech-task | Repair | must | M | medium | ST-001 |
| [ST-003](ST-003-command-layer-and-event-journal.md) | Module structure, command layer, event journal and time convention | tech-task | Team | must | M | medium | ST-059 |
| [ST-071](ST-071-commands-load-decide-save.md) | Commands as load, decide, save | tech-task | Repair | must | M | medium | ST-003 |
| [ST-004](ST-004-team-member-login.md) | Log in as a team member | story | Team | must | M | medium | ST-003, ST-071 |
| [ST-005](ST-005-manage-team-member-accounts.md) | Manage team member accounts | story | Team | must | M | low | ST-004 |
| [ST-073](ST-073-server-action-runner.md) | Server Action runner – the one way from a form to a command | tech-task | Repair | must | L | medium | ST-071 |
| [ST-006](ST-006-create-machine-model.md) | Create a machine model | story | Collection | must | S | low | ST-004, ST-073 |
| [ST-069](ST-069-acting-person-from-the-session.md) | The acting person comes from the session in one place | tech-task | Team | must | S | medium | ST-004, ST-073, ST-005 |
| [ST-007](ST-007-register-machine.md) | Register a machine with its museum number | story | Collection | must | L | medium | ST-006, ST-071, ST-073, ST-069 |
| [ST-008](ST-008-machine-overview.md) | Machine overview with search and machine status filter | story | Collection | must | S | low | ST-007 |
| [ST-009](ST-009-machine-record.md) | Machine record with machine status history | story | Collection | must | S | low | ST-008 |
| [ST-010](ST-010-visitor-machine-page.md) | Visitor machine page in German and English | story | Repair | must | M | medium | ST-007 |
| [ST-060](ST-060-custom-domain-and-qr-address.md) | Custom domain and stable QR address scheme | tech-task | Collection | must | XS | low | ST-001 |
| [ST-011](ST-011-qr-sticker.md) | QR sticker leads visitors and team members to the machine | story | Collection | must | M | medium | ST-009, ST-010, ST-060 |
| [ST-012](ST-012-change-machine-status.md) | Change the machine status | story | Collection | must | M | low | ST-009 |
| [ST-013](ST-013-visitor-reports-problem.md) | Visitor reports a problem at the machine | story | Repair | must | M | medium | ST-010 |
| [ST-015](ST-015-team-member-reports-problem.md) | Team member reports a problem from the machine record | story | Repair | must | S | low | ST-009, ST-013 |
| [ST-017](ST-017-triage-list.md) | Triage list of untriaged problem reports | story | Repair | must | S | low | ST-013, ST-015 |
| [ST-018](ST-018-record-defect.md) | Triage – record a defect, optionally changing the machine status | story | Repair | must | L | medium | ST-012, ST-017 |
| [ST-021](ST-021-open-defects-list.md) | Open defects list and defect details | story | Repair | must | M | low | ST-008, ST-018 |
| [ST-064](ST-064-legal-pages-visitor.md) | Legal pages for the visitor pages in German and English | story | Repair | must | S | low | ST-010 |
| [ST-016](ST-016-photo-on-problem-report.md) | Add a photo to a problem report and show it to the team | story | Repair | must | L | medium | ST-002, ST-015, ST-017, ST-021, ST-064, ST-073 |
| [ST-019](ST-019-resolve-problem-on-the-spot.md) | Triage – resolve a problem on the spot | story | Repair | must | S | low | ST-017 |
| [ST-020](ST-020-dismiss-problem-report.md) | Triage – dismiss a problem report, removing spam content | story | Repair | must | M | medium | ST-017, ST-016 |
| [ST-022](ST-022-link-problem-report-to-defect.md) | Triage – link a problem report to an open defect | story | Repair | must | S | low | ST-018, ST-021 |
| [ST-023](ST-023-technician-reports-and-triages.md) | Technician reports a problem and records a defect in the same step | story | Repair | must | L | medium | ST-015, ST-016, ST-018 |
| [ST-025](ST-025-claim-defect.md) | Claim or take over a defect | story | Repair | must | S | low | ST-021 |
| [ST-028](ST-028-resolve-defect.md) | Resolve a defect with a closing note | story | Repair | must | S | low | ST-025 |
| [ST-024](ST-024-log-work.md) | Log work on a defect | story | Repair | must | S | low | ST-021, ST-028 |
| [ST-026](ST-026-assign-and-release-claims.md) | Assign a defect and release claims | story | Repair | must | S | low | ST-025 |
| [ST-027](ST-027-prioritize-defect.md) | Prioritize a defect | story | Repair | must | XS | low | ST-021, ST-028 |
| [ST-033](ST-033-repair-history-on-machine-record.md) | Repair history on the machine record | story | Repair | must | M | medium | ST-011, ST-019, ST-024 |
| [ST-040](ST-040-maintenance-plan-add-task.md) | Maintenance plan – view and add maintenance tasks | story | Maintenance | must | M | medium | ST-003, ST-006 |
| [ST-043](ST-043-due-maintenance-list.md) | Due maintenance list grouped by maintenance task | story | Maintenance | must | M | medium | ST-003, ST-007, ST-040 |
| [ST-044](ST-044-record-maintenance.md) | Record maintenance on a machine | story | Maintenance | must | S | low | ST-043 |
| [ST-048](ST-048-technician-dashboard.md) | Technician dashboard – untriaged problem reports and machines ready to return to play | story | Repair | must | S | low | ST-012, ST-017, ST-028 |
| [ST-052](ST-052-report-and-link-or-resolve-on-the-spot.md) | Report a problem and link it or resolve it on the spot in the same step | story | Repair | must | M | medium | ST-019, ST-022, ST-023 |
| [ST-056](ST-056-not-on-display-and-return-to-display.md) | Due maintenance for machines not on display and returning to display | story | Maintenance | must | S | medium | ST-012, ST-043 |
| [ST-063](ST-063-dependency-and-security-routine.md) | Dependency and security update routine | tech-task | Repair | must | XS | low | ST-059 |
| [ST-078](ST-078-remove-spike-scaffolding-code.md) | Remove the spike scaffolding code | tech-task | Repair | must | S | medium | ST-004, ST-073 |
| [ST-066](ST-066-remove-spike-scaffolding.md) | Remove the spike configuration and data | tech-task | Repair | must | S | low | ST-004, ST-007, ST-078 |
| [ST-076](ST-076-ui-foundation-shadcn-and-team-shell.md) | UI foundation – shadcn/ui, the shared phone layout and the team shell | tech-task | Repair | must | L | medium | ST-004, ST-005 |
| [ST-077](ST-077-rebuild-account-pages-with-ui-components.md) | Rebuild the account pages with the shared UI components | tech-task | Repair | must | M | medium | ST-076 |
| [ST-094](ST-094-maintenance-tasks-apply-to-chosen-machines.md) | Maintenance tasks apply to the machines a technician chooses, due at once on each | story | Maintenance | must | L | high | – |
| [ST-095](ST-095-change-the-machines-of-a-maintenance-task.md) | Change the machines of a maintenance task | story | Maintenance | must | M | medium | ST-094 |
| [ST-096](ST-096-change-a-machines-maintenance-tasks-on-its-record.md) | Change a machine's maintenance tasks from its machine record | story | Maintenance | must | M | medium | ST-095 |
| [ST-097](ST-097-choose-maintenance-tasks-when-registering-a-machine.md) | Choose a new machine's maintenance tasks when registering it | story | Maintenance | must | M | high | ST-096 |
| [ST-098](ST-098-sticker-selection-and-recording-for-several-in-groups.md) | The sticker selection and recording for several machines choose in folding groups | story | Collection | must | S | low | ST-094 |
| [ST-085](ST-085-direct-private-large-file-upload-and-abandoned-uploads.md) | Direct private large-file upload and abandoned uploads | tech-task | Collection | should | L | high | ST-001, ST-016 |
| [ST-099](ST-099-s3-compatible-object-storage.md) | S3-compatible object storage everywhere | tech-task | Collection | must | L | high | ST-085 |
| [ST-029](ST-029-put-defect-on-hold-and-resume.md) | Put a defect on hold and resume it | story | Repair | should | S | low | ST-024, ST-028, ST-033 |
| [ST-030](ST-030-reopen-defect.md) | Reopen a resolved defect, optionally changing the machine status | story | Repair | should | M | low | ST-012, ST-018, ST-028, ST-033 |
| [ST-031](ST-031-change-defect-details.md) | Change a defect's title or suitable-for-helpers mark | story | Repair | should | S | low | ST-025 |
| [ST-034](ST-034-move-machine.md) | Move a machine to a new location | story | Collection | should | XS | low | ST-009 |
| [ST-036](ST-036-correct-machine-model.md) | Correct a machine model | story | Collection | should | M | medium | ST-009, ST-010, ST-043, ST-044 |
| [ST-037](ST-037-attach-file.md) | Attach files to a machine or machine model and find them by file category | story | Collection | should | L | high | ST-001, ST-009, ST-016, ST-085 |
| [ST-039](ST-039-retire-machine.md) | Retire a machine, closing its open defects and problem reports | story | Collection | should | M | high | ST-012, ST-020, ST-024, ST-027, ST-029, ST-030, ST-033 |
| [ST-041](ST-041-maintenance-plan-change-remove-task.md) | Maintenance plan – change or remove a maintenance task | story | Maintenance | should | S | low | ST-043 |
| [ST-045](ST-045-record-maintenance-several-machines.md) | Record a maintenance task for several machines at once | story | Maintenance | should | M | medium | ST-044 |
| [ST-047](ST-047-maintenance-on-machine-record-and-overview.md) | Maintenance on the machine record | story | Maintenance | should | M | low | ST-009, ST-044, ST-056 |
| [ST-049](ST-049-helper-dashboard.md) | Helper dashboard – sections, landing after login and the empty case | story | Repair | should | S | medium | ST-025, ST-028, ST-043 |
| [ST-058](ST-058-technician-dashboard-changes-stale-claims-overdue.md) | Technician dashboard – recent changes, stale claims and overdue maintenance | story | Repair | should | M | low | ST-024, ST-026, ST-030, ST-043, ST-048 |
| [ST-086](ST-086-helper-dashboard-claimed-defects-what-changed.md) | Helper dashboard – my claimed defects and what changed on them | story | Repair | should | M | medium | ST-049, ST-026, ST-027, ST-029, ST-031 |
| [ST-087](ST-087-spike-how-a-dashboard-visit-is-recorded.md) | How a dashboard visit is recorded | spike | Team | should | XS | medium | – |
| [ST-050](ST-050-new-since-last-visit.md) | Dashboards mark what is new since the last visit | story | Repair | should | L | high | ST-058, ST-086, ST-087 |
| [ST-051](ST-051-repair-times.md) | Repair times view | story | Repair | should | M | medium | ST-022, ST-024, ST-027, ST-028, ST-030, ST-039 |
| [ST-053](ST-053-link-reopens-resolved-defect.md) | Linking a problem report to a recently resolved defect reopens it | story | Repair | should | S | medium | ST-022, ST-030, ST-052 |
| [ST-081](ST-081-find-team-member-and-act-on-one-account.md) | Act on one account on its own page, and deactivate with one question and a way back | story | Team | should | M | medium | ST-005 |
| [ST-083](ST-083-own-database-for-local-browser-tests.md) | Local browser tests run against a database of their own | tech-task | Repair | should | M | medium | – |
| [ST-088](ST-088-edit-account-on-one-page-and-deactivate-in-one-tap.md) | Edit an account on one page, and deactivate or activate it with one tap | story | Team | should | M | medium | – |
| [ST-089](ST-089-one-page-width-for-every-page.md) | One page width for every page, with fields and submit buttons across the column | story | Collection | should | S | low | – |
| [ST-090](ST-090-dark-design-with-a-switch-per-device.md) | Dark design on every page, with a switch to light per device | story | Collection | should | M | medium | – |
| [ST-091](ST-091-headings-and-buttons-say-the-job-in-one-pattern.md) | Headings, buttons and instructions say the job in one pattern | story | Collection | should | S | low | – |
| [ST-092](ST-092-sections-lists-filters-and-links-in-one-shape.md) | Sections, lists, filters and links take one shape on every page | story | Repair | should | L | medium | ST-091 |
| [ST-093](ST-093-status-history-latest-five-and-its-own-page.md) | Status history on the machine record – the latest five and a page of its own | story | Collection | should | S | low | – |
| [ST-100](ST-100-museum-settings-with-the-museum-details.md) | Museum settings with the museum's name and whether the machines are listed | story | Collection | should | M | medium | – |
| [ST-032](ST-032-photos-on-work-log-entry.md) | Add photos to a work log entry | story | Repair | could | S | low | ST-002, ST-024, ST-016 |
| [ST-035](ST-035-correct-machine-details.md) | Correct a machine's museum number or serial number | story | Collection | could | L | medium | ST-011 |
| [ST-038](ST-038-remove-file.md) | Remove a file | story | Collection | could | S | low | ST-037 |
| [ST-054](ST-054-camera-photo-as-file.md) | Attach a camera photo as a file of a machine | story | Collection | could | S | low | ST-002, ST-037, ST-016 |
| [ST-055](ST-055-retired-machines-in-views.md) | Retired machines in the overview, search and visitor page | story | Collection | could | S | low | ST-039 |
| [ST-057](ST-057-overdue-count-in-machine-overview.md) | Number of overdue maintenance tasks in the machine overview | story | Maintenance | could | XS | low | ST-008, ST-043 |
| [ST-070](ST-070-content-security-policy-for-scripts.md) | Full Content Security Policy for scripts | tech-task | Repair | could | M | medium | ST-003, ST-013, ST-085 |
| [ST-084](ST-084-report-forms-say-photo-must-be-chosen-again.md) | Report forms say that the photo must be chosen again after a rejection | story | Repair | could | XS | low | ST-013, ST-015, ST-016, ST-023 |

## Superseded

| ID | Title | Type | Context | Priority | Size | Risk | Depends on |
|---|---|---|---|---|---|---|---|
| [ST-014](ST-014-spam-protection-visitor-reports.md) | Spam protection for visitor problem reports – only if spam occurs | story | Repair | wont | M | medium | ST-013 |
| [ST-065](ST-065-move-hosting-to-museum-pro-team.md) | Move hosting to the museum's Vercel Pro team | tech-task | Repair | wont | S | medium | ST-001 |
| [ST-061](ST-061-environments-and-operations.md) | Environments and operations | tech-task | Repair | wont | M | medium | ST-001, ST-065 (superseded) |
| [ST-062](ST-062-backup-and-restore.md) | Backup and restore of database and object storage | tech-task | Repair | wont | M | medium | ST-061 (superseded) |
| [ST-042](ST-042-go-live-readiness.md) | Go-live readiness checklist incl. the initial maintenance plan | tech-task | Collection | wont | M | low | ST-005, ST-011, ST-040, ST-043, ST-061 (superseded), ST-062 (superseded), ST-063, ST-064, ST-065 (superseded), ST-070, ST-078 |
| [ST-046](ST-046-report-finding-during-maintenance.md) | Report a finding during maintenance | story | Maintenance | wont | XS | low | ST-015, ST-044 |
| [ST-067](ST-067-test-support-only-in-tests.md) | Test support is only imported by tests | tech-task | Repair | wont | XS | low | ST-003 |
| [ST-068](ST-068-browser-test-real-visitor-report-flow.md) | Browser test of the real visitor problem report flow | tech-task | Repair | wont | M | medium | ST-007, ST-013, ST-059 |
| [ST-079](ST-079-event-catalogue-per-module.md) | The event catalogue per module | tech-task | Repair | wont | – | – | ST-018 |
| [ST-080](ST-080-pre-runner-forms-onto-house-pattern.md) | Move the four pre-runner forms onto the house pattern | tech-task | Team | wont | S | low | ST-007 |
| [ST-082](ST-082-deactivation-asks-once-and-can-be-undone.md) | Deactivating a team member asks once, and can be undone | story | Team | wont | – | – | ST-081 |
