---
id: ST-098
title: The sticker selection and recording for several machines choose in folding groups
type: story
context: BC-Collection
priority: must
size: S
risk: low
events: [EVT-MaintenanceRecorded]
depends_on: [ST-094]
labels: [ui, feature:per-machine-maintenance]
status: done
---

## Story
As a team member choosing many machines at once, I want the machines grouped by machine category and technology in folds that say how many are chosen, so that 60 machines are not one long wall of checkboxes on my phone.

## Context
Finding **F16** of the consistency audit `docs/reviews/2026-10-25-ux-audit-consistency.md`, decided by the user on 2026-10-25 (question 2: yes) and written into **G27**'s uses (`docs/product/ux-guidelines.md`), completed in the story review of 2026-10-25 (`docs/reviews/2026-10-25-story-review.md`, decision 4). Uses the grouped choice built in ST-094. Changes the screens of the done stories **ST-011** (sticker selection, Collection) and **ST-045** (recording for several machines, Maintenance, `CMD-RecordMaintenance` – one `EVT-MaintenanceRecorded` per machine); neither is reopened and no rule of either changes. Filed under `BC-Collection` because the sticker selection is the larger change.

**The grouped choice, as in ST-094 (G27)** – each group folds and opens without JavaScript, is closed when the page opens unless said otherwise below, and its header names the group and how many of it are chosen; groups in the order of `CONTEXT.md`, machines by museum number, a group without a machine not shown; „Alle auswählen“ per group only with JavaScript. **The header's count follows each tick only with JavaScript**; without it the count says what was chosen when the page opened.

**The sticker selection** (ST-011)
- The machines are grouped by machine category and technology („Flipper · EM – 2 von 6 ausgewählt“). An entry reads „LG-042 · Medieval Madness“.
- **Search** (user, story review 2026-10-25): a search shows only the groups with a matching machine, **opened**, with only the matching machines in them; each header counts what is listed („Flipper · DMD – 0 von 1 ausgewählt“). The search stays a reload of the page, so a new search starts a new choice – ticks made before it are not kept, as today (ST-011).
- The count of chosen machines next to the way to print reads „2 Geräte ausgewählt“ („1 Gerät ausgewählt“); it follows each tick with JavaScript.
- Everything else of ST-011 stays: the search over museum number and machine model title, the rejection when nothing is chosen, no sticker for retired machines.

**Recording for several machines** (ST-045)
- The group **„Fällig“ stays open and its machines ticked** when the page opens (G27), with its count in the header („Fällig – 2 von 2 ausgewählt“).
- Under „Weitere Geräte“ the other machines of the task fold by machine category and technology, each group closed, with its count.
- After a rejection every tick is kept and every group with a tick is open (G8, G27). Every rule of ST-045 – partial success (G23), nothing chosen – is unchanged.

## Acceptance Criteria

Scenario: The sticker selection is grouped and closed
  Given 6 EM pinball machines, 10 DMD pinball machines and 4 CRT arcade machines are registered
  When a technician opens the sticker selection
  Then the machines are offered in the closed groups „Flipper · EM – 0 von 6 ausgewählt“, „Flipper · DMD – 0 von 10 ausgewählt“ and „Arcade · CRT – 0 von 4 ausgewählt“, in this order

Scenario: Stickers for machines of two groups
  Given "LG-005" is an EM pinball machine and "LG-020" a CRT arcade machine
  When a technician ticks both in their groups and prints
  Then one printable page shows the stickers of "LG-005" and "LG-020"

Scenario: Choosing nothing is still rejected and opens nothing
  When a technician asks to print QR stickers without ticking a machine
  Then no printable page is produced and the technician is asked to choose at least one machine
  And every group is closed

Scenario: The chosen count stays next to the way to print
  Given 6 EM pinball machines, among them "LG-005", and 4 CRT arcade machines, among them "LG-020", are registered
  And JavaScript is switched on
  And a technician ticked "LG-005" in „Flipper · EM“ and "LG-020" in „Arcade · CRT“ and closed both groups again
  When the technician looks at the way to print
  Then it reads „2 Geräte ausgewählt“
  And the headers read „Flipper · EM – 1 von 6 ausgewählt“ and „Arcade · CRT – 1 von 4 ausgewählt“

Scenario: Without JavaScript the header keeps the count of when the page opened
  Given JavaScript is switched off
  When a technician opens „Flipper · EM“ in the sticker selection and ticks "LG-005"
  Then the header still reads „Flipper · EM – 0 von 6 ausgewählt“
  And printing gives the sticker of "LG-005"

Scenario: A search shows only the groups with a match, opened
  Given "LG-042" (Medieval Madness) is a DMD pinball machine, and no other machine matches "medieval"
  When a technician searches the sticker selection for "medieval"
  Then only the group „Flipper · DMD – 0 von 1 ausgewählt“ is shown, open, with "LG-042" in it
  And no other group is shown

Scenario: A new search starts a new choice
  Given a technician ticked "LG-005" in the sticker selection
  When the technician searches for "medieval" and then clears the search again
  Then "LG-005" is no longer ticked, as in ST-011 today

Scenario: Recording for several keeps the due machines open and ticked
  Given "Clean glass (inside & out)" is due on "LG-042" and "LG-043" and also applies to "LG-005" (EM) and "LG-020" (CRT)
  When a team member opens „Für mehrere Geräte erfassen“ for it
  Then the group „Fällig – 2 von 2 ausgewählt“ is open with "LG-042" and "LG-043" ticked
  And under „Weitere Geräte“ the closed groups „Flipper · EM – 0 von 1 ausgewählt“ and „Arcade · CRT – 0 von 1 ausgewählt“ are shown

Scenario: A machine from a further group is recorded too
  Given "Clean glass (inside & out)" is due on "LG-042" and also applies to "LG-005"
  When a team member opens „Flipper · EM“, ticks "LG-005" and records the task as done
  Then "LG-042" and "LG-005" get a maintenance record each

Scenario: A rejected recording keeps the ticks and opens their groups
  Given a team member ticked "LG-005" under „Weitere Geräte“ in „Für mehrere Geräte erfassen“
  When they record with a date more than 7 days in the past
  Then nothing is recorded
  And "LG-005" is still ticked and „Flipper · EM“ is open, as is „Fällig“

## Out of Scope
- Changing which machines a maintenance task applies to (ST-095)
- A sticker for a retired machine (ST-011: never)
- Keeping ticks across a search of the sticker selection

## Open Questions
- none – search with groups answered as recommended (user, 2026-10-25, story review).

## Notes
- Size S, risk low (lead dev, story review 2026-10-25): the search stays a reload of the page, ticks are lost as today; header counts live only with JavaScript.
