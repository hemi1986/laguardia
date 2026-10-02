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
labels: [collection, ui]
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

### Foundation (from the architecture review 2026-10-02 (user decisions) – one museum number register for the Collection module)
Today what a museum number is lives in four places (`registrationFacts` and `giveOut` in `src/modules/collection/machines.ts`, `MUSEUM_NUMBER`/`nextMuseumNumber` in `register-machine.ts`, the lock key), and a changing command gets no facts (`src/platform/command/aggregate.ts`). So CMD-CorrectMachineDetails could not reject "New museum number already used", and the race with a registration would end in a primary-key crash; the test stand-in `correctMuseumNumberForTest` hides it. Built just in time in this story, its first real caller – no ADR. It resolves the notes of `docs/reviews/ST-007-code-review.md` (Resolution: "facts on changing commands – revisit with ST-035", "count(*) on every machine update – revisit with ST-010", "#4 MuseumNumber type – revisit with ST-035").
- [ ] One museum number register in the Collection module (`src/modules/collection/museum-numbers.ts`) is the only place that knows what a museum number is: the format "LG-" plus three digits, the next free museum number (after LG-999 counting down), the set of all museum numbers given out (in use, of retired machines, and every reserved museum number) read under the advisory lock, giving a museum number to a machine (its earlier museum number stays a reserved museum number), and resolving a museum number – current or reserved – to its machine. CMD-RegisterMachine and CMD-CorrectMachineDetails both go through it; only the register writes the `museum_number` table (tests).
- [ ] The register takes the lock when it reads its facts and again when it gives out a museum number (re-entrant within the transaction), so every write of a museum number is serialized even if a command forgets its facts (integration test).
- [ ] A unique violation on `museum_number` that slips past the lock is turned into the rejection `museum-number-taken` by the register – in one place, not per command (integration test).
- [ ] The command layer lets changing commands declare `facts` too, not only creating ones; the type rule of ST-007 – `facts` is required when `decide` takes facts – holds for both shapes (type test in `src/platform/command/facts-types.test.ts`); the engineering conventions are updated when this is built.
- [ ] The machine store keeps the status history append-only without `count(*)`: it remembers how many entries it loaded and appends only new ones; a decision that shortens or changes a loaded entry fails loudly (integration test).
- [ ] A reserved museum number in an address leads to the machine's current museum number: the team machine record (`/team/machines/<number>`, ST-009) redirects to the current museum number – in addition to the scenario "Old QR sticker keeps working", which covers the visitor machine page (test).
- [ ] The test stand-in `correctMuseumNumberForTest` (`src/modules/collection/machines.test-support.ts`) is replaced by the real command or goes through the register, so no test can skip the museum number rule.

## Out of Scope
- Correcting machine model data (ST-036)

## Open Questions
- none
