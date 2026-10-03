# UX Guidelines – La Guardia

> **Status: accepted by the user on 2026-10-01.** Every rule below (G1–G21, including G2a, G4a, G6a, G8a and G10a)
> is binding. The last open decision (O2, how much of a wide screen a list may use) was settled in ST-008 and is
> now part of G16. One violation is known and accepted with an end date – it is named under G2a.

The yardstick every screen is measured against. **How** we arrive at a decision is the skill `ux-design`; **what**
the code does with it is `.claude/skills/engineering-conventions/SKILL.md` (the `Page` container, the 360 px rules,
shadcn, `NativeSelect`, where the message catalogs live) – those are not repeated here and not re-decided here.

Short on purpose: read it before writing a page.

## Who we are designing for

From `docs/product/vision.md` – read that, this is only what it means for a screen:

- **A visitor** stands at a machine with a phone they have never used this software on, no account, no patience,
  and wants to be done in under a minute. German or English.
- **A helper** is on the museum floor, one hand on the phone, maybe dirty hands, asking "what can I do right now".
- **A technician** works at the machine on a phone and at the workshop PC on a wide screen, and needs the whole
  history, not a summary.
- Everything is designed at 360 px. The workshop PC gets the same layout, not a second one.
- No offline, no notifications. The screen a person is looking at has to carry the information.

Scale, so we stop designing for numbers that never come: ~50–60 machines, ~60 machine models, ~10 team members,
two technicians. Hundreds of defects over the years, a handful open at a time.

---

## 1. The job

**G1 – One screen, one job, named in the heading.**
A page exists for one thing, and its heading says which. A second job belongs on its own page, or – if it really
must share – in its own section below the first, under its own heading.
*Why:* `/team/members` is "find a person", "change a person" and "create a person" at once, and ends up doing none
of them well.

**G2 – The way to create a thing is reachable without scrolling past everything that already exists.**
On a page that lists things, the way to add one sits directly under the heading, not after the list.
*Why:* at 18 machine models the form starts ~2400 px down; at 34 accounts ~22 000 px. The list grows, the form
walks away.

**G2a – Creating a thing happens on its own page** (user, 2026-10-01).
A list page carries a button directly under its heading ("Neues Modell"), which leads to a page with nothing but
the form. On success the person lands back on the list, with the confirmation of G3; a rejection stays on the form
page, where they are. The list page stays a list, the form page stays a form.
*Why:* the two pages that mix both are the two longest in the application, and on both of them a rejection appears
at a place the person is not looking at.
*Known exception, accepted 2026-10-01:* `/team/machine-models` keeps its form below the list and therefore breaks
this rule. The machine model gets its own page only with **ST-036**, which cannot move forward because two of its
scenario groups need ST-010 and ST-043; the user decided not to split it and not to pull it forward. The exception
ends when ST-036 is done. No new page may copy this shape in the meantime.

**G3 – After a successful action the person sees what changed.**
They land where the result is visible and get a confirmation that names the thing by its own words
("Modell *Medieval Madness* angelegt."), or they land on the new thing's own page. Never the same empty form again.
*Why:* creating a machine model today looks exactly like doing nothing – the list is sorted by title, so the new
model is somewhere in the middle, and no confirmation is shown. The next step is a second attempt and a duplicate.

**G21 – A thing with several possible outcomes offers each one as a button on its own page** (user, 2026-10-03).
Each outcome leads to a form page of its own, which repeats what is being decided about; a rejection stays there
and keeps the input (G8). Every outcome lands in the same place afterwards, with the confirmation of G3. Only the
outcomes the person may choose are shown (G11), in an order fixed by the stories that add them, and none is offered
once the thing is decided.
*First use:* the problem report's page (ST-017) – in this order: „Mit Defekt verknüpfen“ (only when the machine
has open defects), „Defekt erfassen“, „Direkt behoben“, „Meldung verwerfen“ (ST-022, ST-018, ST-019, ST-020).
*Why:* the problem report has four triage outcomes, and the defect page, ST-039 and ST-044 will have more. Four
inline forms on one page at 360 px put the rejection where nobody looks (G8).

