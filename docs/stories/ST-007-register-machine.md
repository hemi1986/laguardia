---
id: ST-007
title: Register a machine with its museum number
type: story
context: BC-Collection
priority: must
size: M
risk: medium
events: [EVT-MachineRegistered]
depends_on: [ST-006]
labels: [mvp, collection]
status: ready
---

## Story
As a technician, I want to register a machine with its machine model, museum number, location and machine status, so that it becomes part of La Guardia and problems, defects, files and maintenance can be recorded for it.

## Context
Command `CMD-RegisterMachine` (technicians only). Rules:
- The machine model exists.
- The museum number is unique among all machines ever registered, retired ones included (set-based rule, HS-17 – guaranteed atomically by the machine store).
- A given museum number must have the format "LG-" plus three digits, so automatic assignment and the printed stickers stay consistent.
- If no museum number is given, La Guardia assigns "LG-" plus three digits, the next number above the highest existing one; numbers are never reused (HS-19).
- Reserved museum numbers – numbers a machine had before a correction (ST-035) – count for uniqueness and for "next above the highest", just like numbers in use. After LG-999, the next free lower number is assigned (decision D11).
- Two automatic assignments at the same time never get the same number: the second one is retried with the next free number.
- The serial number is optional; the location (free text) is required (`docs/architecture/data-model.md`).
- The initial machine status (*Playable*, *Limited*, *Out of order*, *Not on display*) is the first entry of the machine's status history (reason: registration).

Schema clean-up (story review `docs/reviews/2026-09-27-story-review.md`, decision 3; `docs/reviews/ST-001-code-review.md` finding #2): the migration that creates the `machine` table also deletes the ST-001 spike rows of `problem_report` (`machine_id = 'test-machine'`), aligns `problem_report.machine_id` with the machine ID type (ID convention of ST-003) and adds the foreign key from `problem_report.machine_id` to the machine – all in one migration.

## Acceptance Criteria

Scenario: Technician registers a machine with an assigned museum number
  Given the highest museum number of all machines is "LG-041"
  When a technician registers a machine of the machine model "Medieval Madness" at the location "Hall 2, row 3" with the machine status Playable and without a museum number
  Then the machine is registered with the museum number "LG-042"
  And its status history starts with Playable and the reason "registration"

Scenario: Technician gives the museum number
  Given no machine has the museum number "LG-007"
  When a technician registers a machine with the museum number "LG-007" and the serial number "MM-12345"
  Then the machine is registered with the museum number "LG-007" and the serial number "MM-12345"

Scenario: Museum number of a retired machine is never reused
  Given the retired machine "LG-050" has the highest museum number of all machines
  When a technician registers a machine without a museum number
  Then the machine is registered with the museum number "LG-051"

Scenario: Reserved museum numbers count
  Given the highest museum number in use is "LG-041"
  And "LG-045" is reserved because a machine's museum number was corrected from "LG-045" to "LG-040"
  When a technician registers a machine without a museum number
  Then the machine is registered with the museum number "LG-046"

Scenario: After LG-999 the next free lower number is used
  Given "LG-999" is in use and "LG-017" is the only lower number that is neither in use nor reserved
  When a technician registers a machine without a museum number
  Then the machine is registered with the museum number "LG-017"

Scenario: Concurrent automatic assignment
  Given the highest museum number is "LG-041"
  When two technicians register a machine without a museum number at the same time
  Then one machine gets "LG-042" and the other "LG-043"

Scenario: Duplicate museum number is rejected
  Given the museum number "LG-007" is in use by a machine, retired or not, or reserved
  When a technician registers another machine with the museum number "LG-007"
  Then the registration is rejected because the museum number is already used

Scenario: Museum number in another format is rejected
  When a technician registers a machine with the museum number "42"
  Then the registration is rejected because a museum number has the format "LG-" plus three digits

Scenario: Concurrent registrations with the same museum number
  Given no machine has the museum number "LG-060"
  When two technicians register a machine with the museum number "LG-060" at the same time
  Then exactly one machine is registered with "LG-060"
  And the other registration is rejected because the museum number is already used

Scenario: Machine model and location are required
  When a technician registers a machine without a machine model or without a location
  Then the registration is rejected

Scenario: Helpers cannot register machines
  Given a helper is logged in
  When the helper tries to register a machine
  Then the action is rejected

Scenario: Spike problem reports are removed and problem reports refer to registered machines
  Given problem reports from the ST-001 spike exist for the machine "test-machine"
  When the migration that creates the machine store is applied in one step
  Then no problem report for "test-machine" remains
  And the machine reference of a problem report has the machine ID type of the ID convention
  And a problem report can only be stored for a registered machine

## Out of Scope
- Correcting museum number or serial number later (ST-035)
- Printing the QR sticker (ST-011)

## Open Questions
- none
