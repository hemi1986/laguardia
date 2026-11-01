---
id: ST-109
title: See how far the AI index got and try failed files again
type: story
context: BC-AiAssistance
priority: should
size: M
risk: medium
events: [EVT-FileIndexedForAi, EVT-FileIndexingFailed, EVT-AiWorkLeftUnfinished]
depends_on: [ST-106]
labels: [ui, feature:ai-assessment]
status: ready
---

## Story
As a technician, I want to see which files the AI can read, which are still waiting and which it cannot read and why, and to try a failed file again, so that I know what the AI assessments rely on and what indexing has cost.

## Context
Feature `ai-assessment` (user, 2026-10-31; `docs/domain/events.yaml` **RM-AiSettings**, **RM-MachineRecord**,
**CMD-IndexFileForAi** (by hand), **EVT-FileIndexedForAi**, **EVT-FileIndexingFailed**, **EVT-AiWorkLeftUnfinished**,
**POL-UnfinishedAiWorkFails**, resolved **HS-32**, **HS-35**; `docs/architecture/data-model.md`, section *AI index
entry*; ADR 0015). Revised after the story review `docs/reviews/2026-10-31-ai-assessment-story-review.md` (user,
2026-10-31) and after decision D3 of `docs/reviews/2026-11-01-story-review.md` (user, 2026-11-01): no cron job and no
automatic retry of failed files.

**The overview „KI-Erfassung“ in the form „KI“** on „Einstellungen“ (RM-AiSettings; `CONTEXT.md`: *AI index* –
„KI-Erfassung“, *AI index entry* – „Für die KI erfasst / Wartet auf KI-Erfassung / Für die KI nicht lesbar“),
technicians only (G11; helpers do not reach the page, ST-104), below the AI settings:
- how many files are **indexed** (an entry for the current embedding model), **waiting** (no such entry – derived) and
  **failed**, counting only files that are not removed (data model);
- the **failed files**, each with its machine (museum number) or machine model, its title and its reason
  (*not readable*, *format not indexed*, *OpenRouter refused*, *OpenRouter not reachable*, *broken off*), and
  „Erneut versuchen“;
- the **cost of indexing so far** – everything OpenRouter charged for indexing, replaced entries included (data model).

**„Erneut versuchen“ on a failed file** – CMD-IndexFileForAi run by hand: a technician may run it **only on a file that
failed** (rule), only while AI is on; the indexing runs in the background (ADR 0015, ST-112), the technician stays on
the page with a confirmation (G3) and the file counts as waiting until it is indexed or fails again.

**A failed file stays failed** (HS-32, user 2026-11-01, D3): whatever the reason, it is tried again only by hand with
„Erneut versuchen“ – or indexed again by a change of the embedding model (ST-110) – and leaves the list when it is
removed. No run takes it by itself (ST-106).

**A broken-off indexing (POL-UnfinishedAiWorkFails, EVT-AiWorkLeftUnfinished; D3, HS-35):** an indexing cut off with
its run (a crash, a deployment, the time limit – on Vercel Hobby a PDF of more than ≈ 280 pages) stores nothing. Once
its hold has run out without a result, the next run – whatever started it – records the file failed with the reason
*broken off* before it takes new work, reads and sends nothing, and drops the hold (the generic step is ST-112's; this
story records it for files through CMD-IndexFileForAi). A file removed meanwhile records nothing. Until a run has done
that, the file counts as waiting. **Opening the form „KI“ starts that run** (HS-35): when a technician opens
„Einstellungen“ with AI on and a hold of a file has run out without a result, the page calls the start function of
ST-112 after its response – never otherwise, so opening it does not start work on every load; the file shows as failed
on the next load. The machine record stays as it is until then.

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
erreichbar“ (not readable „Datei lässt sich nicht lesen“, OpenRouter refused „OpenRouter hat abgelehnt“, broken off
„Erfassung abgebrochen“ – the UI word „abgebrochen“ from `CONTEXT.md`, user 2026-11-01); empty „Noch
keine Datei für die KI erfasst.“; „Erneut versuchen“, confirmation „Eight Ball Schematic wird erneut für die KI
erfasst.“ (no nested quotes).

**Interface:** German numbers and the cost in German notation (G13).

**Definition of done** (not scenarios): the normal review lane – a command and a new path into `CMD-IndexFileForAi`
by hand, so not the light lane – plus `/security-review` (opening „Einstellungen“ may start paid work, as the defect
page of ST-108 does).

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

Scenario: An indexing that broke off shows as failed and can be tried again by hand
  Given AI is on and the run indexing "Eight Ball Manual" of the machine model "Eight Ball" was cut off
  And the hold on "Eight Ball Manual" has run out without a result, and no other run has started since
  When a technician opens „Einstellungen“
  Then the opening starts a run, which records "Eight Ball Manual" failed as broken off and sends nothing of it to OpenRouter
  And on the next load the failed files list „Eight Ball · Eight Ball Manual – Erfassung abgebrochen“ with „Erneut versuchen“
  And no later run indexes "Eight Ball Manual" again until a technician taps „Erneut versuchen“
  And opening „Einstellungen“ again starts no run, since no hold has run out

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
- A cut-off indexing and its expired hold are driven with the injected clock and one run of the background work
  (ST-112's run function, ADR 0015) – no test waits and no test renders a PDF too large for a run.
- No longer depends on ST-108: the dependency was for the daily retry, removed by D3 (user, 2026-11-01). The generic
  broken-off step comes from ST-112 through ST-106. Feature order unchanged: ST-108 is built before ST-109.
- Size M, risk medium – re-checked after D3: two scenarios of the daily retry out, one broken-off scenario with the
  start from „Einstellungen“ in; 9 scenarios.
