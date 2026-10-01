---
id: ST-018
title: Triage – record a defect, optionally changing the machine status
type: story
context: BC-Repair
priority: must
size: L
risk: medium
events: [EVT-DefectRecorded, EVT-MachineStatusChanged]
depends_on: [ST-012, ST-017]
labels: [mvp, triage, ui]
status: review
---

## Story
As a technician, I want to turn a problem report into a defect with a title, priority and suitable-for-helpers mark – and set the machine to Limited or Out of order in the same step – so that confirmed faults are tracked until they are resolved and the machine status is right immediately.

## Context
Command `CMD-RecordDefect` (technicians only), handled by the problem report (HS-16): in one step it checks the problem report is still untriaged, marks it triaged with the outcome *defect recorded* and creates the defect.
Rules and invariants:
- The problem report has not been triaged yet; if another technician triaged it meanwhile, the command is rejected ("already triaged by X") and nothing is created.
- Title is required and understandable for visitors – it is shown untranslated on the visitor machine page.
- Priority defaults to *normal* (*high*, *normal*, *low*).
- One problem report leads to one defect (HS-4).
- Manual policy `POL-DefectMayChangeMachineStatus` / HS-3: in the same step the technician may set the machine to *Limited* or *Out of order* – two events, one action, one transaction. Only *Limited* and *Out of order* are offered in this step. The status history entry's reason is a reference to the new defect (its title); no extra input is needed. If the status change is rejected (e.g. the machine was retired meanwhile), the defect is not recorded either and the problem report stays untriaged.
- The race between two technicians is covered by a real concurrency test (two transactions on the same problem report version), not only by a sequential test.

**Foundation (moved from ST-074 on 2026-09-27).** HS-3 is the first case of one command running another: the status change belongs to `AGG-Machine` in the collection module, and a command belongs to one aggregate (architecture review 2026-09-27, Q12, ST-071). This story therefore builds `context.run(command, input)` (architecture review 2026-09-27, decision **Q6**): it runs another command – also another module's, imported through its `index.ts` – in the same transaction, as the same acting person, including that command's authorization check. A rejection of the inner command rejects everything; the inner command's error type becomes part of the outer command's result type. `context.runAsSystem` stays for automatic policies.

## Acceptance Criteria

Scenario: Technician records a defect
  Given the visitor problem report "Left flipper barely moves" for "LG-042" is untriaged
  When a technician records a defect from it with the title "Left flipper weak", suitable for helpers not set, and no priority chosen
  Then the defect "Left flipper weak" exists for "LG-042" with the priority normal
  And the problem report is triaged with the outcome defect recorded, referring to that defect
  And the problem report no longer appears in the triage list

Scenario: Visitors see the title of the new defect
  Given the defect "Left flipper weak" was recorded for "LG-042"
  When a visitor opens the visitor machine page of "LG-042"
  Then "Left flipper weak" is shown as an open defect, untranslated
  And the number of untriaged problem reports no longer counts that problem report

Scenario: Machine status is changed in the same step
  Given the machine "LG-042" is Playable
  And a problem report for "LG-042" is untriaged
  When a technician records the defect "Coil burnt, ball not ejected" with the priority high and sets the machine to Out of order in the same step
  Then the defect exists with the priority high
  And "LG-042" is Out of order with a status history entry by that technician
  And the reason of that entry refers to the defect "Coil burnt, ball not ejected"
  And the technician did not have to enter a separate reason

Scenario: Only Limited or Out of order in the same step
  Given a problem report for "LG-042" is untriaged
  When a technician records a defect from it
  Then the machine statuses offered in the same step are only Limited and Out of order

Scenario: Rejected status change rolls back the defect
  Given a problem report for "LG-042" is untriaged
  And "LG-042" was retired a moment ago
  When a technician records a defect from that problem report and sets "LG-042" to Out of order in the same step
  Then neither the defect nor the status change is stored

Scenario: Title is required
  When a technician records a defect from an untriaged problem report without a title
  Then nothing is recorded
  And the problem report stays untriaged

Scenario: Two technicians triage the same problem report
  Given Tom and Eva have the same untriaged problem report open
  When both record a defect from it at the same time and Tom's transaction commits first
  Then Eva's action is rejected with the message that the problem report was already triaged by Tom
  And only Tom's defect exists

Scenario: Helpers cannot record defects
  Given a helper is logged in
  When the helper tries to record a defect from a problem report
  Then the action is rejected

Scenario: A rejected defect keeps what was typed
  Given a technician records a defect from an untriaged problem report with the priority high, the suitable-for-helpers mark set, the machine status Out of order and no title
  When they submit it
  Then nothing is recorded and the problem report stays untriaged
  And the reason is shown at the form, with the title marked
  And the priority, the mark and the machine status they chose are still chosen

Scenario: After recording, the technician sees the new defect
  When a technician records the defect "Left flipper weak" from a problem report of "LG-042"
  Then the defect "Left flipper weak" is shown with its machine
  And a confirmation names "Left flipper weak" and "LG-042"

### Foundation (moved from ST-074 on 2026-09-27 – architecture review Q6)
- [ ] `context.run` runs an inner command in the same transaction as the same acting person: its events are journaled with that person; an inner command the person is not allowed to run makes the whole command `not-authorized`; an inner rejection rejects the whole command and stores nothing (integration tests with test stand-ins).
- [ ] The inner command's error type is part of the outer command's result type – shown by a type test (`expectTypeOf` or `@ts-expect-error`) that fails `npm run verify` if the inner error is missing.
- [ ] `context.runAsSystem` still runs policies journaled as the system; the existing policy tests stay green.
- [ ] Recording a defect with a status change runs `CMD-ChangeMachineStatus` through `context.run`, imported through `src/modules/collection/index.ts`.
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "Writing a command" – `context.run`.

## Out of Scope
- Changing priority or details later (ST-027, ST-031)
- Linking to an existing defect (ST-022)

## Open Questions
- [OPEN] Where does a successful recording land? The grooming scenario says the technician sees the new defect with its machine, but the defect's own page is ST-021, which depends on this story – so no defect page exists yet. Options: (a) land back on the triage list with the confirmation naming the defect and the machine, and move "the defect is shown" to ST-021; (b) build a minimal defect page here, which grows an already L story. Recommendation: (a). Same question as ST-007 (registration landing on the machine record) – one answer should cover both.
