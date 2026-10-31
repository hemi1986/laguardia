# UX Guidelines – La Guardia

> **Status: accepted by the user on 2026-10-01, amended since – last on 2026-10-31.** Every rule below (G1–G39,
> including G2a, G4a, G6a, G8a, G10a, G10b, G10c and G21a) is binding. One violation is known and accepted: the
> unchanged-form rejections of ST-031 and ST-036, named under G33. The exception under G2a ended with ST-036. The changes of 2026-10-25 (G16's one width, G26 dark design, G27 grouped
> checkboxes, G28 account pages, and with it G10, G10a and G10b, and G29–G34) are decided but not built yet – the screens
> contradict them until the stories of that day's `/feature` are done.

The yardstick every screen is measured against. **How** we arrive at a decision is the skill `ux-design`; **what**
the code does with it is `docs/engineering/conventions.md` (the `Page` container, the 360 px rules,
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
*Known exception, accepted 2026-10-01, ended with ST-036:* `/team/machine-models` kept its form below the list until
the machine model got its own pages (ST-036, done). Creating a model is now „Neues Modell“ under the heading.

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
has open or recently resolved defects – *extended 2026-10-17, grooming, ST-053*: linking may reopen a recently
resolved defect), „Defekt erfassen“, „Direkt behoben“, „Meldung verwerfen“ (ST-022, ST-018, ST-019, ST-020).
*Why:* the problem report has four triage outcomes, and the defect page, ST-039 and ST-044 will have more. Four
inline forms on one page at 360 px put the rejection where nobody looks (G8).

**G21a – Creating a thing and deciding its outcome in the same step follows G21, with the thing's own fields on
every outcome page** (user, 2026-10-10, ST-023/ST-052).
When a person may create a thing and decide its outcome at once, the page they reach first offers the outcomes as
buttons, in G21's order and with G21's labels, and has no submit of its own. Each outcome leads to one form page
that has the thing's fields and that outcome's fields, and sends them once; both are stored together or not at
all. Every outcome lands where creating the thing alone would have landed, with the outcome's confirmation.
Someone who may not decide sees the plain form (G11). Someone who may decide only one outcome and may also leave it
undecided keeps the plain form as the default, with that outcome offered as one button above the first field.
*First use:* reporting a problem from the machine record (`/melden`). A technician gets the section „Sichten“ with
„Mit Defekt verknüpfen“ (only with open defects), „Defekt erfassen“, „Direkt behoben“ (ST-023, ST-052); a helper
keeps ST-015's form, with „Schon selbst behoben?“ and the button „Direkt behoben“ above the description (ST-052).
*Why:* without JavaScript, a single page shows every outcome's fields at once. With ST-052 the technician's report
form would carry three outcomes' fields under one submit, which is the shape G21 rules out. The button sits above
the first field because a link does not carry what was already typed.

**G22 – The defect's page offers the work as buttons and the managing behind one fold** (user, 2026-10-12).
The page of an open defect has two groups of actions, and no story puts an action anywhere else:
- **Work**, directly under the header, for everyone who may (G11), in this order: „Übernehmen“ – or „Von Tom
  übernehmen“ when someone else holds the claim, or „Abgeben“ in the same place when the claim is one's own ·
  „Arbeitsschritt eintragen“ · „Beheben“ · „Pausieren“ – or „Fortsetzen“ in the same place when the defect is on
  hold.
- **„Verwalten“**, technicians only, a closed fold that opens without JavaScript (a native `<details>`, like „Mehr“
  in G19): „Zuweisen“, „Übernahme von Tom aufheben“, „Priorität ändern“, „Titel und Eignung ändern“.

A resolved defect offers only „Wieder öffnen“, under its „Abschlussnotiz“.
Claiming, releasing and „Fortsetzen“ are one tap, each landing on the defect's page with its confirmation (G3);
every other action has its form page (G21). *„Fortsetzen“ added 2026-10-17 (grooming, ST-029):* resuming has
nothing to ask – the hold reason was given when pausing. Nothing here asks first – these
are signals and recorded facts, not destructive actions (G10). The header says a hold in words („Pausiert – Wartet
auf Ersatzteil“, G6).
The order of the actions is the order of `defectActions` in `src/modules/repair/defect-actions.ts`; a story adds
its action at its place in this guideline, never somewhere it picks.
*Built:* all of them (ST-024–ST-031).
*Why:* five more actions arrive on this page with ST-026, ST-027, ST-029, ST-030 and ST-031 – eight or nine on a
360 px page, in an order no story decides. A helper should see at most four buttons and no fold.

