---
id: ST-086
title: Helper dashboard – my claimed defects and what changed on them
type: story
context: BC-Repair
priority: should
size: M
risk: medium
events: [EVT-DefectClaimed, EVT-DefectClaimReleased, EVT-WorkLogged, EVT-DefectPrioritized, EVT-DefectPutOnHold, EVT-DefectResumed, EVT-DefectResolved, EVT-DefectDetailsChanged]
depends_on: [ST-049, ST-026, ST-027, ST-029, ST-031]
labels: [dashboard, ui]
status: done
---

## Story
As a helper, I want to see on my dashboard what happened to the defects I claimed – work logged by others, changes, a hold, a resolution, or my claim taken over or released – so that I learn about it without anyone telling me and don't work on a defect that is no longer mine.

## Context
Read model `RM-HelperDashboard`, field "my claimed defects and what changed on them (incl. taken over)". **Slice B of the split of ST-049** (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`, section 9 item 3). ST-049 owns the page (G18); this story adds into its section 1 „Von dir übernommen“ and adds no section of its own. What changed comes from the event journal (`docs/adr/0002-modular-monolith-state-based-persistence.md`). No active notifications (`docs/product/vision.md`); "new since the last visit" is marked by ST-050.
- Changes that count on "my claimed defects": work logged by someone else, title changed, priority changed, put on hold or resumed, resolved by someone else, and the claim taken over by someone else, assigned by a technician to someone else, or released by a technician (also by removing the suitable-for-helpers mark, ST-031).
- **Every change by someone else since the helper claimed the defect is listed** under it, one line per change, **newest first**; each line ends with when it happened, in words („· vor 2 Tagen“) (user, story review 2026-10-17, decision 1; G25). Changes from before her claim are not listed.
- **The helper's own actions are never listed** (G25) – neither her own work log entries nor her releasing her own claim.
- **A defect that left her stays listed for 7 days** with the change that made it leave: taken over, assigned to someone else, released by a technician, or resolved by someone else (decision 1). The 7 days are elapsed time (7 × 24 h), the same window as on the technician dashboard (ST-058). After that it is no longer listed.
- While such a defect is listed, section 1 is not empty: neither its empty text nor the dashboard's „Gerade ist nichts für dich offen.“ (ST-049) is shown.
- A claimed defect without changes is listed as ST-049 lists it, without change lines. The empty case of section 1 is ST-049's.

Interface (backlog grooming 2026-10-17, appendix; story review 2026-10-17, `docs/reviews/2026-10-17-story-review.md`; G6a, G25): each change is one line under its defect, naming who and what, ending with when, in this wording – „Ben hat übernommen“, „Tom hat Ben zugewiesen“, „Tom hat die Übernahme aufgehoben“, „Tom hat die Übernahme aufgehoben – nicht mehr für Helfer:innen geeignet“ (the mark removed, ST-031), „Neuer Arbeitsschritt von Tom“, „Titel geändert“, „Priorität: hoch“, „Pausiert – Wartet auf Ersatzteil“, „Fortgesetzt“, „Behoben von Tom“ – each followed by e.g. „· vor 2 Tagen“.

## Acceptance Criteria

Scenario: Helper sees that a claimed defect was taken over
  Given Anna claimed "Rubber cracked"
  And the helper Ben took it over 2 days ago
  When Anna opens the helper dashboard
  Then "Rubber cracked" is listed under her claimed defects with the line „Ben hat übernommen · vor 2 Tagen“

Scenario: A taken-over defect keeps section 1 and the dashboard from saying empty
  Given "Rubber cracked" was the only defect Anna claimed
  And Ben took it over yesterday
  And no defect suitable for helpers is open and no maintenance task suitable for helpers is due
  When Anna opens the helper dashboard
  Then "Rubber cracked" is listed under her claimed defects with the line that Ben took it over
  And the first section does not say that she has claimed no defect
  And the dashboard does not say that nothing is open for her

Scenario: Helper sees that her claimed defect was assigned to someone else
  Given Anna claimed "Rubber cracked"
  And the technician Tom assigned it to Ben 1 day ago
  When Anna opens the helper dashboard
  Then "Rubber cracked" is listed under her claimed defects with the line „Tom hat Ben zugewiesen · vor 1 Tag“

Scenario: Helper sees that a technician released her claim
  Given Anna claimed "Rubber cracked"
  And the technician Tom has since released her claim
  When Anna opens the helper dashboard
  Then "Rubber cracked" is listed under her claimed defects with the line that Tom released the claim

Scenario: Removing the mark says why her claim was released
  Given Anna claimed "Rubber cracked", which is suitable for helpers
  And the technician Tom removed its suitable-for-helpers mark 3 days ago
  When Anna opens the helper dashboard
  Then "Rubber cracked" is listed with the line „Tom hat die Übernahme aufgehoben – nicht mehr für Helfer:innen geeignet · vor 3 Tagen“

Scenario: Helper sees that someone else resolved her claimed defect
  Given Anna claimed "Rubber cracked"
  And the technician Tom resolved it yesterday
  When Anna opens the helper dashboard
  Then "Rubber cracked" is listed under her claimed defects with the line „Behoben von Tom · vor 1 Tag“

Scenario: A defect that left her stays listed for 7 days
  Given Ben took over Anna's claimed defect "Rubber cracked" 7 days minus one hour ago
  And Tom resolved Anna's claimed defect "Display flickers" 7 days plus one hour ago
  When Anna opens the helper dashboard
  Then "Rubber cracked" is listed under her claimed defects with the line that Ben took it over
  But "Display flickers" is no longer listed

Scenario: Helper sees what changed on her claimed defects
  Given Anna claimed "Slingshot switch loose"
  And a technician logged work on it and changed its title since
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" is listed under her claimed defects with a line for the new work log entry and a line for the changed title

Scenario: Priority changes and resuming are listed
  Given Anna claimed "Display flickers"
  And Tom since set its priority to high, then put it on hold with the reason waiting for part, then resumed it
  When Anna opens the helper dashboard
  Then "Display flickers" is listed with the lines „Fortgesetzt“, „Pausiert – Wartet auf Ersatzteil“ and „Priorität: hoch“, each with when it happened

Scenario: A hold on her claimed defect is shown with its reason
  Given Anna claimed "Display flickers"
  And a technician put it on hold with the reason waiting for part
  When Anna opens the helper dashboard
  Then "Display flickers" is listed with the line „Pausiert – Wartet auf Ersatzteil“

Scenario: Change lines are listed newest first, each with when it happened
  Given Anna claimed "Slingshot switch loose" 5 days ago
  And Tom logged work on it 4 days ago and changed its title 2 days ago
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" shows „Titel geändert · vor 2 Tagen“ above „Neuer Arbeitsschritt von Tom · vor 4 Tagen“

Scenario: Changes before her claim are not listed
  Given Tom changed the title of "Slingshot switch loose" 3 days ago
  And Anna claimed it 2 days ago
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" is listed under her claimed defects without a line for the changed title

Scenario: A claimed defect without changes has no change lines
  Given Anna claimed "Slingshot switch loose" and nobody else did anything on it since
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" is listed under her claimed defects as ST-049 lists it, without change lines

Scenario: Her own actions are never listed as changes
  Given Anna claimed "Slingshot switch loose" and logged work on it herself
  And Anna claimed "Rubber cracked" and released her claim herself
  When Anna opens the helper dashboard
  Then "Slingshot switch loose" is listed under her claimed defects without a change line for her own work log entry
  And "Rubber cracked" is not listed under her claimed defects

## Out of Scope
- The page, its other sections, the landing after login and the empty case (ST-049)
- Marking what is new since the last visit (ST-050)

## Open Questions
- none – how long change lines stay, their order and whether they say when were decided (user, story review 2026-10-17, decision 1).

## Notes
- **The first typed read of the event journal.** What changed is read from the event journal through the event catalogue per module (architecture review 2026-09-27, Q4 and Q15); no per-command journal mapping is read directly. A journal query over many aggregates with a time window is new platform code (lead dev, story review 2026-10-17).
- **ST-079's catalogue conversion comes first, as its own branch** (lead dev, backlog grooming 2026-10-17, section 6; user decision section 9 item 3): the per-command journal mappings are converted to the event catalogue per module as a refactoring on its own branch and pull request – not as a story and not inside this one. ST-079's text describes what the conversion covers. It is not a `depends_on` (ST-079 is `wont` and stays unbuilt as a story); start this story only by name (`/implement ST-086`), once that refactoring is merged. **Done by the architecture review of 2026-10-17** (branch `architecture-2026-10-17`): `repairEvents` and `readJournal` with type, aggregate, since and not-by filters exist.
- Journal gaps to close on that conversion branch (lead dev, story review 2026-10-17; `events.yaml` updated by the domain-architect, decision 3): the release event carries the former claimant (done on 2026-10-17); `EVT-DefectDetailsChanged` says which of title or suitable-for-helpers mark changed; ST-029's mapping journals the hold reason but not the note, although `EVT-DefectPutOnHold` carries both – the last two land with ST-031 and ST-029, whose events do not exist yet.
- Size M and risk medium (lead dev, story review 2026-10-17).
