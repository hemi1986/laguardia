---
id: ST-053
title: Linking a problem report to a recently resolved defect reopens it
type: story
context: BC-Repair
priority: should
size: S
risk: medium
events: [EVT-ProblemReportLinkedToDefect, EVT-DefectReopened, EVT-MachineStatusChanged]
depends_on: [ST-022, ST-030, ST-052]
labels: [mvp, defect-work, triage, ui]
status: in-progress
---

## Story
As a technician, I want to link a new problem report to a recently resolved defect of the same machine, which reopens it, so that a fault that comes back soon after a repair continues its history instead of becoming a duplicate defect.

## Context
Second part of the split of ST-030 (story review 2026-09-26).
- Automatic policy `POL-LinkReopensResolvedDefect`: linking a problem report to a resolved defect reopens it, with the linked problem report as reason; the link and the reopening are stored together.
- Linking happens on the form page „Mit Defekt verknüpfen“ of a problem report (ST-022), not in the triage list itself. That page offers the machine's open **and recently resolved** defects; "recently resolved" means resolved within the last 30 days (Europe/Berlin calendar days, ST-003).
- Manual policy `POL-DefectMayChangeMachineStatus`: the technician may set the machine status in the same step as the link; the status history reason refers to the reopened defect.
- **Only a stricter machine status** (user, 2026-10-17, backlog grooming section 9 item 3): the rule of `CMD-RecordDefect` applies here too – Playable → Limited or Out of order; Limited → Out of order; a machine that is Out of order or Not on display keeps its status, and no status choice is offered.
- All rules of `CMD-LinkProblemReportToDefect` (ST-022) and `CMD-ReopenDefect` (ST-030) apply. A defect resolved more than 30 days ago or closed on retirement cannot be linked.

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G21):
- The problem report's page offers „Mit Defekt verknüpfen“ when the machine has **open or recently resolved** defects (G21's condition, widened by this story).
- On „Mit Defekt verknüpfen“ the open defects come first, then the recently resolved ones, each marked with how long ago it was resolved („behoben vor 3 Tagen“); none preselected (ST-022).
- The status choice follows ST-018's form: the current status in words, „Status nicht ändern“ preselected plus only the stricter statuses.
- The confirmation is ST-022's, followed by „ Der Defekt ist wieder offen.“ when the linked defect was resolved.
- ST-052's page `/melden/mit-defekt-verknuepfen` (report and link in the same step) offers the same list – open defects, then recently resolved ones – and „Mit Defekt verknüpfen“ on its choice page appears under the same condition. ST-052 is done; this story extends its page.

Notes for the test plan (lead dev, backlog grooming 2026-10-17): linking that reopens runs one command inside another (`runs` nested) – check in the test plan that the link, the reopening and the status change are stored in one transaction.

## Acceptance Criteria

Scenario: Recently resolved defects are offered for linking
  Given the defect "Left flipper weak" of "LG-042" was resolved 3 days ago
  And a problem report for "LG-042" is untriaged
  When a technician opens "Mit Defekt verknüpfen" for that problem report
  Then "Left flipper weak" is offered after the open defects, marked as resolved 3 days ago

Scenario: Defects resolved longer ago are not offered for linking
  Given the defect "Coin door jammed" of "LG-042" was resolved 31 days ago
  And a problem report for "LG-042" is untriaged
  When a technician opens "Mit Defekt verknüpfen" for that problem report
  Then "Coin door jammed" is not offered for linking

Scenario: Linking is offered when the machine only has a recently resolved defect
  Given "LG-042" has no open defect and the defect "Left flipper weak" was resolved 3 days ago
  And a problem report for "LG-042" is untriaged
  When a technician opens that problem report
  Then linking to a defect is offered

Scenario: Linking a problem report to a resolved defect reopens it
  Given the defect "Left flipper weak" of "LG-042" is resolved
  When a technician links an untriaged problem report of "LG-042" to it
  Then the problem report is triaged with the outcome linked
  And "Left flipper weak" is reopened with that problem report as reason
  And it is open, not on hold and not claimed
  And the confirmation says that the defect is open again

Scenario: Link and machine status change in the same step
  Given "LG-042" is Playable and "Left flipper weak" is resolved
  When a technician links an untriaged problem report of "LG-042" to "Left flipper weak" and sets "LG-042" to Out of order in the same step
  Then "Left flipper weak" is open
  And "LG-042" is Out of order with a status history entry referring to "Left flipper weak"

Scenario: Only a stricter machine status when linking reopens
  Given "LG-042" is Out of order and "Left flipper weak" is resolved
  When a technician links an untriaged problem report of "LG-042" to "Left flipper weak" and tries to set "LG-042" to Limited in the same step
  Then the action is rejected
  And "Left flipper weak" stays resolved
  And "LG-042" is still Out of order

Scenario: Reporting and linking in the same step offers recently resolved defects
  Given the defect "Left flipper weak" of "LG-042" was resolved 3 days ago
  When a technician reports a problem for "LG-042" and links it to "Left flipper weak" in the same step
  Then the problem report is stored, triaged with the outcome linked
  And "Left flipper weak" is reopened with that problem report as reason

Scenario: Link fails, nothing is reopened
  Given "Left flipper weak" of "LG-042" is resolved
  And another technician triaged the problem report a moment ago
  When a technician links that problem report to "Left flipper weak"
  Then the action is rejected
  And "Left flipper weak" stays resolved

## Out of Scope
- Reopening without a problem report (ST-030)

## Open Questions
- none
