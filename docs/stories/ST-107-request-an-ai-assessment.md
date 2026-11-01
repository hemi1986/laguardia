---
id: ST-107
title: Request an AI assessment of an open defect
type: story
context: BC-AiAssistance
priority: should
size: L
risk: high
events: [EVT-AiAssessmentRequested, EVT-AiAssessmentWritten]
depends_on: [ST-106]
labels: [ui, feature:ai-assessment]
status: ready
---

## Story
As a team member who works on an open defect, I want to ask for an AI assessment with what I observed and a few photos, so that I get probable causes, what to check first and the pages of the manuals and schematics that may help – without searching through them myself.

## Context
Feature `ai-assessment` (user, 2026-10-31; `docs/domain/events.yaml` **AGG-AiAssessment**, **CMD-RequestAiAssessment**,
**CMD-WriteAiAssessment**, **EVT-AiAssessmentRequested**, **EVT-AiAssessmentWritten**,
**POL-RequestedAiAssessmentIsWritten**, **RM-DefectAiAssessments**, resolved **HS-31**, **FLOW-AiAssessment**;
`docs/architecture/data-model.md`, section *AI assessment*; ADR 0014; ADR 0015). The happy path and who may ask;
failures (an unusable answer included), a write that breaks off and a defect resolved meanwhile are ST-108, earlier AI
assessments ST-111. Revised after the story review `docs/reviews/2026-10-31-ai-assessment-story-review.md` (user,
2026-10-31).

