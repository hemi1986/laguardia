---
id: ST-007
title: Register a machine with its museum number
type: story
context: BC-Collection
priority: must
size: L
risk: medium
events: [EVT-MachineRegistered]
depends_on: [ST-006, ST-071, ST-073, ST-069]
labels: [mvp, collection, ui]
status: review
---

## Story
As a technician, I want to register a machine with its machine model, museum number, location and machine status, so that it becomes part of La Guardia and problems, defects, files and maintenance can be recorded for it.

## Context
**The machine overview as a plain list is part of this story** (user's decision, backlog grooming 2026-10-01). ST-007 ships the first form on the house pattern, and G2a says creating a thing is reached by a named action under the heading of a list – that list did not exist, because ST-008 depends on this story. So this story delivers the machine overview as a plain list of the active machines, showing museum number, machine model title, location and machine status, sorted by museum number. The counts, the machine status filter and the search are added by ST-008 to a list that then already exists.
- The machine overview is the entry point: registering is reached by a named action directly under its heading and happens on its own page; the overview stays a list (G2a).
- After registering, the technician lands on the new machine's record with a confirmation naming the museum number and the machine model (G3).
- A rejection stays on the form, keeps every value that was typed, names the reason above the submit button and marks the field that caused it (G8).
- A helper is not offered registering; the command rejects it anyway (G11).
- The team navigation is decided in ST-008 with every destination the MVP will have (G19).

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

Scenario: No machine registered yet
  Given no machine is registered
  When a technician opens the machine overview
  Then it says that no machine is registered yet
  And registering the first machine is offered

Scenario: The machine overview lists the registered machines
  Given the machines "LG-002" (Out of order) at "Hall 2, row 1" and "LG-001" (Playable) at "Hall 1, row 3" are registered
  When a technician opens the machine overview
  Then both machines are listed with museum number, machine model title, location and machine status
  And "LG-001" is listed before "LG-002"

Scenario: A rejected registration keeps what was typed
  Given a technician fills in the registration of a machine of the machine model "Medieval Madness" at "Hall 2, row 3" with the museum number "42"
  When they submit it
  Then the registration is rejected because a museum number has the format "LG-" plus three digits
  And the reason is shown at the form, with the museum number marked
  And the machine model, the location and the machine status they chose are still filled in

Scenario: After registering, the technician sees the new machine
  When a technician registers a machine of the machine model "Medieval Madness" at "Hall 2, row 3"
  Then the machine record of "LG-042" is shown
  And a confirmation names the museum number "LG-042" and the machine model "Medieval Madness"

Scenario: Helpers are not offered registering
  Given a helper is logged in
  When the helper opens the machine overview
  Then registering a machine is not offered

### Foundation (from the ST-073 code review on 2026-09-29 – findings #7, #3)
- [ ] The team catalogue gets a `commandErrors` section and `commandErrorText` accepts it: every error code of CMD-RegisterMachine (and `not-authorized`, `not-found`, `version-conflict`) has a German text (unit test like `src/platform/messages/command-errors.test.ts`); the stand-in-only `machine-required` text of the visitor catalogues is reused or removed (ST-073 code review #7, #3).

### Foundation (from ST-078 on 2026-09-29 – the runner's browser proof)
- [ ] The register-machine form proves the Server Action runner in the browser (ST-073): a rejected registration shows the catalogue text of its error code and keeps the typed input, at 360 px and with JavaScript disabled (browser tests). These proofs ran on the spike's problem report form until ST-078 removed it.

## Out of Scope
- Correcting museum number or serial number later (ST-035)
- Printing the QR sticker (ST-011)
- The count per machine status, the machine status filter and the search in the machine overview (ST-008)
- The machine category and the technology in the overview entry, and the machine record itself (ST-008, ST-009)

## Open Questions
- [OPEN] Where does a successful registration land? The grooming scenario says the machine record of the new machine, but the machine record is ST-009, which depends on ST-008, which depends on this story – so it does not exist yet when ST-007 ships. Guideline G2a says the opposite for a creation form: "on success the person lands back on the list, with the confirmation of G3". Options: (a) land back on the machine overview with the confirmation naming museum number and machine model, and move the "lands on the machine record" scenario to ST-009; (b) pull a minimal machine record into this story, which grows it again. Recommendation: (a) – it is what G2a says and it keeps the story at L.
