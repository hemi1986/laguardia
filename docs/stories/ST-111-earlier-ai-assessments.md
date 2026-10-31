---
id: ST-111
title: Earlier AI assessments on the defect page and in the repair history
type: story
context: BC-AiAssistance
priority: should
size: S
risk: low
events: [EVT-AiAssessmentWritten, EVT-AiAssessmentFailed]
depends_on: [ST-107, ST-108]
labels: [ui, feature:ai-assessment]
status: ready
---

## Story
As a team member, I want to read the earlier AI assessments of a defect – on the defect page and in the machine's repair history – without them burying the page, so that I can compare what the AI said before with what we found.

## Context
Feature `ai-assessment` (user, 2026-10-31; `docs/domain/events.yaml` **RM-DefectAiAssessments**, **RM-MachineRecord**
(*AI assessments of the defects in the repair history (collapsed)*), **EVT-AiAssessmentWritten**,
**EVT-AiAssessmentFailed**, resolved **HS-30**). Every AI assessment is kept with its defect, written or failed
(`CONTEXT.md`: *AI assessment*).

**On the defect page (G39):** the section „KI-Einschätzungen“ lists a defect's AI assessments newest first. The newest
– also one being written („KI-Einschätzung läuft …“, G35) – is open; every older one is a fold that opens without
JavaScript, with the look of every fold (G31) and the header „KI-Einschätzung vom 31.10.2026“ (G6, G39). Opened, an
older one shows what ST-107 shows for a written one (G38), or its failure reason (ST-108).

**In the repair history (RM-MachineRecord):** each defect's AI assessments are shown under it, all collapsed, with the
same header – on the machine record's latest repairs and on the repair history's own page
(`/team/machines/<museum number>/reparaturhistorie`), as ST-033 asks of what a later story adds to a defect. A
defect resolved or closed on retirement keeps its AI assessments there (HS-30).

**While AI is off** earlier AI assessments stay readable in both places (G37).

**After „Erneut versuchen“** (ST-108) the failed AI assessment is an older one and is shown here as a fold below the
new one – ST-108 only keeps it.

**Definition of done** (not scenarios): the light review lane – `@acceptance-tester` only (size S, no command, no
migration, no form input; story review 2026-10-31).

## Acceptance Criteria

Scenario: The newest AI assessment is open and the older ones are folded
  Given "Left flipper weak" has AI assessments written on 29.10.2026 and on 31.10.2026 and one that failed on 30.10.2026
  When a team member opens the defect "Left flipper weak"
  Then the AI assessment of 31.10.2026 is shown open
  And below it „KI-Einschätzung vom 30.10.2026“ and „KI-Einschätzung vom 29.10.2026“ are folded, in that order

Scenario: An earlier AI assessment opens without JavaScript
  Given "Left flipper weak" has an older written AI assessment and an older failed one
  When a team member without JavaScript opens the older written one and the failed one
  Then the written one shows its summary, probable causes, what to check first, references, chat model, requester and cost
  And the failed one shows its reason

Scenario: An AI assessment being written is on top and the newest written one is folded
  Given "Left flipper weak" has a written AI assessment of 31.10.2026 and a new one is being written
  When a team member opens the defect "Left flipper weak"
  Then „KI-Einschätzung läuft …“ is shown on top
  And „KI-Einschätzung vom 31.10.2026“ is folded below it

Scenario: The repair history shows each defect's AI assessments folded
  Given the resolved defect "Left flipper weak" of "LG-042" has two AI assessments and "Display flickers" has none
  When a team member opens the machine record of "LG-042" and the repair history of "LG-042"
  Then in both places "Left flipper weak" shows its two AI assessments folded, newest first
  And "Display flickers" shows no AI assessment

Scenario: Earlier AI assessments stay readable while AI is off
  Given AI is off and "Left flipper weak" has two AI assessments
  When a team member opens the defect "Left flipper weak" and the repair history of its machine
  Then both AI assessments are shown as while AI was on
  And „KI-Einschätzung anfordern“ is not offered

## Out of Scope
- Comparing or rating AI assessments (`docs/product/vision.md`, out of the first version)
- AI assessments on the dashboards or in the open defects list

## Open Questions
- none