## 2. Understanding what you are looking at

**G4 – A list is for finding, not for reading.**
A list that can pass ~20 entries shows how many there are and offers one way to narrow it – a search over the
words people actually know (museum number, title, name), or a filter over a status people actually think in. A
list that cannot pass 20 entries stays plain.
*Why:* a technician opens the account list to find one person, not to read 34 cards.

**G4a – A grouped list shows the groups first, each with how many entries it has** (user, 2026-10-01).
When entries fall into groups, the person first sees the groups with a count each ("Kugeln reinigen · 12 Geräte")
and opens the one they want; the entries themselves come after that choice. A list that puts every entry of every
group on the screen at once is not grouped, it is long.
*Why:* the due-maintenance list (ST-043) is 19 maintenance tasks across up to 60 machines, and recording
maintenance for several machines (ST-045) is ~50 checkboxes in one go – at 360 px both become a wall nobody reads
to the end.

**G5 – A list entry shows only what tells it apart from its neighbours; the actions live on the entry's page.**
At most one action may sit on the entry itself, and only when it is the one thing people come to the list for.
*Why:* every account card carries a role button, a password field and a destructive button, which is what turns
10 team members into 18 screens of scrolling, and puts "Deaktivieren" under every single name.

**G6 – Say what a number or a state means, in words.**
A status, a count or a date is labelled where it stands; the person does not have to know a code or a colour.
*Why:* colours mean nothing on a dim phone in a bright hall, and nothing to someone who sees the screen once.

**G6a – An entry that is singled out says in words why** (user, 2026-10-01).
"Highlighted", "marked" or "at the top" is not a design. The entry carries the reason as text next to it
("seit 14 Tagen offen", "neu seit deinem letzten Besuch", "überfällig"), and the reason is decided in the story
that singles the entry out.
*Why:* ST-017, ST-043, ST-048, ST-050 and ST-058 all say only "highlighted" – five screens where five developers
would each pick a different colour and nobody would learn what it means.

## 3. The states that must exist

**G7 – Empty: say what to do about it.**
"Noch keine Modelle angelegt." is half a screen – the other half is the way to create the first one.
*Why:* the empty case is the first thing every new museum user meets, exactly once, and it is the moment they
decide whether this software helps.

**G8 – Rejected: keep what was typed, name the reason at the form, mark the field.**
A rejected form keeps every value the person typed (never a password – those are never echoed), shows the reason
immediately above the submit button, and marks the field that caused it. The message says what to do next, not
only what was wrong ("Zu viele fehlgeschlagene Versuche. Bitte in 15 Minuten erneut versuchen." is the model).
*Why:* the login empties both fields after a wrong password; the account form loses everything and shows the
reason at the top of a 22 000 px page, where the person never sees it next to the form they just submitted.

**G8a – What the form cannot give back is said, not silently lost** (user, 2026-10-01).
A file or a photo a person chose cannot be put back into the chooser after a rejection. So the rejection says so,
in the same message, and says what to do: "Bitte beschreibe das Problem. Das Foto muss erneut ausgewählt werden."
The chooser shows itself as empty rather than pretending the file is still attached.
*Why:* ST-016 is the first form with a photo, and ST-037, ST-054 and ST-032 follow. A visitor who taps "Senden"
twice because the photo looked attached sends the problem report without it – and never learns why.

**G9 – A rejection is recognisable without colour.**
Red text alone is not a rejection; it carries a marker a person can see in daylight with a cracked screen
protector, and it is announced to screen readers. **The marker is an icon** (user, 2026-10-01): a warning symbol
on a rejection, a tick on a confirmation, from `lucide-react` – the icon library `components.json` already names.
*Why:* the phone is used on the museum floor, not at a desk.
*Not yet true:* today a rejection is red text and nothing else. The icons and the field marking of G8 arrive with
ST-007, which builds the first form on shadcn's `Field` (`data-invalid` on the field, `aria-invalid` on the
control); the four older forms follow in their own tech task.

