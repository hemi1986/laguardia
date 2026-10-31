---
id: ST-109
title: See how far the AI index got and try failed files again
type: story
context: BC-AiAssistance
priority: should
size: M
risk: medium
events: [EVT-FileIndexedForAi, EVT-FileIndexingFailed, EVT-AiWorkLeftUnfinished]
depends_on: [ST-106, ST-108]
labels: [ui, feature:ai-assessment]
status: ready
---

## Story
As a technician, I want to see which files the AI can read, which are still waiting and which it cannot read and why, and to try a failed file again, so that I know what the AI assessments rely on and what indexing has cost.

## Context
Feature `ai-assessment` (user, 2026-10-31; `docs/domain/events.yaml` **RM-AiSettings**, **RM-MachineRecord**,
**CMD-IndexFileForAi** (by hand), **EVT-FileIndexedForAi**, **EVT-FileIndexingFailed**,
**POL-UnfinishedAiWorkIsRetried**, resolved **HS-32**; `docs/architecture/data-model.md`, section *AI index entry*;
ADR 0015). Revised after the story review `docs/reviews/2026-10-31-ai-assessment-story-review.md` (user, 2026-10-31).

**The overview „KI-Erfassung“ in the form „KI“** on „Einstellungen“ (RM-AiSettings; `CONTEXT.md`: *AI index* –
„KI-Erfassung“, *AI index entry* – „Für die KI erfasst / Wartet auf KI-Erfassung / Für die KI nicht lesbar“),
technicians only (G11; helpers do not reach the page, ST-104), below the AI settings:
- how many files are **indexed** (an entry for the current embedding model), **waiting** (no such entry – derived) and
  **failed**, counting only files that are not removed (data model);
- the **failed files**, each with its machine (museum number) or machine model, its title and its reason
  (*not readable*, *format not indexed*, *OpenRouter refused*, *OpenRouter not reachable*), and „Erneut versuchen“;
- the **cost of indexing so far** – everything OpenRouter charged for indexing, replaced entries included (data model).

**„Erneut versuchen“ on a failed file** – CMD-IndexFileForAi run by hand: a technician may run it **only on a file that
failed** (rule), only while AI is on; the indexing runs in the background (ADR 0015, ST-112), the technician stays on
the page with a confirmation (G3) and the file counts as waiting until it is indexed or fails again.

**The daily retry of failed files (HS-32):** the daily retry of ST-108 also indexes again the files that failed with
*OpenRouter not reachable* or *OpenRouter refused*, **at most once a day each**: a failed file is tried again by the
daily retry only if its last failure is from an earlier calendar day (Europe/Berlin) than the run – so a file that
fails again during that night's run is not tried again before the next night. A file that failed as *not readable* or
*format not indexed* is tried again **only by hand** – the same file fails the same way and costs every time. Vercel
runs the daily retry for production only; the scenarios drive the run function directly with the injected clock
(ST-112).

**On the machine record** (RM-MachineRecord): in the list of files of the machine and its machine model, a file that
failed is marked „Für die KI nicht lesbar“; indexed and waiting files carry no mark. Shown to the whole team.

**While AI is off neither the overview nor the mark is shown** (user, 2026-10-31): the form „KI“ says what is missing
(G37), a file is not "unreadable for the AI" while there is no AI, and „Erneut versuchen“ is not offered. Both come back
unchanged when AI is turned on. The files themselves stay; the overview is a view, not content (G37). Accepted
consequence: the cost of indexing so far is not visible while AI is off.

**Empty case (G7):** with no file indexed, waiting or failed the overview says so; without failed files there is no
list of failed files.

**German texts** (user, 2026-10-31, as recommended): heading „KI-Erfassung“; „12 Dateien für die KI erfasst · 3 warten
auf KI-Erfassung · 2 für die KI nicht lesbar“; „Kosten der KI-Erfassung bisher: 1,23 $“; a failed file „LG-042 ·
Attract mode.mp4 – Dateiformat wird nicht erfasst“ / „Eight Ball · Eight Ball Schematic – OpenRouter war nicht
erreichbar“ (not readable „Datei lässt sich nicht lesen“, OpenRouter refused „OpenRouter hat abgelehnt“); empty „Noch
keine Datei für die KI erfasst.“; „Erneut versuchen“, confirmation „Eight Ball Schematic wird erneut für die KI
erfasst.“ (no nested quotes).

