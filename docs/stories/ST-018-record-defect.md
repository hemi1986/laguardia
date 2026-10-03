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
status: in-progress
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
- Manual policy `POL-DefectMayChangeMachineStatus` / HS-3: in the same step the technician may make the machine status stricter – two events, one action, one transaction. Only a stricter status is offered (story review 2026-10-03, decision 3): *Playable* → *Limited* or *Out of order*; *Limited* → *Out of order*; *Out of order* or *Not on display* → no status choice, and the form says so in words. The status history entry's reason is a reference to the new defect (its title); the form has no reason field. If the status change is rejected (e.g. the machine was retired meanwhile), the defect is not recorded either and the problem report is not triaged by this action.
- The race between two technicians is covered by a real concurrency test (two transactions on the same problem report version), not only by a sequential test.
- After recording, the technician lands back on the triage list with a confirmation naming the defect and the machine (G2a, G3). The defect's own page does not exist yet when this story ships – it is built by ST-021, which is where the assertion "the defect is shown with its machine" lives (user's decision, backlog grooming 2026-10-01).
- Its triage outcome is offered on the problem report's own page, which ST-017 builds and owns (G18); the assertion that the outcome is offered there – and, for technician-only outcomes, not to helpers – belongs to this story (moved from ST-017, user 2026-10-03).
- Page layout (story review 2026-10-03, decisions 1 and 2; G2a, G3, G8, G21): the problem report's page (ST-017) offers, in a section „Sichten“, only the outcomes the person may choose, in this order: „Mit Defekt verknüpfen“ (only when the machine has open defects), „Defekt erfassen“, „Direkt behoben“, „Meldung verwerfen“. Each is a button to its own form page (heading „<Outcome> · LG-042“) that repeats the machine and the description and has „Zurück zur Meldung“; a rejection stays on that form page and keeps what was typed; success lands on the triage list with a confirmation naming the machine. No outcome is offered on a triaged problem report. Only dismissing as spam asks first; every other outcome records a fact and asks nothing.
- The form „Defekt erfassen“ (story review 2026-10-03): it shows the machine's current status in words; the status choice is „Status nicht ändern“ (preselected) plus only the stricter statuses above („Eingeschränkt“, „Außer Betrieb“). Priority options „hoch“, „normal“ (preselected), „niedrig“; „Für Helfer:innen geeignet“ is not set by default; the title is empty, with the hint „Wird Besucher:innen am Gerät angezeigt – kurz und verständlich.“
- Confirmation: „Defekt „<title>“ an LG-042 erfasst.“, followed by „ LG-042 ist jetzt Außer Betrieb.“ (the new status) when the status was changed in the same step.
- Rejections, shown at the form: „Bitte einen Titel angeben.“; „<Name> hat diese Meldung schon gesichtet. Zurück zur Sichtung.“ (back to the triage list); „LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“

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
  And the form has no reason field

Scenario: Only Limited or Out of order in the same step
  Given the machine "LG-042" is Playable
  And a problem report for "LG-042" is untriaged
  When a technician records a defect from it
  Then besides not changing the status, only Limited and Out of order are offered in the same step
  And not changing the status is preselected

Scenario: The machine's current status is shown when recording a defect
  Given the machine "LG-042" is Limited
  And a problem report for "LG-042" is untriaged
  When a technician records a defect from it
  Then the form says that "LG-042" is currently Limited
  And besides not changing the status, only Out of order is offered

Scenario: No stricter status, no status choice
  Given the machine "LG-042" is Out of order
  And a problem report for "LG-042" is untriaged
  When a technician records a defect from it
  Then no machine status can be chosen in the same step
  And the form says that "LG-042" is already Out of order and its status stays

Scenario: Rejected status change rolls back the defect
  Given a problem report for "LG-042" is untriaged
  And "LG-042" was retired a moment ago
  When a technician records a defect from that problem report and sets "LG-042" to Out of order in the same step
  Then neither the defect nor the status change is stored
  And the problem report is not triaged by this action
  And the technician stays at the form and is told that "LG-042" is retired by now and nothing was saved

Scenario: Title is required
  When a technician records a defect from an untriaged problem report without a title
  Then nothing is recorded
  And the problem report stays untriaged

Scenario: Two technicians triage the same problem report
  Given Tom and Eva have the same untriaged problem report open
  When both record a defect from it at the same time and Tom's transaction commits first
  Then Eva's action is rejected with the message that the problem report was already triaged by Tom
  And only Tom's defect exists

Scenario: Recording a defect is offered on the problem report's page
  Given a problem report for "LG-042" is untriaged
  When a technician opens that problem report from the triage list
  Then recording a defect from it is offered there

Scenario: Helpers cannot record defects
  Given a helper is logged in
  And a problem report for "LG-042" is untriaged
  When the helper opens that problem report from the triage list
  Then recording a defect is not offered there
  But if the helper tries to record a defect from it anyway, the action is rejected

Scenario: A rejected defect keeps what was typed
  Given a technician records a defect from an untriaged problem report with the priority high, the suitable-for-helpers mark set, the machine status Out of order and no title
  When they submit it
  Then nothing is recorded and the problem report stays untriaged
  And the reason is shown at the form, with the title marked
  And the priority, the mark and the machine status they chose are still chosen

Scenario: After recording, the technician is back on the triage list
  Given the machine "LG-042" is Playable
  When a technician records the defect "Left flipper weak" from a problem report of "LG-042" and sets "LG-042" to Out of order in the same step
  Then the triage list is shown
  And a confirmation names the defect "Left flipper weak" and the machine "LG-042"
  And the confirmation says that "LG-042" is now Out of order
  And the triaged problem report is no longer listed

Scenario: Recording a defect is not offered on a triaged problem report
  Given a problem report for "LG-042" was triaged a moment ago
  When a technician opens that problem report's page
  Then recording a defect from it is not offered there

### Foundation (moved from ST-074 on 2026-09-27 – architecture review Q6)
- [ ] `context.run` runs an inner command in the same transaction as the same acting person: its events are journaled with that person; an inner command the person is not allowed to run makes the whole command `not-authorized`; an inner rejection rejects the whole command and stores nothing (integration tests with test stand-ins).
- [ ] The inner command's error type is part of the outer command's result type – shown by a type test (`expectTypeOf` or `@ts-expect-error`) that fails `npm run verify` if the inner error is missing.
- [ ] `context.runAsSystem` still runs policies journaled as the system; the existing policy tests stay green.
- [ ] Recording a defect with a status change runs `CMD-ChangeMachineStatus` through `context.run`, imported through `src/modules/collection/index.ts`.
- [ ] Updates `.claude/skills/engineering-conventions/SKILL.md` (user approves): "Writing a command" – `context.run`.

## Out of Scope
- Changing priority or details later (ST-027, ST-031)
- Linking to an existing defect (ST-022)
- The defect's own page and reaching it after recording (ST-021)

## Open Questions
- none
