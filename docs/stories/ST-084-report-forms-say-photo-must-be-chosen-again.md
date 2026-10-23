---
id: ST-084
title: Report forms say that the photo must be chosen again after a rejection
type: story
context: BC-Repair
priority: could
size: XS
risk: low
events: [EVT-ProblemReported]
depends_on: [ST-013, ST-015, ST-016, ST-023]
labels: [follow-up, triage, ui]
status: in-progress
---

## Story
As a team member or visitor who attached a photo to a problem report, I want a rejection to tell me that the photo must be chosen again, so that I don't send the corrected problem report without the photo I meant to attach.

## Context
Follow-up of ST-023 (ux-designer, `docs/reviews/ST-023-ux-form.md`, findings 5 and 6; user, 2026-10-10, during `/implement ST-023`: not in ST-023, a small follow-up). `CMD-ReportProblem`: description is required, photo is optional. No rule of the command changes – only what the two existing report forms say.
- **G8a is half built** on the two existing report forms – the team form `/team/machines/<museum number>/melden` (ST-015, ST-016) and the visitor form `/m/<museum number>/melden` (ST-013, ST-016): after a rejection the photo chooser shows itself as empty, but the rejection does not say that the photo must be chosen again. A chosen photo cannot be put back into the chooser, so the rejection says so in the same message (G8a): the reason, followed by „Das Foto muss erneut ausgewählt werden.“ (team and visitor German), „Please choose the photo again.“ (visitor English). Without a photo attached the sentence is not added.
- **G13 wording** of the missing description in the team catalog: „Bitte beschreibe das Problem.“ addresses the reader as *du*; team instructions use the plain infinitive (G13), so the team text becomes „Bitte das Problem beschreiben.“ The visitor text stays „Bitte beschreibe das Problem.“ The team text is shared by ST-023's form (`/melden/defekt-erfassen`), which shows the new wording too once this story is done.
- ST-023 builds G8a for its own new form; this story brings the two existing forms in line with it. ST-037, ST-054 and ST-032 follow the same rule for their own photo and file forms.
- **After a rejection of the photo itself** (not an image, above 20 MB, ST-016) the sentence is not added: ST-016's texts apply unchanged, they already ask to choose another photo or leave it out (user, 2026-10-10, story review decision 3a; the same holds for ST-023's form). The sentence follows every other rejection of a form that had a photo attached.

## Acceptance Criteria

Scenario: Team report form says the photo must be chosen again
  Given a helper reports a problem for "LG-042" from its machine record with a photo and without a description
  When they submit it
  Then the problem report is not stored
  And the rejection reads „Bitte das Problem beschreiben. Das Foto muss erneut ausgewählt werden.“
  And the photo chooser shows no photo

Scenario: Visitor report form says the photo must be chosen again
  Given a visitor reports a problem for "LG-042" in German with a photo and without a description
  When they submit it
  Then the problem report is not stored
  And the rejection reads „Bitte beschreibe das Problem. Das Foto muss erneut ausgewählt werden.“

Scenario: Visitor report form in English says the photo must be chosen again
  Given a visitor reports a problem for "LG-042" in English with a photo and without a description
  When they submit it
  Then the problem report is not stored
  And the rejection reads "Please describe the problem. Please choose the photo again."

Scenario: No photo sentence without a photo
  When a helper reports a problem for "LG-042" without a photo and without a description
  Then the problem report is not stored
  And the rejection reads „Bitte das Problem beschreiben.“ and says nothing about a photo

Scenario: A rejected photo gets no extra sentence about choosing it again
  Given a helper reports "Left flipper weak" for "LG-042" from its machine record with a file that is not an image
  When they submit it
  Then the problem report is not stored
  And the rejection reads ST-016's text unchanged: „Das ist kein Foto. Bitte ein Foto wählen oder es weglassen.“
  And it does not add that the photo must be chosen again
  And the description "Left flipper weak" is still there

## Out of Scope
- ST-023's own form (`/melden/defekt-erfassen`) – ST-023 builds G8a for it
- Keeping the photo across a rejection (cannot be done; G8a)
- Photo and file forms of ST-032, ST-037, ST-054

## Open Questions
- none (the sentence after a rejection of the photo itself was answered on 2026-10-10: not added)

## Notes
- Expected to be small (XS/S; lead-dev estimates): two message catalogs and the rejection on two forms. Estimated XS, risk low in the backlog grooming of 2026-10-17 (`withPhotoToChooseAgain` exists); the English scenario checks the full text there (all reviewers).
- Plan notes (lead dev, story review 2026-10-17): `withPhotoToChooseAgain` lives in the team route today (`src/app/(team)/team/machines/[museumNumber]/melden/report-and-triage.ts`); it moves to a shared place, because the visitor form must not import from `(team)`. Existing assertions of ST-015 and ST-023 on the old team wording „Bitte beschreibe das Problem.“ change legitimately to „Bitte das Problem beschreiben.“ – that is this story's change, not a weakened test.
- Depends on ST-023 because it shares that story's rejection text and its G8a helper (lead dev, story review 2026-10-17).