**On the defect page – the section „KI-Einschätzungen“** (RM-DefectAiAssessments), for the whole team, **right below
the defect's actions (G22), above its problem reports and work log entries** – it is what the person is waiting for:
- **The section is shown only if the viewer may request an AI assessment of the defect or the defect has at least one**
  (G37's spirit) – a helper sees no empty section on a defect not suitable for helpers.
- With no AI assessment yet, it offers „KI-Einschätzung anfordern“ and says what it does (G7) – the empty text appears
  only together with the action.
- **While AI is off: no action** – the section is shown only for a defect that already has AI assessments, which stay
  readable (G37).
- This story shows the newest AI assessment of the defect (being written or written); ST-111 adds the earlier ones.

**Who may request** (CMD-RequestAiAssessment; G11 – who may not does not see the action, sees the AI assessments, and
the command refuses them anyway):
- technicians for every **open** defect – on hold included;
- helpers only for an open defect **suitable for helpers**;
- nobody for a **resolved** defect or one **closed on retirement**, and nobody while AI is off (rules; read from Repair
  at the time of the request – a defect resolved right afterwards is ST-108's case, HS-30);
- **no second request while one is being written** – rejected until it is written or failed; the action is not
  offered meanwhile (HS-31). Two requests at the same moment end with one AI assessment being written (set-based rule
  guaranteed by the store, AGG-AiAssessment).

**The request form** – its own page (G2a), reached from the action, back to the defect page afterwards (G3):
- an optional **note** „Was hast du beobachtet / was willst du wissen?“ (user, 2026-10-31);
- optional **photos as on a work log entry** (ST-032's shared photo step: at most 5, downscaled, without location
  metadata, its rejection texts and G8a's sentence that the photos must be chosen again – tested there, not here);
- the note and photos belong to the AI assessment, not to the defect, and never change (invariant).

**After sending (G35):** the team member lands on the defect page at once; the section shows „KI-Einschätzung läuft …“
and the page carries an automatic refresh, which also works without JavaScript, until the AI assessment is written.
Nobody waits on a spinner, and the team member may leave.

**What the chat model is sent** (CMD-WriteAiAssessment): the defect (title, priority, hold reason), the descriptions
of its problem reports and the **10 newest** of their photos (visitors' included – `docs/product/vision.md`), its work
log entries, the machine model (title, manufacturer, year, machine category, technology), the machine's **5 latest
resolved defects** with their closing notes, the note and photos of the request, and what the AI index finds –
searched **only in the files of the defect's machine and its machine model**, only in entries made with the current
embedding model. The text (defect title, descriptions of its problem reports, note of the request) and each photo of the request and of its problem reports are one search each (CMD-WriteAiAssessment); **each search takes the 8 best text
passages and the 4 best pages or images**; the results are merged, each found once, and **cut to 12 pages and images
in total** before they are sent – found pages and images are sent as images (rule: a fixed number, not a setting; user,
2026-10-31; constants in the code). A machine whose files have
nothing in the AI index still gets an AI assessment: the chat model is sent the defect alone. Every request asks only
for providers that neither keep nor train on the data (ADR 0014).

**The written AI assessment** (EVT-AiAssessmentWritten, G38) – in German: a **summary**, the **probable causes**,
ranked, **what to check first**, and the **references** („Fundstellen“) – each the file's title and, for a PDF, the
page, opening the file. It is headed „KI-Einschätzung“ and carries the chat model, the time, who requested it and the
cost, in words and German numbers (G6, G13). It **never changes the defect** – no status, priority, claim or text is
set from it (G38; `docs/product/vision.md`). Every reference names a file of the defect's machine or its machine model
(invariant): **a reference the chat model gives to any other file is dropped** and the AI assessment is written
without it (rule; user, 2026-10-31, story review). An answer without a usable summary fails the AI assessment as
*answer unusable* – ST-108.

**German texts** (user, 2026-10-31, as recommended): section heading „KI-Einschätzungen“; with none yet „Noch keine
KI-Einschätzung. Die KI liest den Defekt, die Meldungen und Arbeitsschritte und die Dateien des Geräts und schlägt vor,
was zuerst zu prüfen ist.“; form heading „KI-Einschätzung anfordern · Left flipper weak“ (G34), note „Was hast du
beobachtet / was willst du wissen? (freiwillig)“, photos „Fotos (freiwillig, höchstens 5)“, the hint „Gesendet werden
der Defekt mit Meldungen, Fotos und Arbeitsschritten, die letzten behobenen Defekte des Geräts und passende Stellen aus
den Dateien des Geräts und seines Modells.“, button „KI-Einschätzung anfordern“; while written „KI-Einschätzung läuft …
Die Seite aktualisiert sich von selbst.“; parts „Zusammenfassung“, „Wahrscheinliche Ursachen“, „Zuerst prüfen“,
„Fundstellen“ („Eight Ball Manual, S. 12“); line „KI-Einschätzung · Gemini 2.5 Flash · 31.10.2026, 14:05 · angefordert
von Tom · 0,04 $“; rejections „Für diesen Defekt läuft schon eine KI-Einschätzung.“ and „Eine KI-Einschätzung gibt es
nur für offene Defekte.“

**Interface:** usual page width (G16), the form heading „<job> · <thing>“ (G34), a rejection keeps the note (G8, G8a).

**Definition of done** (not scenarios):
1. The photos use the shared photo step of a work log entry (ST-032) – its limit and kept input are tested there.
2. The normal review lane plus `/security-review` – visitors' descriptions and photos leave La Guardia for the first
   time, and the chat model's answer is untrusted structured input (ADR 0014, *Consequences*: OpenRouter's terms and
   data processing terms are confirmed and the privacy notice says so before real data is sent).

## Acceptance Criteria

Scenario: A technician asks for an AI assessment with a note and photos
  Given AI is on and the open defect "Left flipper weak" of "LG-042" has no AI assessment
  When a technician asks for an AI assessment of "Left flipper weak" with the note "Coil gets hot after 10 minutes" and two photos
  Then the technician is back on the defect page at once, which says „KI-Einschätzung läuft …“
  And the page carries an automatic refresh, also without JavaScript, until the AI assessment is written
  And the AI assessment keeps the note and both photos, and "Left flipper weak" is unchanged

Scenario: The written AI assessment says what it found, that it is AI, and what it cost
  Given an AI assessment of "Left flipper weak" requested by Tom was written with the chat model "Gemini 2.5 Flash"
  When a team member opens the defect "Left flipper weak"
  Then the section „KI-Einschätzungen“ shows a summary, the probable causes in their order and what to check first
  And it lists the reference "Eight Ball Manual" with page 12, which opens that file
  And it names the chat model "Gemini 2.5 Flash", when it was written, "Tom" and its cost

Scenario: The chat model is sent what is known about the defect
  Given the open defect "Left flipper weak" of "LG-042" has a problem report with a description and a photo, a work log entry, and "LG-042" has a resolved defect with a closing note
  When a technician asks for an AI assessment with the note "Coil gets hot" and one photo
  Then the chat model is sent the defect's title and priority, the problem report's description and photo, the work log entry, the machine model's details, the resolved defect with its closing note, the note and the photo
  And the pages and images found in the AI index are sent as images

Scenario: What is sent to the chat model is capped
  Given the open defect "Left flipper weak" of "LG-042" has problem reports with 14 photos and "LG-042" has 7 resolved defects with closing notes
  And the AI index holds more than 12 pages and images of "LG-042" and "Eight Ball" that match
  When an AI assessment of "Left flipper weak" is written from a note and two photos
  Then the AI index is searched three times, each search taking at most 8 text passages and 4 pages or images
  And the chat model is sent never more than 12 pages and images from the AI index, none of them twice
  And it is sent only the 10 newest problem report photos and the 5 latest resolved defects with their closing notes

Scenario: Only the files of the defect's machine and its machine model are searched
  Given "LG-042" and "LG-043" are both an "Eight Ball", and the manuals of "LG-042", of "LG-043", of the machine model "Eight Ball" and of another machine model are indexed
  When an AI assessment of a defect of "LG-042" is written from a note and a photo
  Then the AI index is searched with the note and with the photo, in the files of "LG-042" and "Eight Ball" only
  And no reference names the manual of "LG-043" or of the other machine model

Scenario: A reference to a file outside the defect's machine and its machine model is dropped
  Given an AI assessment of "Left flipper weak" of "LG-042" is being written
  When the chat model answers with a summary and the references "Eight Ball Manual" page 12 and the manual of "LG-043"
  Then the AI assessment is written with the reference "Eight Ball Manual" page 12 only
  And its summary, probable causes and what to check first are as the chat model answered

Scenario: A helper asks for an AI assessment of a defect suitable for helpers
  Given AI is on, "Ball stuck in shooter lane" is open and suitable for helpers, "Display flickers" is open, not suitable for helpers and has an AI assessment, and "Drop target slow" is open, not suitable for helpers and has none
  When a helper asks for an AI assessment of "Ball stuck in shooter lane"
  Then it is being written
  And „KI-Einschätzung anfordern“ is not offered to the helper on "Display flickers", whose AI assessment the helper still sees
  And no section „KI-Einschätzungen“ is shown to the helper on "Drop target slow"
  And a request the helper sends for "Display flickers" is rejected and records nothing

Scenario: Only an open defect can be assessed, on hold included
  Given AI is on, "Display flickers" is on hold, "Left flipper weak" is resolved and "Coin door jammed" was closed on retirement
  When a technician opens each of the three defects
  Then „KI-Einschätzung anfordern“ is offered on "Display flickers" only
  And a request sent for "Left flipper weak" or "Coin door jammed" is rejected and records nothing

Scenario: A second request while one is being written is rejected
  Given an AI assessment of "Left flipper weak" is being written
  When a technician opens "Left flipper weak"
  Then „KI-Einschätzung anfordern“ is not offered
  And a request with the note "Coil gets hot" sent from a form opened before is rejected with a reason saying an AI assessment is already being written, and the note is still in the form
  And only one AI assessment of "Left flipper weak" is being written

Scenario: While AI is off nothing about AI assessments is offered
  Given AI is off
  And the open defect "Left flipper weak" has no AI assessment and "Display flickers" has a written one
  When a technician opens both defects
  Then "Left flipper weak" shows no section „KI-Einschätzungen“
  And "Display flickers" shows its AI assessment without „KI-Einschätzung anfordern“
  And a request sent for "Left flipper weak" is rejected and records nothing

## Out of Scope
- Failures with their reasons (*answer unusable* included), „Erneut versuchen“, a write that breaks off, a defect
  resolved meanwhile, a referenced file removed later, the daily retry (ST-108)
- Earlier AI assessments on the defect page and AI assessments in the repair history (ST-111)
- Follow-up questions, rating an AI assessment, AI in triage, automatic AI assessments, AI for visitors
  (`docs/product/vision.md`, out of the first version)

## Open Questions
- none – the numbers sent, the section's place and the German texts were answered by the user on 2026-10-31
  (`docs/stories/OPEN_QUESTIONS.md`, ST-107).

## Notes
- Spike ST-105 (2026-11-01): `google/gemini-2.5-flash` has no zero-data-retention endpoint on OpenRouter (every request fails with "No endpoints found matching your data policy") – the scenarios' „Gemini 2.5 Flash“ is a display name only; `~google/gemini-flash-latest` accepted 27 images in one request (12 + 10 + 5 fit), ≈ 1.090 tokens per small image. Its reasoning counts against the answer limit: a limit of 20 tokens returned no text, so the answer limit must leave room for it.
- OpenRouter is an external system behind the AI seam (ADR 0014); the scenarios describe behaviour, the tests use the
  in-memory stand-in and drive one run of the background work directly (ST-112's run function, ADR 0015). Seams
  outside the catalog: the structured-answer parser (unit test); the page refresh is covered by the catalog row
  "page flow".
- The background work, its holds and its self-continuation are built in ST-112; this story adds AI assessments as a
  kind of work a run takes before waiting files (ADR 0015).
- The caps (12 pages and images, 10 problem report photos, 5 request photos) are checked against the chat model's
  image limit by the spike ST-105.
- If L proves too large in `/implement`, the cut is the request photos and the per-photo search (scenarios 1, 3, 4, 5)
  into a follow-up (story review 2026-10-31).