**G10 – A destructive or irreversible action asks once, and says in words what will happen to whom.**
"Zugang für Anna Berger beenden? Anna wird sofort abgemeldet."
The question names the thing by its own words **and the consequences nobody sees on this screen**: retiring a
machine (ST-039) names the machine, how many defects will be closed and how many problem reports dismissed;
removing a file (ST-038) names the file and says that it is gone for good.
*Why:* "Deaktivieren" is one tap, it ends the person's sessions, and nothing in La Guardia undoes it. Retiring a
machine looks like one tap on one machine and quietly ends every open piece of work on it.
*Triage outcomes* (user, 2026-10-03): a triage outcome is a recorded fact and asks nothing. Dismissing a problem
report as spam deletes bytes – its description and photo – and so asks once, naming what is deleted: „Meldung zu
LG-042 als Spam verwerfen? Beschreibung und Foto werden endgültig gelöscht.“ („Endgültig verwerfen“ / „Zurück“).

**G10a – What a person *sets* to manage access or visibility, they can unset** (user, 2026-10-01, narrowed the
same day).
Deactivating an account is reversible: a technician can activate it again. The same holds for a filter, a mark, a
"nicht ausgestellt". A state a person can switch off and the software cannot switch back on is a bug, not a safety
feature.
**This rule does not cover recorded facts or deleted bytes.** Retiring a machine (ST-039) and removing a file
(ST-038) stay irreversible, and keep **G10's confirmation** instead. The boundary is deliberate: an access or
visibility state says "for now", a recorded fact says "this happened", and undoing a recorded fact would mean
rewriting history rather than changing a setting – a correction is its own command with its own story, not an
undo button. Deleted bytes we simply no longer have.
*Why:* a mistap in a list of ten names locks a colleague out, and the only repair today is a second account for the
same person – which splits their work history in two. Without the boundary written down, the same rule would be
read as "everything has an undo", and the next story would promise one the domain cannot keep.

**G11 – Someone who may not do a thing does not see the control.**
The page shows the rest; the command refuses it anyway (`allowedActors` – the UI never carries the rule alone).
Where a whole page is not theirs, they do not reach it from the navigation.
*Why:* a helper looking at buttons that reject them learns to ignore rejections.
*Already done right:* `src/app/(team)/navigation.tsx` hides technician-only destinations from helpers while the
page and the Team module check the role again – built before G11 existed. That is the pattern later stories copy:
hide in the navigation, and still refuse in the page and in the command.

## 4. The words

**G12 – Every word for a domain thing comes from `CONTEXT.md`, in its `_UI (de)_` wording, and it is the same word
on every screen.**
The person is the **Teammitglied**, their access is the **Konto** (user, 2026-10-01; `Account` is in `CONTEXT.md`
since then). Resetting a password, changing a role and deactivating act on the *Konto*; lists, headings and
navigation are about *Teammitglieder*.
A word the glossary does not have is not invented on a page – it goes into `CONTEXT.md` first, through the
domain-model skill.
*Why:* the account page calls the same thing *Teammitglied* in the title and in the navigation and *Konto* in
every button and every confirmation. Two words, one thing, and no glossary entry decides which.

**G13 – German that a volunteer reads, not a database.**
Team texts use the plain imperative ("Bitte einen Titel angeben."), visitor texts address the person informally
("Bitte beschreibe das Problem."). Nobody is addressed as "Sie". No English in the UI, no technical terms
("Validierungsfehler", "Datensatz", "ID").
*Why:* the people using this are museum volunteers doing it in their spare time.

**G14 – Buttons say what will happen, in the words of the thing.**
"Modell anlegen", "Zugang beenden" – not "Speichern", "OK", "Absenden".
*Why:* on a long page a lone "Speichern" does not say what it saves.

