---
id: ST-086
title: Helper dashboard – my claimed defects and what changed on them
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-DefectClaimed, EVT-DefectClaimReleased, EVT-WorkLogged, EVT-DefectPrioritized, EVT-DefectPutOnHold, EVT-DefectResumed, EVT-DefectResolved, EVT-DefectDetailsChanged]
depends_on: [ST-049, ST-026, ST-027, ST-029, ST-031]
labels: [dashboard, ui]
status: draft
---

## Story
As a helper, I want to see on my dashboard what happened to the defects I claimed – work logged by others, changes, a hold, a resolution, or my claim taken over or released – so that I learn about it without anyone telling me and don't work on a defect that is no longer mine.

## Context
Read model `RM-HelperDashboard`, field "my claimed defects and what changed on them (incl. taken over)". **Slice B of the split of ST-049** (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`, section 9 item 3). ST-049 owns the page (G18); this story adds into its section 1 „Von dir übernommen“ and adds no section of its own.
- Changes that count on "my claimed defects": work logged by someone else, title or suitable-for-helpers mark changed, priority changed, put on hold or resumed, resolved, and the claim taken over by someone else or released by a technician (also by removing the suitable-for-helpers mark, ST-031).
- The empty case of section 1 is ST-049's; a claimed defect without changes is listed as ST-049 lists it, without change lines.
- A defect that is no longer claimed by the helper (taken over or released) stays listed with that change for 7 days, the same window as on the technician dashboard (ST-058).
- **The first typed read of the event journal.** What changed comes from the event journal (`docs/adr/0002-modular-monolith-state-based-persistence.md`), read through the event catalogue per module (architecture review 2026-09-27, Q4 and Q15). No per-command journal mappings may be read directly.
No active notifications (`docs/product/vision.md`); "new since the last visit" is marked by ST-050.

Interface (backlog grooming 2026-10-17, appendix; G6a): each change is one line under its defect, naming who and what, in this wording – „Ben hat übernommen“, „Tom hat die Übernahme aufgehoben“, „Neuer Arbeitsschritt von Tom“, „Titel geändert“, „Priorität: hoch“, „Pausiert – Wartet auf Ersatzteil“, „Fortgesetzt“, „Behoben von Tom“.

## Acceptance Criteria

Scenario: Helper sees that a claimed defect was taken over
  Given Anna claimed "Rubber cracked"
  And the helper Ben has since taken it over
  When Anna opens the helper dashboard
  Then "Rubber cracked" is listed under her claimed defects with the change that Ben took it over

Scenario: Helper sees that a technician released her claim
  Given Anna claimed "Rubber cracked"
  And the technician Tom has since released her claim
  When Anna opens the helper dashboard
  Then "Rubber cracked" is listed under her claimed defects with the change that Tom released the claim

Scenario: Taken-over defects drop off after 7 days
  Given Ben took over Anna's claimed defect "Rubber cracked" 8 days ago
  When Anna opens the helper dashboard
  Then "Rubber cracked" is no longer listed under her claimed defects

Scenario: Helper sees what changed on her claimed defects
  Given Anna claimed "Slingshot switch loose"
  And a technician logged work on it and changed its title since
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" is listed under her claimed defects with a line for the new work log entry and a line for the changed title

Scenario: A hold on her claimed defect is shown with its reason
  Given Anna claimed "Display flickers"
  And a technician put it on hold with the reason waiting for part
  When Anna opens the helper dashboard
  Then "Display flickers" is listed with the change that it is on hold – waiting for part

Scenario: Her own work log entries are not listed as changes
  Given Anna claimed "Slingshot switch loose" and logged work on it herself
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" is listed under her claimed defects without a change line for her own work log entry

## Out of Scope
- The page, its other sections, the landing after login and the empty case (ST-049)
- Marking what is new since the last visit (ST-050)

## Open Questions
- none

## Notes
- **ST-079's catalogue conversion comes first, as its own branch** (lead dev, backlog grooming 2026-10-17, section 6; user decision section 9 item 3): the per-command journal mappings are converted to the event catalogue per module as a refactoring on its own branch and pull request – not as a story and not inside this one. ST-079's text describes what the conversion covers. It is not a `depends_on` (ST-079 is `wont` and stays unbuilt as a story); start this story only once that refactoring is merged.
- Size and risk: the grooming estimated slice B as M; the lead dev confirms in the story review.