**Interface:** German numbers and the cost in German notation (G13).

**Definition of done** (not scenarios): the normal review lane – a command and a new path into `CMD-IndexFileForAi`
by hand, so not the light lane.

## Acceptance Criteria

Scenario: The overview shows how far the AI index got and what it cost
  Given AI is on, 12 files are indexed, 3 are waiting and 2 failed, and indexing has cost 1.23 dollars so far
  When a technician opens „Einstellungen“
  Then the overview in the form „KI“ shows 12 files indexed, 3 waiting and 2 failed
  And it shows the cost of indexing so far as „1,23 $“

Scenario: Failed files are listed with what they belong to and why
  Given the file "Attract mode.mp4" of the machine "LG-042" failed as format not indexed and "Eight Ball Schematic" of the machine model "Eight Ball" failed as OpenRouter not reachable
  When a technician opens „Einstellungen“
  Then both failed files are listed with "LG-042" resp. "Eight Ball", their title and their reason
  And each offers „Erneut versuchen“

Scenario: Nothing indexed yet
  Given AI is on and no machine or machine model has a file
  When a technician opens „Einstellungen“
  Then the overview says that no file is indexed for the AI yet
  And no failed file is listed

Scenario: A technician tries a failed file again
  Given AI is on and "Eight Ball Schematic" failed as OpenRouter not reachable
  When a technician taps „Erneut versuchen“ on "Eight Ball Schematic" and OpenRouter answers this time
  Then the technician stays on „Einstellungen“ with the confirmation „Eight Ball Schematic wird erneut für die KI erfasst.“
  And "Eight Ball Schematic" is indexed afterwards and no longer listed as failed

Scenario: Only a failed file can be tried again
  Given "Eight Ball Manual" is indexed
  When a technician sends „Erneut versuchen“ for "Eight Ball Manual" from a page opened while it had failed
  Then nothing is indexed again and no cost is recorded
  And "Eight Ball Manual" is still indexed

Scenario: The daily retry indexes files that failed at OpenRouter again, once a day
  Given AI is on, "Eight Ball Schematic" failed as OpenRouter not reachable on 30.10.2026 and "Wiring notes" failed as OpenRouter refused on 31.10.2026 at 02:00
  When the daily retry runs on 31.10.2026 at 03:00 and OpenRouter answers
  Then "Eight Ball Schematic" is indexed
  And "Wiring notes" is not tried again before the next night's run

Scenario: Files the AI cannot read are tried again only by hand
  Given "Attract mode.mp4" failed as format not indexed and "Damaged manual" failed as not readable
  When the daily retry runs
  Then neither file is indexed again and no cost is recorded for them
  And both are still listed as failed

Scenario: The machine record marks only files the AI cannot read
  Given "LG-042" has the indexed file "Eight Ball Manual", the waiting file "Wiring notes" and the failed file "Attract mode.mp4"
  When a team member opens the machine record of "LG-042"
  Then "Attract mode.mp4" is marked „Für die KI nicht lesbar“
  And "Eight Ball Manual" and "Wiring notes" carry no such mark

Scenario: While AI is off neither the overview nor the mark is shown
  Given 12 files are indexed and "Attract mode.mp4" of "LG-042" failed
  And a technician removed the key, so AI is off
  When a technician opens „Einstellungen“ and the machine record of "LG-042"
  Then no overview „KI-Erfassung“ is shown and "Attract mode.mp4" carries no mark „Für die KI nicht lesbar“
  And „Erneut versuchen“ sent for "Attract mode.mp4" is rejected and nothing is indexed
  And once AI is turned on again the overview and the mark are shown as before

Scenario: Helpers cannot try a failed file again
  Given a helper is logged in and "Eight Ball Schematic" failed
  When the helper sends „Erneut versuchen“ for "Eight Ball Schematic"
  Then it is rejected and nothing is indexed
  And the overview is not shown to the helper, who does not reach „Einstellungen“

## Out of Scope
- Showing which pages or passages a file has in the AI index
- Removing a single file from the AI index without removing the file
- Notifying anyone of a failed file (`docs/product/vision.md`, non-goal: active notifications)

## Open Questions
- none – what is shown while AI is off and the German texts were answered by the user on 2026-10-31
  (`docs/stories/OPEN_QUESTIONS.md`, ST-109).

## Notes
- Depends on ST-108 for the daily retry it extends (the cron job is built there).