**G28 – A team member's page shows the account; changing it is one form page** (user, 2026-10-25, `/feature`
grilling; changes ST-081's shape).
The team member's page shows only their details – name, username, role, whether the *Konto* is active – and the
buttons. „Konto bearbeiten“ leads to one form page with name, username, role and „Neues Passwort“; left empty, the
password stays as it is. The form page is headed „Konto bearbeiten · Anna Berger“ (G34) and sent with „Konto
speichern“ (G14). For the last active technician the role cannot be changed, and the form says why where the choice
would be. A rejection stays on the form and keeps everything but the password (G8).
**One's own account** (user, story review 2026-10-25, ST-088): its edit page shows the role without a choice – „Die
eigene Rolle kann nur eine andere Techniker:in ändern.“ – and has no „Neues Passwort“, only a link to „Passwort
ändern“ (G19 row 10). This also covers the last active technician editing their own account. After saving, the person is back on the team
member's page with „Konto von Anna Berger gespeichert.“ (G3).
„Konto deaktivieren“ and „Konto wieder aktivieren“ are **one tap on the team member's page, with no question page**
(G10a, G10b), and the page confirms as before („Konto von Anna Berger deaktiviert.“). Neither is offered where the
command would refuse it (G11) – and one's own page offers no „Konto deaktivieren“ at all.
*Why:* the user's decision – deactivating „einfach machen“. A mis-tap on someone else's account is undone by one tap
on „Konto wieder aktivieren“ (G10a), so a question in front of it only costs time. On one's own account it cannot be
undone by oneself: deactivating logs the person out at once, and only another technician can activate it again – so
the button is not there to be mis-tapped. The edit page replaces ST-081's separate forms for role and password with
one place where an account is changed.

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

**G27 – Choosing many out of a long list: checkboxes in groups that fold** (user, 2026-10-25, `/feature` grilling).
When a person picks several entries out of a list, every entry is a checkbox and the entries sit in groups. Each group
folds and opens without JavaScript (a native fold, like „Mehr“ in G19), is closed when the page opens, and its header
names the group and how many of it are chosen („Flipper · EM – 4 von 6 ausgewählt“). With JavaScript the header also
offers „Alle auswählen“ for that group; without JavaScript that control is not shown and the person ticks the entries
one by one (user, 2026-10-25). After a rejection every choice is kept (G8) and every group with a choice in it is
open, so the person sees what they sent.
The header's count follows each tick only with JavaScript; without it the count says what was chosen when the page
opened. A group without an entry is not shown. Groups come in the order of `CONTEXT.md` (machine category, then
technology); the maintenance tasks of one machine are grouped by interval, the shortest first. Inside a group,
machines are listed by museum number and maintenance tasks by name. An entry that cannot become due says so after it
(„LG-042 · Medieval Madness · Nicht ausgestellt“) (user, story review 2026-10-25).
*Uses:* the machines of a maintenance task, grouped by machine category and technology; the maintenance tasks of one
machine, grouped by interval; the machines of the QR sticker selection, grouped by machine category and technology;
and „Für mehrere Geräte erfassen“, where the group „Fällig“ stays open and ticked when the page opens and the further
machines fold by machine category and technology (user, 2026-10-25). The words are `CONTEXT.md`'s (*Machines of a maintenance task*): the
section „Geräte der Wartungsaufgabe“, the buttons „Geräte ändern“ and „Wartungsaufgaben ändern“; in the maintenance
plan a task says how many machines it applies to – „Gilt für 12 Geräte“, „Gilt für kein Gerät“.
*Why:* it is G4a for a choice – 60 machines as one list of checkboxes is the wall G4a rules out, and the count in the
closed header says what was chosen without opening anything.

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

**G24 – History on a record shows the latest five and links to the rest** (user, 2026-10-17, story review
2026-10-17).
A section of a record that shows history lists the 5 latest entries and below them a link „Alle … (n)“ to a page of
its own, headed with what it is and the machine („… · LG-042“). That page groups its entries by year with a count per
year once it can pass about 20 entries (G4, G4a), and has „Zurück zum Gerät“ (G17).
*Sources:* the shape of the repair history; ST-047 (maintenance on the machine record), later ST-037.
*Why:* a machine collects years of maintenance and repairs; on a phone the full history in the record buries every
section below it, and without one shape each history would pick its own cut-off and its own way to the rest.

