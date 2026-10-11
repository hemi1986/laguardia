# ST-023 – UX proposal: a technician reports a problem and records a defect in one step

**ux-designer, 2026-10-10.** Answers the `[OPEN]` paragraph of ST-023 and its row in `docs/stories/OPEN_QUESTIONS.md`
(2026-10-10). Nothing here is decided: the user approves, the requirements-engineer applies the story lines, and the
approved rule goes into `docs/product/ux-guidelines.md` as **G21a**.

Read against: `docs/product/ux-guidelines.md` (G1, G3, G8, G8a, G11, G12, G14, G15, G17, G18, G20, G21), ST-015,
ST-018, ST-022, ST-052, `src/app/(team)/team/machines/[museumNumber]/melden/`,
`src/app/(team)/team/triage/[problemReportId]/` and `src/platform/messages/team.de.ts`.

Already fixed (user, 2026-10-10), so not asked again: `CMD-ReportProblem` itself rejects a technician's problem
report that has no triage outcome. Nothing changes for helpers in ST-023. The problem report and its defect are
stored together or not at all.

---

## The one thing that decides the rest

ST-023 adds one outcome. ST-052 (`ready`, must, S) adds two more to the same step: *link* (choose one of the
machine's open defects) and *resolve on the spot* (a note). So the form has to be designed for **three outcomes**,
even though only one ships now. Otherwise ST-052 redesigns the page.

The forms have to work without JavaScript, and without JavaScript a field cannot appear only after an outcome is
chosen. So on a single page every field of every outcome is visible at once. With ST-052 that page would hold:
description, photo, three outcome choices, the list of open defects, title, priority, the helper mark, the status
and the note. That is the shape **G21** was written to prevent ("Four inline forms on one page at 360 px put the
rejection where nobody looks").

---

## 1. Where

| Option | What the technician does | For | Against |
|---|---|---|---|
| **A** – same page `/melden`, a section „Sichten“ with the outcome as radio buttons and the defect fields below it (the test plan's proposal) | Problem melden → fill in the description → tap „Defekt erfassen“ → fill in the defect → send | One page. Fewest changes for ST-023 alone. | With ST-052 the page shows the fields of all three outcomes at once (no JavaScript), so you have to work out which fields apply. A note typed under „Direkt behoben“ while „Defekt erfassen“ is chosen gets ignored without a word, or needs a rule of its own. The rejection sits more than two screens below the description. Breaks G21 from ST-052 on. |
| **B** – **G21 applied to reporting**: for a technician, `/melden` offers the outcomes as buttons, and each one leads to a form page of its own (`/melden/defekt-erfassen`) with the problem report's fields *and* that outcome's fields. One send, everything stored together. | Problem melden → „Defekt erfassen“ → fill in description and defect → send | The same pattern, the same words and the same order as the problem report's page (G15, G21). Each page is short and the rejection is near its field. The UI cannot send a report without an outcome. ST-052 only adds buttons and pages, and changes nothing that ST-023 built. | One extra tap that decides nothing while only one outcome exists (ST-023 to ST-052). A "no outcome" rejection can only come from a page loaded before the change (see 4). |
| C – two steps: report first, triage on a following page | Problem melden → send → triage page | Reuses the triage form pages unchanged | Ruled out. Either the report is stored before its triage (against the user's "together or not at all"), or the description and the photo have to be carried across a page change, and a chosen photo cannot be carried without storing it. |

**Recommendation: B.** The extra tap in ST-023 is the price of ST-052 adding pages without changing any. There are
two technicians, and in return each of them gets short forms whose rejection is in view. B2 (going straight to the
defect form while there is only one outcome, with the choice page added in ST-052) saves the tap but moves the
redesign into ST-052. I would not do it.

For a **helper**, `/melden` stays exactly ST-015's form (G11: no outcome is offered). How a helper reaches *Direkt
behoben* in the same step is ST-052's decision, not this one.

## 2. The outcome choice

- On `/melden`, for technicians only: a section **„Sichten“**. This is the same heading as on the problem report's
  page (`triage.outcomes`).
- One button per outcome, in G21's order without „Meldung verwerfen“ (ST-023 Out of Scope: dismissing your own find
  makes no sense):
  1. „Mit Defekt verknüpfen“ – only when the machine has open defects (ST-052). Otherwise the page says „LG-042 hat
     keine offenen Defekte.“, as on the problem report's page (G7).
  2. **„Defekt erfassen“** – ST-023, the only one for now.
  3. „Direkt behoben“ – ST-052.
- Buttons, so nothing is preselected. Choosing is the tap that opens the form page. The label is the glossary's
  wording (*Defekt*, *Direkt behoben*). No new term is needed.
- Under the heading, one sentence says why there is a choice at all:
  „Meldungen von Techniker:innen werden gleich beim Melden gesichtet.“

If the user picks **A** instead: radio buttons under the legend „Sichten“, none preselected, in the same order and
with the same labels, and „Defekt erfassen“ is the only one for now.

## 3. The defect fields

These are **exactly ST-018's form „Defekt erfassen“**, with the same texts and defaults (G15). Only the problem
report's fields come before them.

| Section | Field | As in | Default |
|---|---|---|---|
| **Meldung** | Beschreibung, hint **„Was ist kaputt, wo am Gerät?“** | ST-015, but without ST-015's second hint sentence „Eine Techniker:in sichtet die Meldung.“, which is false for the technician who is triaging it right now | empty |
| | Foto (freiwillig) – „Foto aufnehmen“, „Foto auswählen“ | ST-016 | none |
| **Defekt** | Titel, hint „Wird Besucher:innen am Gerät angezeigt – kurz und verständlich.“ | ST-018 | empty, **not** prefilled from the description. The description is for the team and the title is for visitors. |
| | Priorität: „hoch“, „normal“, „niedrig“ | ST-018 | „normal“ |
| | „Für Helfer:innen geeignet“ | ST-018 | not set |
| | Status: the sentence „LG-042 ist zurzeit Spielbereit.“, then „Status nicht ändern“ plus **only the stricter statuses** | ST-018 / `CMD-RecordDefect` | „Status nicht ändern“ |

The machine status rule is the same as in ST-018, unchanged: *Spielbereit* offers „Eingeschränkt“ and „Außer
Betrieb“, and *Eingeschränkt* offers only „Außer Betrieb“. For *Außer Betrieb* and *Nicht ausgestellt* there is no
choice, only the sentence „LG-042 ist schon Außer Betrieb – der Status bleibt.“ Team members may report for a
machine that is not on display (ST-015), so the *Nicht ausgestellt* case does occur here, unlike in triage, where it
is rare. There is no reason field, because the status history's reason is the defect's title.

Not shown: the triage list, other problem reports, "who reported" (that is the technician themselves).

## 4. Texts (German, team catalog)

**Choice page `/melden` (technician)**
- Heading: „Problem melden · LG-042“ (unchanged, ST-015)
- Machine line: „LG-042 · Medieval Madness“ (as on the triage form pages)
- Section: „Sichten“, with the sentence „Meldungen von Techniker:innen werden gleich beim Melden gesichtet.“
- Button: „Defekt erfassen“
- Back: „Zurück zum Gerät“

**Form page `/melden/defekt-erfassen`**
- Heading: **„Problem melden und Defekt erfassen · LG-042“**. G1 allows two jobs that must share a page if they come
  in sections. The heading names both jobs, so it is not mistaken for the triage page „Defekt erfassen · LG-042“,
  which acts on a report that already exists. It wraps to two lines at 360 px, which is acceptable.
- Section headings: „Meldung“, „Defekt“ (glossary *Problem report* / *Defect*)
- Submit: **„Melden und Defekt erfassen“** (G14: it says that both happen)
- Back: „Zurück zum Gerät“ (G17). It does not lead back to the choice page, because that is one tap from the machine
  record anyway.

**Rejections, shown above the submit button with the field marked (G8):**

| Cause | Text | Note |
|---|---|---|
| No description | „Bitte beschreibe das Problem.“ | existing text (see finding 5) |
| No title | „Bitte einen Titel angeben.“ | existing |
| Machine retired in the meantime | „LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“ | ST-018's text. The choice page is not shown for a retired machine (ST-015). |
| Status changed by someone else in the meantime (no longer stricter / version) | existing `machine-status-not-stricter` / `version-conflict` texts | unchanged |
| **No triage outcome** (new) | **„Bitte wählen, wie die Meldung gesichtet wird. Es wurde nichts gespeichert.“** | Under B this happens only when a technician sends ST-015's plain form from a page loaded before the change, or before their role changed. They then see the choice page with this message above the buttons. Under B, the typed description cannot be kept here, because the description was typed on a different page. This is a narrow exception to G8, and it should be accepted explicitly or not at all (Question 1). Under A, the message stands above the submit button, the outcome choice is marked and everything typed is kept. |
| **Any rejection while a photo was attached** (G8a) | the reason, followed by **„Das Foto muss erneut ausgewählt werden.“**, e.g. „Bitte einen Titel angeben. Das Foto muss erneut ausgewählt werden.“ | This matters more here than on ST-015's form. The photo is more than one screen above the submit button, and a forgotten title is the likeliest rejection. |

The rejection "already triaged" cannot happen here, because the problem report is new.

**Confirmation, on the machine record:** ST-018's text unchanged (G15), so one defect always produces one sentence:
„Defekt „Linker Flipper hängt“ an LG-042 erfasst.“ When the status was changed, it is followed by
„ LG-042 ist jetzt Eingeschränkt.“ ST-015's „… wartet auf die Sichtung.“ must **not** appear, because here it would
be false.

## 5. Where the technician lands

| Option | For | Against |
|---|---|---|
| **Machine record + confirmation** | Same landing as ST-015, so the same entry has the same exit (G21: every outcome lands in the same place; ST-052's outcomes will land there too). The technician is still at the machine. The new status is visible in the details and in the status history. For the second fault (scenario "Two faults…"), „Problem melden“ is right at the top. | The machine record has no open-defects section yet (open question ST-009/ST-021, 2026-10-04), so the confirmation is the only place on that page where the new defect appears. |
| Defect's own page (ST-021) | G3's "the new thing's own page". The defect is visible with its originating report. | It leads away from the machine, its way back is „Zurück zu den Defekten“, and the second fault needs three taps back. The status change is not visible there. |
| Triage list (ST-018's landing) | – | Wrong: the report never appears there (the story's own scenario). |

**Recommendation: the machine record, with ST-018's confirmation naming the defect, the machine and the new status
(G3).** The missing open-defects section is already an open question, and when it is answered the new defect becomes
visible there by itself.

## 6. 360 px and the photo

- At 360 px the form page is about two and a half screens: the description, the photo with its preview, title,
  priority, the mark and the status. That is acceptable for a technician, and it is why B keeps every other
  outcome's fields off this page.
- **The photo (G8a).** Every rejection empties the file chooser, and that cannot be avoided. The chooser already shows
  itself as empty after a rejection, which is the half of G8a that exists. The other half is the sentence in the
  rejection (above). Without it, a technician corrects the title, sends again and stores the report without the
  photo. Nothing tells them, because the chooser is out of view.
- Without JavaScript no photo is sent and the report still is (ST-016, accepted). Everything else on both pages is
  native: the outcome buttons are links, the priority and status are a native select, and the mark is a checkbox.
- The submit stays disabled while a photo is being prepared (ST-016's behaviour, kept).

---

## Findings

| Story / screen | Level | Severity | Finding | What to do instead |
|---|---|---|---|---|
| ST-023 | job | blocker | No screen is decided: entry, outcome choice, fields, landing and confirmation are all `[OPEN]`. A technician cannot report at all once `CMD-ReportProblem` rejects a report without an outcome. | Apply sections 1–5 (option B) as Context lines and the scenarios below. |
| ST-023 | states | major | No scenario for: what a technician is offered when reporting, the helper's unchanged form, the rejected form keeping its input, the landing and confirmation, the stricter-status choice on this form, the machine retired in the meantime. | Scenarios below. |
| ST-023 | language | major | "the technician is asked to choose an outcome" has no decided text. | „Bitte wählen, wie die Meldung gesichtet wird. Es wurde nichts gespeichert.“ |
| ST-023 / ST-015 `/melden` | language | major (from ST-023 on) | The hint „… Eine Techniker:in sichtet die Meldung.“ and the confirmation „… wartet auf die Sichtung.“ become false for a technician. | Technicians do not see ST-015's form (B). Their form's hint is „Was ist kaputt, wo am Gerät?“ and their confirmation is ST-018's. |
| ST-015/ST-016 report forms (team `…/melden/report-problem-form.tsx`, visitor `src/app/m/[museumNumber]/melden/`) | states | major | G8a is half built: after a rejection the chooser shows itself as empty, but the rejection does not say that the photo must be chosen again („Bitte beschreibe das Problem.“ only). | Every rejection of a form that had a photo attached ends with „Das Foto muss erneut ausgewählt werden.“ (team) / visitor DE same, EN „Please choose the photo again.“. ST-023 builds it for its own form. The two existing forms need a small follow-up, or a line in ST-023 if the user wants it in one go. |
| team catalog `commandErrors["description-required"]` | language | minor | „Bitte beschreibe das Problem.“ addresses the reader as *du* in the team UI. G13 asks team texts to use the plain imperative („Bitte einen Titel angeben.“). | Team: „Bitte das Problem beschreiben.“ The visitor text stays as it is. This does not block ST-023. Change it together with the G8a follow-up. |
| Machine record (ST-009) | understanding | minor | After ST-023 the new defect is visible on the machine record only in the confirmation. | Already in OPEN_QUESTIONS (ST-009/ST-021, 2026-10-04). Nothing new to add. |

## Proposed for ST-023 (for the requirements-engineer)

**Context lines** (they replace the `[OPEN]` paragraph once the user has approved):

> **Form (ux-designer proposal `docs/reviews/ST-023-ux-form.md`, approved by the user on <date>; G21a):** for a
> technician, „Problem melden“ on the machine record (ST-015) leads to `/team/machines/<museum number>/melden`. That
> page does not show ST-015's form to a technician. Under the heading „Problem melden · LG-042“ it shows a section
> „Sichten“ with the sentence „Meldungen von Techniker:innen werden gleich beim Melden gesichtet.“ and one button per
> outcome the technician may choose, in the order „Mit Defekt verknüpfen“ (ST-052, only with open defects), „Defekt
> erfassen“, „Direkt behoben“ (ST-052). ST-023 adds only „Defekt erfassen“.
> It leads to a page of its own, „Problem melden und Defekt erfassen · LG-042“, with the sections „Meldung“
> (Beschreibung with the hint „Was ist kaputt, wo am Gerät?“, Foto (freiwillig)) and „Defekt“ (exactly ST-018's
> fields, defaults and status rule: title empty with ST-018's hint, priority „normal“ preselected, „Für Helfer:innen
> geeignet“ not set, the current status in words, „Status nicht ändern“ preselected plus only the stricter
> statuses, or the sentence that the status stays). It has the submit „Melden und Defekt erfassen“ and the link
> „Zurück zum Gerät“.
> A rejection stays on that page, keeps what was typed and marks the field (G8). When a photo was attached, the
> rejection adds „Das Foto muss erneut ausgewählt werden.“ (G8a).
> No outcome (only from a page loaded before): „Bitte wählen, wie die Meldung gesichtet wird. Es wurde nichts
> gespeichert.“, shown on the choice page.
> On success the technician is back on the machine record with ST-018's confirmation („Defekt „<title>“ an LG-042
> erfasst.“, followed by „ LG-042 ist jetzt <status>.“ when the status was changed). ST-015's „… wartet auf die
> Sichtung.“ is not shown.
> Helpers keep ST-015's form unchanged, and no outcome is offered to them (G11).

**Scenarios** (in addition to the four that exist; the existing "Technician's problem report needs a triage outcome"
could add `And the message asks to choose how the problem report is triaged`):

```gherkin
Scenario: Technicians are offered the triage outcome when reporting
  Given a technician is logged in
  When the technician starts reporting a problem from the machine record of "LG-042"
  Then recording a defect is offered as the triage outcome
  And a problem report without a triage outcome cannot be sent from there

Scenario: Helpers report as before
  Given a helper is logged in
  When the helper starts reporting a problem from the machine record of "LG-042"
  Then no triage outcome is offered
  And the problem report can be sent with a description only

Scenario: Only a stricter machine status when reporting
  Given the machine "LG-042" is Limited
  When a technician reports a problem for "LG-042" and records a defect in the same step
  Then the form says that "LG-042" is currently Limited
  And besides not changing the status, only Out of order is offered
  And not changing the status is preselected

Scenario: A rejected report keeps what was typed
  Given a technician reports "Left flipper coil stop broken" for "LG-042" and records a defect with the priority high, the suitable-for-helpers mark set, the machine status Out of order and no title
  When they submit it
  Then neither the problem report nor a defect is stored
  And the reason is shown at the form, with the title marked
  And the description, the priority, the mark and the machine status they chose are still there

Scenario: A rejected report says the photo must be chosen again
  Given a technician reports a problem for "LG-042" with a photo and records a defect without a title
  When they submit it
  Then nothing is stored
  And the rejection says that the photo must be chosen again

Scenario: Machine retired in the meantime stores nothing
  Given a technician has the form for reporting a problem for "LG-042" and recording a defect open
  And "LG-042" was retired a moment ago
  When the technician submits it
  Then neither the problem report nor a defect is stored
  And the technician stays at the form and is told that "LG-042" is retired by now and nothing was saved

Scenario: After reporting, the technician is back on the machine record
  Given the machine "LG-042" is Playable
  When a technician reports a problem for "LG-042" and records the defect "Left flipper sticks" with the machine status Limited in the same step
  Then the machine record of "LG-042" is shown
  And a confirmation names the defect "Left flipper sticks" and the machine "LG-042"
  And the confirmation says that "LG-042" is now Limited
  And it does not say that the problem report waits for triage
```

**For ST-052 (a Context line, no change in scope):** its outcomes „Mit Defekt verknüpfen“ and „Direkt behoben“
become buttons in the section „Sichten“ of `/melden`, in ST-023's order, each with a form page of its own that also
has the problem report's fields, and each lands on the machine record. How a helper reaches „Direkt behoben“ in
the same step is ST-052's open UX point.

## Guideline I would add (after approval)

**G21a – Creating a thing and deciding its outcome in the same step follows G21, with the thing's own fields on
every outcome page.**
When a person may create a thing and decide its outcome at once, the page they reach first offers the outcomes as
buttons (G21's order and labels). Each outcome leads to one form page that has the thing's fields and that
outcome's fields, and sends them once. Every outcome lands where creating the thing alone would have landed, with
the outcome's confirmation. Someone who may not decide sees the plain form (G11).
*Why:* without JavaScript, a single page shows every outcome's fields at once. With ST-052 the technician's report
form would carry three outcomes' fields under one submit, which is the shape G21 rules out (ST-023, 2026-10-10).

## Gaps

- **G8a is a rule that two shipped forms only half follow**, and ST-037, ST-054 and ST-032 will copy them. It needs
  a check in the browser tests, or at least the follow-up named above.
- **G13 against the shared texts:** the team catalog takes over the visitor's *du* text for the same error code.
  When a code exists for both audiences, which wording wins in the team UI? Recommendation: each catalog has its own
  wording, written in the voice of its audience.
- **Same page, different content per role** (`/melden`: the form for helpers, the choice for technicians) is new.
  G11 covers hiding a control, not swapping what a page is for. G21a above covers this case. Watch for a second case
  before making it a general rule.