**G20 – An enumeration a person picks from has its German option texts decided in the story that first offers it**
(user, 2026-10-01).
Every option of a choice is written out in that story – the exact German text, in the order they appear, and which
one is preselected. If the options are domain values, they go into `CONTEXT.md` first, through the domain-model
skill, and the story uses the `_UI (de)_` wording; a story never invents a label for a value the glossary does not
have.
*Why:* ST-020, ST-029 and ST-044 each build a choice – dismissal reason, hold reason, maintenance outcome – with
nine option texts nobody has decided. Whoever implements them first writes nine German words into the catalog by
accident, and the next screen uses different ones for the same value.

## 5. Consistency

**G15 – Same thing, same pattern, on every screen.**
Forms, rejections, confirmations, lists and headings follow the same shape everywhere. When a screen needs a new
pattern, the pattern comes here first.
*Why:* two forms with two rejection behaviours (login vs. machine model) is how we got here after five screens.

**G16 – Every screen works at 360 px, and the workshop PC shows the same screen.**
Nothing is tried first on a laptop. One layout, one column, no tables and no side-by-side columns; a **list page may
grow to about 672 px** (`Page wide`, `max-w-2xl`) so long texts stop wrapping, a form page stays at about 384 px
(user, 2026-10-02 – was open decision O2; the first long list is the machine overview, ST-008).

**G17 – Every page is reachable and leaveable.**
Each page either stands in the navigation or is reached from a named link on a page that is, and every page has a
way back without the browser's button.

**G18 – A page several stories add to has one owner story** (user, 2026-10-01).
The owner story fixes the page's sections and their order; every later story adds its content *into* one of those
sections, or adds a new section at a named place – never a second shape for the same page. The owner is named in
the later stories, so a reader knows which story to look at.
*Why:* eleven stories add to the machine record (ST-009, 011, 012, 015, 021, 033, 034, 035, 037, 039, 047) and four
to the dashboards (ST-048, 049, 050, 058). Fourteen things on one phone page, in an order no story decides, is
decided by whoever implements last – and two of those stories render the same list twice.

**G19 – The navigation is decided once, with every destination the product will have** (user, 2026-10-01).
One story names the full set of destinations, their German labels, their order and who sees which; every later
story takes a place in that set and does not invent one. A destination the decided navigation does not have is a
question for the user, not a line a story adds on its way past.
**ST-008 is that story for the team navigation** – decided by the user on 2026-10-02:

| # | Destination | Label | Story | Shown to | Where |
|---|---|---|---|---|---|
| 1 | Start page / dashboard | Übersicht | ST-048/049 (today the team start page) | everyone | line |
| 2 | Machine overview | Geräte | ST-007/008 | everyone | line |
| 3 | Triage list | Sichtung | ST-017 | everyone | line |
| 4 | Open defects | Defekte | ST-021 | everyone | line |
| 5 | Due maintenance | Wartung | ST-043 | everyone | line |
| 6 | Maintenance plan | Wartungsplan | ST-040 | technicians | "Mehr" |
| 7 | Machine models | Modelle | ST-006 | technicians | "Mehr" |
| 8 | Team members | Teammitglieder | ST-005 | technicians | "Mehr" |
| 9 | Own password | Passwort ändern | ST-004 | everyone | "Mehr" |
| 10 | Log out | Abmelden (button) | ST-004 | everyone | "Mehr" |