**G25 – A change on a dashboard is one line that says who did what, and when, in words** (user, 2026-10-17, story
review 2026-10-17).
Each change is one line naming who and what, ending with when it happened in words („· vor 2 Tagen“), newest first.
One's own changes are never listed.
*Sources:* ST-086 (what changed on the helper's claimed defects), ST-058 (recent changes), ST-050.
*Why:* three stories list changes on the dashboards; a date or a code makes the person work out how old it is (G6),
and seeing what one did oneself is noise that hides what others did.

**G38 – AI output says it is AI, and says what it cost and who asked** (user, 2026-10-31, feature `ai-assessment`).
Everything an AI wrote is headed with what it is („KI-Einschätzung“, `CONTEXT.md`'s wording) and carries the chat
model, the time, who requested it and the cost, in words and German numbers (G6, G13). It never changes domain data
by itself: no status, priority, claim or defect text is set from it – a team member does that with the ordinary
actions, with the assessment on screen.
*Why:* a volunteer must not mistake a guess for a fact recorded by a colleague, and the cost is the technicians' reason
to decide how freely to use it.

**G39 – Earlier entries of the same kind: the newest expanded, older ones collapsed** (user, 2026-10-31, feature
`ai-assessment`).
When a page keeps several entries of one kind (the AI assessments of a defect), they are listed newest first; the
newest is open, every older one is a fold that opens without JavaScript, with the same look as every fold (G31) and a
header that says what it is and when („KI-Einschätzung vom 31.10.2026“, G6). This is for entries a person wants to
read, not for history lines: a history of recorded facts follows G24.
*Why:* the newest is the one that matters now, the older ones are there to compare; all of them open would bury the
rest of a 360 px defect page.

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
*Not when the photo itself is rejected* (user, 2026-10-10, ST-023/ST-084): when the rejection is about the photo
(ST-016's texts – not an image, over 20 MB), ST-016's text stands alone and the sentence „Das Foto muss erneut
ausgewählt werden.“ is not added – ST-016's texts apply unchanged.

**G33 – A form sent unchanged is not a rejection** (user, story review 2026-10-25).
When a person sends a change form without changing anything, it lands where a save lands, with a confirmation that
states the resulting state – not a rejection asking them to change something.
*Known exception, accepted 2026-10-25:* ST-031 („Titel und Eignung sind unverändert. Bitte etwas ändern.“) and
ST-036 („Am Modell hat sich nichts geändert. Bitte etwas ändern.“) are done and reject an unchanged form. They keep
doing so until a story touches those forms; no new form copies them.
*Why:* opening a form to check a value and sending it again is a normal thing to do, not a mistake; a rejection for
it reads like an error the person made.

**G9 – A rejection is recognisable without colour.**
Red text alone is not a rejection; it carries a marker a person can see in daylight with a cracked screen
protector, and it is announced to screen readers. **The marker is an icon** (user, 2026-10-01): a warning symbol
on a rejection, a tick on a confirmation, from `lucide-react` – the icon library `components.json` already names.
*Why:* the phone is used on the museum floor, not at a desk.
*Built:* every rejection and confirmation carries its icon, and the forms mark the field (shadcn's `Field`,
`data-invalid` on the field, `aria-invalid` on the control) – ST-007 first, the older forms since.

**G23 – A partial success says what worked and, line by line, what did not** (user, 2026-10-17, grooming).
When one action covers several things and only some succeed, the landing page shows one confirmation for what
worked („„Clean glass“ an 3 Geräten eingetragen.“) and below it one rejection line per thing that did not, naming
the thing and its reason. Nothing that succeeded is rolled back to hide a failure, and nothing that failed is left
out.
*Source:* ST-045 (recording maintenance for several machines).
*Why:* a single confirmation hides the machines that were not recorded – their task stays due and nobody knows why;
a single rejection hides that most of them were.

**G35 – Background work a person started is a state on the page where it belongs** (user, 2026-10-31, feature
`ai-assessment`).
Work that runs after the tap (an AI assessment being written) shows on the page of the thing it belongs to, in words
that say it is running („KI-Einschätzung läuft …“). The person lands there at once, is never made to wait on a
spinner and can leave; the page refreshes itself until the work is done, so the result is there when they look again.
When the work fails, the same place says so with the reason in German – „KI-Einschätzung fehlgeschlagen: <Grund>“ –
and offers „Erneut versuchen“. A failed run is a state of the page, not a rejection of a form (G8) and not a
confirmation (G3).
*Why:* no notifications (vision): the screen the person looks at has to carry the information. A request that
returns before the work is done must still say where the work is, or it looks like nothing happened (G3).

**G36 – A secret a person saves is never shown again** (user, 2026-10-31, feature `ai-assessment`).
After saving, a secret (the OpenRouter API key) appears only as its last four characters („…a1b2“) with the actions
„Ersetzen“ and „Entfernen“. The field for a new secret is empty, it is never filled back after a rejection (as G8
says for passwords), and no page, message or link ever contains the secret.
*Why:* a key on the screen of a shared workshop PC or in a screenshot is a key given away; the last four characters
are enough to tell which key is saved.

**G37 – A feature that depends on a setting is absent while the setting is off, not disabled** (user, 2026-10-31,
feature `ai-assessment`).
While AI is off there is no „KI-Einschätzung anfordern“, no empty „KI-Einschätzungen“ section and no greyed-out
substitute. Content that already exists (earlier AI assessments) stays visible and readable. This is G11's logic for
a setting instead of a role: what cannot be done is not offered. The settings form that switches the feature on
(„KI“ on „Einstellungen“) says what is missing.
*Why:* a disabled button asks a question the helper cannot answer; an empty section is noise on a phone page. What
was written while AI was on is still the record of that defect.

**G10 – A destructive or irreversible action asks once, and says in words what will happen to whom.**
„LG-042 ausmustern? 2 offene Defekte werden geschlossen. Das lässt sich nicht rückgängig machen.“
How the question is shown is G10b. The question names the thing by its own words **and the consequences nobody sees on this screen**: retiring a
machine (ST-039) names the machine, how many defects will be closed and how many problem reports dismissed;
removing a file (ST-038) names the file and says that it is gone for good.
*Why:* retiring a machine looks like one tap on one machine and quietly ends every open piece of work on it.
*Changed 2026-10-25 (user, `/feature` grilling):* deactivating an account is reversible and no longer asks – it is
one tap (G28). It was this rule's example until then („Konto von Anna Berger deaktivieren? Anna wird sofort
abgemeldet.“, ST-081).
*Triage outcomes* (user, 2026-10-03): a triage outcome is a recorded fact and asks nothing. Dismissing a problem
report as spam deletes bytes – its description and photo – and so asks once, naming what is deleted: „Meldung zu
LG-042 als Spam verwerfen? Beschreibung und Foto werden endgültig gelöscht.“ („Endgültig verwerfen“ / „Zurück“).

**G10a – What a person *sets* to manage access or visibility, they can unset** (user, 2026-10-01, narrowed the
same day).
Deactivating an account is reversible: a technician can activate it again. The same holds for a filter, a mark, a
"nicht ausgestellt". A state a person can switch off and the software cannot switch back on is a bug, not a safety
feature. *Since 2026-10-25 (user, `/feature` grilling)* this is what lets deactivating be one tap without a question
(G28): the repair for a mis-tap is the next tap, not a question before every tap.
**This rule does not cover recorded facts or deleted bytes.** Retiring a machine (ST-039) and removing a file
(ST-038) stay irreversible, and keep **G10's confirmation** instead. The boundary is deliberate: an access or
visibility state says "for now", a recorded fact says "this happened", and undoing a recorded fact would mean
rewriting history rather than changing a setting – a correction is its own command with its own story, not an
undo button. Deleted bytes we simply no longer have.
*Why:* a mistap in a list of ten names locks a colleague out, and the only repair today is a second account for the
same person – which splits their work history in two. Without the boundary written down, the same rule would be
read as "everything has an undo", and the next story would promise one the domain cannot keep.

**G10b – The question before an irreversible action is a page of its own** (user, 2026-10-17, grooming).
Submitting the action leads to a page with nothing but the question of G10: it names the thing by its own words and
the consequences nobody can see from where they are, and offers two buttons – the verb („Endgültig ausmustern“,
„Endgültig entfernen“, „Endgültig verwerfen“) and „Zurück“. „Zurück“ returns to the form unchanged, with everything
that was typed. Only the verb button carries the action out.
*Sources:* the spam question (G10), ST-038, ST-039, ST-041.
*Why:* four stories ask before an irreversible action, and without JavaScript a question cannot pop up over the
form. Without one shape, each would pick its own – and a „Zurück“ that loses the reason just typed punishes the
person for checking.
„Endgültig …“ is said only for what cannot be undone.
*Exception: G10c* – content that can be uploaded again is removed without this page.
*Amendment of 2026-10-17 withdrawn on 2026-10-25 (user, `/feature` grilling):* deactivating an account had its own
question page with „Konto deaktivieren“ / „Zurück“ (ST-081). It is now one tap on the team member's page, without a
question (G28), because it is reversible (G10a).

**G10c – Removing content that can be uploaded again is one step, with no question page** (user, 2026-10-31, feature
`museum-start-page`, ST-102). An explicit exception to G10 and G10a.
The museum's logo, in the form „Logo“ on „Einstellungen“ (G19 row 9a), is removed by one tap on „Logo entfernen“. The page confirms as in G3 and
shows that there is no logo now (G7). The question page of G10b is not shown.
The exception holds only for content a person can put back at any time by uploading it again and that is not the
history of a machine. Anything else that deletes stored content keeps G10 and G10b – a file on a machine's record
(ST-038) is not covered by this exception unless the user decides it separately.
*Why:* nothing is lost that cannot be restored by uploading again, so a question in front of the tap only costs time
(the same reasoning as G28 for a reversible action). The logo is not a recorded fact about a machine, and G10a's
boundary – recorded facts and deleted bytes stay irreversible – exists to protect exactly that.

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
Team instructions use the plain infinitive („Bitte einen Titel angeben.“, „Bitte die Seite neu laden.“), visitor
texts address the person informally („Bitte beschreibe das Problem.“). Confirmations and dashboards in the team UI
may address the person with *du* („neu seit deinem letzten Besuch“, „Gerade ist nichts für dich offen.“). Numbers
are written the German way („2,5 Tage“). Nobody is addressed as "Sie". No English in the UI, no technical terms
("Validierungsfehler", "Datensatz", "ID").
*Clarified 2026-10-17 (grooming):* the rule said "imperative" and meant the infinitive of its own example; the
built `version-conflict` text („Bitte lade die Seite neu …“) shows the word was ambiguous. *Du* is allowed where a
screen speaks to one person; German decimals are needed since ST-051 („2,5 Tage“).
*Why:* the people using this are museum volunteers doing it in their spare time.

**G14 – Buttons say what will happen, in the words of the thing.**
"Modell anlegen", "Konto deaktivieren" – not "Speichern", "OK", "Absenden".
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

**G34 – A form page's heading is „<job> · <thing>“** (user, story review 2026-10-25).
The heading names the job first, then the thing it is done to, after „ · “: „Defekt beheben · LG-042“, „Konto bearbeiten
· Anna Berger“, „Wartungsaufgabe ändern · Wax playfield“, „Modell korrigieren · Medieval Madness“. Every form page
follows it, including those built before the rule.
*Why:* the form pages named their job in two grammars – „Status von LG-042 ändern“ next to „Priorität ändern · LG-042“
(audit 2026-10-25, F4).

**G16 – Every screen works at 360 px, and the workshop PC shows the same screen, at one width.**
Nothing is tried first on a laptop. One layout, one column, no tables and no side-by-side columns. **Every page –
list, form, record, dashboard, the login and the visitor pages – has the same maximum width of about 672 px** (what
`Page wide` is today), and a form's fields use the whole width of that column (user, 2026-10-25, `/feature`
grilling). Pages made for printing – the QR sticker sheet – follow the paper, not this rule.
The submit button of a form page spans the whole column like the fields; buttons on a record or a list are as wide
as their words (user, 2026-10-25).
*Changed 2026-10-25:* until then a list page grew to about 672 px while a form page stayed at about 384 px (user,
2026-10-02 – was open decision O2, ST-008).
*Why:* on the workshop PC every step from a list to its form page and back made the page jump between two widths –
the user found it inconsistent. One width is one page.

**G26 – The interface is dark, unless a team member switched their device to light** (user, 2026-10-25, `/feature`
grilling).
Every page – team pages, the login, the visitor pages – opens in the dark design, whatever the phone or PC is set to.
A team member switches under „Mehr“ in the team navigation, with an entry that names the design it switches to:
„Helles Design“ while the page is dark, „Dunkles Design“ while it is light. It sits between „Passwort ändern“ and
„Abmelden“ (G19) and is a small form, so it works without JavaScript. After the tap they are on the same page.
The choice belongs to the device, not to the account – the workshop PC and a phone can differ. Visitor pages are
always dark and offer no switch. The QR sticker sheet stays light, on screen and on paper. The team pages get no
language switch – the team UI stays German only (user, 2026-10-25).
No page depends on one design: nothing on it has a colour of its own, every control – checkbox, choice list, file
chooser, date field, a fold – is in the design of the page around it, and G6 and G9 hold in both.
*Why:* the user's decision. The entry names the design it leads to because a button says what will happen (G14) –
an entry naming the current design reads like a status. Per device, as decided: switching at the workshop PC leaves
the phone as it is.

**G29 – A section of a record or a dashboard has one shape: framed, with a title** (user, 2026-10-25, `/feature`
grilling).
Every section of a record or a dashboard sits in its own frame with its title at the top, the same heading level
everywhere; under it the section's empty sentence when there is nothing (G7), and its one link or button at its end.
*Why:* the machine record and both dashboards are framed, the defect page, the histories and the repair times are
plain – the two records a technician uses most looked like two applications (audit 2026-10-25, F5).

**G30 – Red is for the button that does what cannot be undone** (user, 2026-10-25, `/feature` grilling).
Only the verb button on a question page (G10b) – „Endgültig ausmustern“, „Endgültig entfernen“, „Endgültig
verwerfen“ – is red. A button that leads to such a question, and every reversible action („Konto deaktivieren“, G28),
looks like any other secondary button.
*Why:* red on „Konto deaktivieren“ but not on „Gerät ausmustern“ said the opposite of what each does (audit
2026-10-25, F11); red that means "cannot be undone" only works when it means nothing else.

**G31 – Every fold looks the same** (user, 2026-10-25, `/feature` grilling).
„Mehr“ (G19), „Verwalten“ (G22) and the groups of G27 are one kind of fold: the same marker, which shows whether it is
open or closed, in both designs (G26).
*Why:* „Mehr“ and „Verwalten“ had two different markers, and G27 adds a third fold (audit 2026-10-25, D3).

**G32 – A filter is applied with „Filtern“** (user, 2026-10-25, `/feature` grilling).
Every filter form is sent with a button „Filtern“, and a filter's checkbox is applied by that button – never by
another form's button such as „Suchen“.
*Why:* „Anzeigen“, „Filtern“ and „Suchen“ applied filters on four lists, and the machine overview's „Auch
ausgemusterte Geräte anzeigen“ only took effect through „Suchen“ (audit 2026-10-25, F6).

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
*The dashboards* (user, 2026-10-12):
- **ST-048 owns the technician dashboard.** Sections in this order: problem reports to triage · machines not
  playable without open defects · stale claims (ST-058) · overdue maintenance (ST-058) · recent changes (ST-058).
- **ST-049 owns the helper dashboard.** Sections in this order: my claimed defects · open defects suitable for
  helpers · due maintenance for helpers.
- **ST-050 adds no section**: it marks entries in the existing ones as „neu seit deinem letzten Besuch“ (G6a).
- **Neither dashboard repeats the due maintenance list.** It names each maintenance task with a count and links to
  „Wartung“ (G4a, G19 row 5), where the list lives.

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
| 7 | Repair times | Reparaturzeiten | ST-051 | technicians | "Mehr" |
| 8 | Machine models | Modelle | ST-006 | technicians | "Mehr" |
| 9 | Team members | Teammitglieder | ST-005 | technicians | "Mehr" |
| 9a | Settings | Einstellungen | ST-100 (as „Museumseinstellungen“), feature `ai-assessment` | technicians | "Mehr" |
| 10 | Own password | Passwort ändern | ST-004 | everyone | "Mehr" |
| 11 | Log out | Abmelden (button) | ST-004 | everyone | "Mehr" |

The daily destinations stand in one line that may wrap; everything that manages sits behind **"Mehr"**, a native
`<details>` that opens without JavaScript. A destination appears with the story that builds it, at its place in this
order – no story adds, renames or reorders one. Implemented in `src/app/(team)/navigation.tsx`.
*Changed 2026-10-03 (user):* row 3 (Sichtung) is shown to everyone, not only technicians. Helpers use the triage
list to resolve problems on the spot (ST-019; ST-017's scenario "Helpers see the triage list without technician
actions"); the technician-only triage outcomes are hidden on the problem report's page instead (G11).
*Changed 2026-10-17 (user, backlog grooming):* row 7 (Reparaturzeiten, ST-051) added right after „Wartungsplan“,
technicians only – the repair times had no destination (`docs/reviews/2026-10-17-backlog-grooming.md`, section 9
item 3). Recorded here when ST-051 was built (2026-10-25).
*Changed 2026-10-25 (user, `/feature` grilling):* „Mehr“ gets the design switch of G26 – „Helles Design“ /
„Dunkles Design“, for everyone. It is not a destination but an entry like „Abmelden“, and it sits between row 10
„Passwort ändern“ and row 11 „Abmelden“.
*Changed 2026-10-31 (user, feature `ai-assessment`):* row 9a added and renamed – the destination built as
„Museumseinstellungen“ (ST-100) is **„Einstellungen“** (`CONTEXT.md`: *Settings*), with the forms „Museum“, „Logo“,
„Rechtstexte“ and „KI“, each saved on its own. It is numbered 9a so the row numbers other guidelines cite stay valid.
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
| 2026-10-10 | **G21a added** (creating a thing and deciding its outcome in one step: a choice page with one button per outcome, one form page each with the thing's fields, sent once and stored together; a person who may decide only one outcome and may leave it undecided keeps the plain form with that outcome as one button above the first field). **G8a narrowed**: no photo sentence after a rejection of the photo itself (ST-016's texts). | Story review of ST-023/ST-052 (`docs/reviews/2026-10-10-story-review.md`, Decision 3a; proposal `docs/reviews/ST-023-ux-form.md`, option B, and the helper path H2) |
| 2026-10-12 | **G22 added**: the defect's page offers the work as buttons under the header (claim or release · work log entry · resolve · put on hold or resume) and the managing behind the fold „Verwalten“ for technicians (assign, release someone else's claim, priority, title and suitability); a resolved defect offers only „Wieder öffnen“. The order is the order of `defectActions`. | Backlog grooming of 2026-10-11 (`docs/reviews/2026-10-11-backlog-grooming.md`, section 6, decision 5): ST-026, ST-027, ST-029, ST-030 and ST-031 bring five more actions to a page that has three – eight or nine at 360 px, in an order no story decides |
| 2026-10-12 | **G18 extended with the dashboards**: ST-048 owns the technician dashboard, ST-049 the helper dashboard, each with its sections in a fixed order; ST-050 marks entries and adds no section; neither dashboard repeats the due maintenance list – a maintenance task with a count and a link to „Wartung“. | Same grooming, section 6: four stories add to the dashboards (ST-048, 049, 050, 058), and G18 named the problem without naming the owners or the order |
| 2026-10-17 | **G10b added** (the question before an irreversible action is a page of its own: the thing, the unseen consequences, „Endgültig …“ / „Zurück“, and „Zurück“ returns to the form unchanged). **G23 added** (partial success: one confirmation for what worked, one rejection line with its reason per thing that did not, on the landing page). **G13 clarified** (infinitive in team instructions, *du* allowed in confirmations and dashboards, German numbers). **G10's example corrected** to *Konto* (G12). **G21's condition** for „Mit Defekt verknüpfen“ extended to open or recently resolved defects (ST-053). **G22**: „Fortsetzen“ is one tap like claiming and releasing. | Backlog grooming of 2026-10-17 (`docs/reviews/2026-10-17-backlog-grooming.md`, section 6 last bullet, section 9 decisions 3 and 6): the spam question, ST-038, ST-039, ST-041 and ST-081 each ask before an irreversible action; ST-045 is the first partial success; ST-051 brings decimals; ST-053 lets linking reopen; the user decided „Fortsetzen“ is one tap (ST-029) |
| 2026-10-17 | **G10b amended**: a reversible action that ends someone's access (deactivating an account, ST-081) uses the same question page, with a verb button without „Endgültig“ („Konto deaktivieren“ / „Zurück“). **G24 added** (history on a record: the 5 latest entries, „Alle … (n)“ to a page of its own grouped by year once it grows, „Zurück zum Gerät“). **G25 added** (change lines on a dashboard: who, what, when in words, newest first, never one's own). | Story review of 2026-10-17 (`docs/reviews/2026-10-17-story-review.md`, "Proposed guideline changes" and Decisions item 3): ST-081 is reversible, ST-047 brings the second history to the machine record, ST-086/ST-058/ST-050 list changes |
| 2026-10-25 | **G16 changed**: every page has the same maximum width (~672 px, one column, form fields across the whole column); print pages are out. Was: lists ~672 px, forms ~384 px. | User, `/feature` grilling 2026-10-25: the two widths looked inconsistent on the workshop PC |
| 2026-10-25 | **G26 added**: dark design by default on every page regardless of the system setting; team members switch per device under „Mehr“ with „Helles Design“ / „Dunkles Design“ (the design it switches to) and stay on the page; visitor pages dark without a switch; the sticker sheet light; no page depends on one design. | User, `/feature` grilling 2026-10-25 |
| 2026-10-25 | **G28 added** (a team member's page: details and buttons only; „Konto bearbeiten“ leads to one form with name, username, role, „Neues Passwort“ – empty keeps it; the last active technician's role fixed with the reason; „Konto von Anna Berger gespeichert.“). **Deactivating and activating are one tap without a question page**; one's own page has no „Konto deaktivieren“. So **G10b's amendment of 2026-10-17 is withdrawn**, **G10's example** is now retiring a machine, and **G10a** says reversibility is what makes the one tap safe. Changes ST-081's shape. | User, `/feature` grilling 2026-10-25 („einfach machen“): deactivating is reversible (G10a); on one's own account a mis-tap locks oneself out, which only another technician can undo |
| 2026-10-25 | **G27 added** (choosing many out of a long list: checkboxes in groups that fold without JavaScript, closed by default, header with the group and „4 von 6 ausgewählt“, „Alle auswählen“ per group, after a rejection the choices kept and their groups open). First uses: the machines of a maintenance task (by machine category and technology) and a machine's maintenance tasks (by interval); wording „Geräte der Wartungsaufgabe“, „Geräte ändern“, „Wartungsaufgaben ändern“, „Gilt für 12 Geräte“ / „Gilt für kein Gerät“. | User, `/feature` grilling 2026-10-25; G15 – a new pattern comes here first |
| 2026-10-25 | Answers to the consistency audit's questions: **G16** – a form page's submit button spans the column like the fields, buttons on records and lists as wide as their words. **G27** – „Alle auswählen“ only with JavaScript (without it the control is not shown, entries are ticked one by one); the sticker selection and „Für mehrere Geräte erfassen“ follow G27 („Fällig“ open and ticked, further machines fold by machine category and technology). **G26 / G19** – the design switch is a small form that works without JavaScript, between „Passwort ändern“ and „Abmelden“; no language switch on team pages. **G28** – the edit page is headed „Konto von Anna Berger bearbeiten“, its button „Konto speichern“. | User, `/feature` grilling 2026-10-25 (`docs/reviews/2026-10-25-ux-audit-consistency.md`, questions 1–3 and the open points) |
| 2026-10-25 | **G29 added** (sections of records and dashboards: framed, with a title), **G30 added** (red only for the verb on a question page that does what cannot be undone), **G31 added** (one look for every fold: „Mehr“, „Verwalten“, G27's groups), **G32 added** (filters are applied with „Filtern“, a checkbox never through another form's button). | User, `/feature` grilling 2026-10-25 – the four rules proposed by the consistency audit (F5, F11, D3, F6) |
| 2026-10-25 | **G27 amended** (the header count follows the ticks only with JavaScript, without it the state when the page opened; groups without an entry not shown; groups in `CONTEXT.md`'s order, task groups by interval shortest first; machines by museum number, tasks by name; an entry that cannot become due says so – „· Nicht ausgestellt“). **G33 added** (a form sent unchanged lands like a save with a confirmation of the resulting state; ST-031 and ST-036 an accepted exception until a story touches them). **G28 amended** (one's own edit page shows the role without a choice – „Die eigene Rolle kann nur eine andere Techniker:in ändern.“ – and no „Neues Passwort“, only a link to „Passwort ändern“; heading „Konto bearbeiten · Anna Berger“). **G34 added** (form headings „<job> · <thing>“ everywhere). | User, story review 2026-10-25 (`docs/reviews/2026-10-25-story-review.md`, "Proposed guideline changes" and "Decisions (user)" 1 and 4) |
| 2026-10-25 | Housekeeping: **G2a's exception ended** (ST-036 is done, the machine model has its own pages); **G9's "not yet true"** and **G22's "already built"** updated to what is built; status line updated. | The yardstick said things that are no longer true (ux-designer, consistency audit `docs/reviews/2026-10-25-ux-audit-consistency.md`) |
| 2026-10-31 | **G10c added** (removing content that can be uploaded again – the museum's logo in the museum settings – is one step without a question page; an explicit exception to G10/G10a; a file on a machine's record, ST-038, stays under G10 and G10b). | User, feature `museum-start-page` (ST-102): nothing is lost that cannot be restored by uploading again, and the logo is not the history of a machine |
| 2026-10-31 | Feature `ai-assessment`: **G35 added** (background work is a state on its page – „KI-Einschätzung läuft …“, self-refreshing, no spinner; failure „… fehlgeschlagen: <Grund>“ with „Erneut versuchen“), **G36** (a saved secret is never shown again – „…a1b2“, „Ersetzen“, „Entfernen“), **G37** (a feature that depends on a setting is absent while it is off, existing content stays), **G38** (AI output is labelled „KI-Einschätzung“ with model, time, requester and cost, and never changes domain data), **G39** (earlier entries of one kind: newest expanded, older collapsed). **G19 row 9a added**: „Museumseinstellungen“ is now „Einstellungen“ with the forms Museum, Logo, Rechtstexte, KI. **G10c** names the form „Logo“ on „Einstellungen“. | User, `ai-assessment` grilling 2026-10-31. Background work, secrets and AI output are first met here; G15 – a new pattern comes here first |
