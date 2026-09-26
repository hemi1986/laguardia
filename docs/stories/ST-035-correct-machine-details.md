---
id: ST-035
title: Correct a machine's museum number or serial number
type: story
context: BC-Collection
priority: could
size: M
risk: medium
events: [EVT-MachineDetailsCorrected]
depends_on: [ST-011]
labels: [collection]
status: ready
---

## Story
As a technician, I want to correct a mistyped museum number or add a serial number later, so that the machine's identification is right without registering it again and losing its history.

## Context
Command `CMD-CorrectMachineDetails` (technicians only, HS-18). Rules:
- The machine is not retired.
- A new museum number has the format "LG-" plus three digits and is unique in the same set as at registration (ST-007): all museum numbers in use, retired machines included, and all reserved numbers. The old museum number becomes reserved and is never reused (decision D11).
- A correction and a registration with the same number at the same time never both succeed; the machine store guarantees uniqueness atomically (HS-17).
- The QR sticker is reprinted after a museum number correction (ST-011).
- An old QR sticker with the previous museum number keeps leading to the machine – the old number is reserved, so it cannot become ambiguous.

## Acceptance Criteria

Scenario: Technician adds a serial number later
  Given the machine "LG-042" has no serial number
  When a technician corrects its serial number to "MM-12345"
  Then "LG-042" has the serial number "MM-12345"

Scenario: Technician corrects a mistyped museum number
  Given a machine was registered with the mistyped museum number "LG-420"
  And no machine has the museum number "LG-042"
  When a technician corrects its museum number to "LG-042"
  Then the machine has the museum number "LG-042" with all its history
  And a new QR sticker for "LG-042" can be printed

Scenario: The old museum number stays reserved
  Given the museum number of a machine was corrected from "LG-420" to "LG-042"
  When a technician registers a machine with the museum number "LG-420"
  Then the registration is rejected because the museum number is already used

Scenario: Old QR sticker keeps working
  Given the museum number of a machine was corrected from "LG-420" to "LG-042"
  And the old sticker "LG-420" is still on the machine
  When a visitor scans the old sticker
  Then the visitor machine page of "LG-042" opens

Scenario: New museum number already used
  Given the retired machine "LG-013" exists
  When a technician corrects the museum number of "LG-042" to "LG-013"
  Then the correction is rejected

Scenario: Correction and registration race for the same number
  Given no machine has the museum number "LG-060" and it is not reserved
  When a technician corrects a machine's museum number to "LG-060" while another technician registers a machine with "LG-060"
  Then exactly one of the two gets "LG-060"
  And the other action is rejected because the museum number is already used

Scenario: Reserved number cannot be taken by a correction
  Given "LG-420" is reserved after an earlier correction
  When a technician corrects the museum number of "LG-043" to "LG-420"
  Then the correction is rejected

Scenario: Retired machines cannot be corrected
  Given the machine "LG-013" is retired
  When a technician tries to correct its serial number
  Then the correction is rejected

Scenario: Helpers cannot correct machine details
  Given a helper is logged in
  When the helper tries to correct a museum number or serial number
  Then the correction is rejected

## Out of Scope
- Correcting machine model data (ST-036)

## Open Questions
- none