The daily destinations stand in one line that may wrap; everything that manages sits behind **"Mehr"**, a native
`<details>` that opens without JavaScript. A destination appears with the story that builds it, at its place in this
order – no story adds, renames or reorders one. Implemented in `src/app/(team)/navigation.tsx`.
*Changed 2026-10-03 (user):* row 3 (Sichtung) is shown to everyone, not only technicians. Helpers use the triage
list to resolve problems on the spot (ST-019; ST-017's scenario "Helpers see the triage list without technician
actions"); the technician-only triage outcomes are hidden on the problem report's page instead (G11).
*Why:* ST-007, ST-008, ST-017, ST-021, ST-040 and ST-043 each silently add one. By the end of the MVP the team
navigation needs ~10 destinations; today it is five in two rows at 360 px, and nothing in the backlog decides what
happens at ten.

## 6. Then, and only then, polish

Proportion, rhythm and spacing are the last level. A screen that is ugly but clear ships; a screen that is pretty
and hides the open task does not.

---

## Open decisions

Not decided, not invented. Each needs the user's answer, and then it becomes a rule above, with the date.

None at the moment. O2 became part of **G16** on 2026-10-02.

---

## Changelog

| Date | Change | Reason |
|---|---|---|
| 2026-10-01 | First version proposed, derived from `docs/product/vision.md` and the review of the five existing screens (`docs/reviews/2026-10-01-ux-review-existing-screens.md`) | The user asked for a yardstick before the next screens are built (ST-007 ff.) |
| 2026-10-01 | G9 got its means: an icon from `lucide-react`, and the form layout moves to shadcn's `Field` so a rejection can mark the field it belongs to (`data-invalid`/`aria-invalid`). Neither is built yet – ST-007 is the first form on the new pattern. | The shadcn skill made the gap visible: G8/G9 were rules without anything to implement them with |
| 2026-10-01 | Accepted by the user. O1 became **G2a** (creating happens on its own page), O3 became **G10a** (deactivating is reversible), and the *Teammitglied* / *Konto* split went into **G12** and into `CONTEXT.md` as the new term **Account**. O2 stays open until the first long list (ST-008). | The three decisions the first version deliberately left to the user |
| 2026-10-01 | Backlog grooming (`docs/reviews/2026-10-01-backlog-grooming.md`) added six rules, each from a pile-up in the backlog: **G4a** (grouped lists), **G6a** (say why an entry is singled out), **G8a** (a file chooser cannot be refilled), **G18** (one owner story per shared page), **G19** (the navigation is decided once – ST-008), **G20** (option texts decided where the choice first appears). | 63 stories reviewed at once made visible what no single story review could: 5 stories say only "highlighted", 11 add to the machine record, 6 add a navigation destination, 3 build selects with 9 undecided option texts |
| 2026-10-01 | **G10a narrowed** to states a person *sets* to manage access or visibility; recorded facts and deleted bytes are explicitly out. ST-039 (retiring a machine) and ST-038 (removing a file) stay irreversible and keep **G10**, which now requires the confirmation to name the consequences – for ST-039 the machine, the defects closed and the problem reports dismissed. | Read broadly, G10a would have promised an undo the domain cannot keep; the boundary and its reason are written down so the rule does not quietly stop applying |
| 2026-10-02 | **G19 filled in** with the team navigation for the whole MVP (labels, order, who sees which, "Mehr"), and **O2 became part of G16**: list pages may grow to ~672 px, one column, no tables. | ST-008 is the story both decisions were deferred to; the user decided during `/implement ST-008` |
| 2026-10-01 | **Known exception recorded under G2a**: `/team/machine-models` keeps its form below the list until ST-036. | The user decided not to split ST-036 and not to pull it forward. A yardstick that hides a violation it knows about is worth nothing |
| 2026-10-03 | **G19 row 3 (Triage list, "Sichtung")** is shown to everyone instead of technicians. | Helpers resolve problems on the spot from the triage list (ST-019, ST-017's helper scenario); the technician-only triage outcomes are hidden on the problem report's page (G11). The user decided during `/implement ST-017` |
| 2026-10-03 | **G21 added** (several outcomes: one button each on the thing's page, one form page each, one common landing with a confirmation, only the permitted outcomes, in a fixed order, none once decided; first use the problem report's page). **G10 extended**: a triage outcome asks nothing; dismissing as spam asks once and names the description and photo it deletes. | Story review of ST-018/019/020/022 (`docs/reviews/2026-10-03-story-review.md`, Decisions 1 and 2): four triage outcomes on one 360 px page, more to come on the defect page, ST-039 and ST-044 |
