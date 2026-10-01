# UX review – the five existing team screens

**Date:** 2026-10-01 · **Reviewer:** ux-designer · **Yardstick:** `docs/product/ux-guidelines.md` (proposed on the
same day, from `docs/product/vision.md` and from these screens – so the rules and the findings were written
together; nothing here is held against a rule that existed before the code)

**Reviewed:** `/login` (ST-004), `/` (ST-078), the team shell and navigation (ST-076), `/team` (ST-076),
`/team/members` (ST-005, ST-077), `/team/password` (ST-005, ST-077), `/team/machine-models` (ST-006).

**Measurements** (browser at 360 px, provided with the task – 18 machine models, 34 accounts, most of them left
over from browser-test runs): `/team/machine-models` 2417 px, `/team/members` 22 789 px. At the museum's real
scale (~60 models, ~10 team members) that is roughly 7 000 px and 6 700 px – 17 to 19 screens of scrolling each.

**Order:** job → understanding → states → language → consistency → polish, per screen, stopping at the level that
fails. **No screen reached polish, so no polish findings are recorded** – that is not a compliment to the polish,
it is the review order doing its work.

## Severity, honestly

**No blockers.** Everything these five screens are for can be done, on a phone, at 360 px, without JavaScript.
What they have is eight majors: things a person will get wrong, retype, miss or do twice. The museum can work
with an ugly page; it cannot work with a password it has to type four times or a model it creates twice. That is
where the majors sit.

## Findings

| # | Screen | Level | Severity | Finding |
|---|---|---|---|---|
| M1 | `/team/members` | job | major | Three jobs on one page; the create form is below every account |
| M2 | `/team/members` | understanding | major | No count, no search, no filter; deactivated accounts stay in the list forever |
| M3 | `/team/members` | understanding | major | Every entry carries all three actions, expanded |
| M4 | `/team/members` | states | major | A rejected creation loses everything typed and shows the reason at the top of the page |
| M5 | `/team/members` | states | major | "Deaktivieren" is one tap, unconfirmed and irreversible |
| M6 | `/team/members` | states | minor | The confirmation does not name who, and the new entry is invisible in the list |
| M7 | `/team/members` | language | major | The same thing is called *Teammitglied* and *Konto* on the same page |
| M8 | `/team/members` | consistency | minor | Page state in the URL here, in the action result there |
| MM1 | `/team/machine-models` | job | major | The "Neues Modell" form is below all machine models |
| MM2 | `/team/machine-models` | states | major | A successful creation looks exactly like doing nothing |
| MM3 | `/team/machine-models` | states | minor | The reason for a rejection does not mark the field, at the bottom of a long page |
| MM4 | `/team/machine-models` | states | minor | The empty case does not say what to do |
| L1 | `/login` | states | major | After a wrong password both fields are empty |
| L2 | `/login` | states | minor | The failure travels in the URL and survives reload, back and bookmark |
| L3 | `/login` | consistency | minor | No way back to the start page |
| T1 | `/team` | job | major (owned) | The page after login says only who you are – ST-048/ST-049 deliver the fix |
| T2 | `/team` | language | minor | The heading names the product, not the job of the page |
| N1 | navigation | consistency | minor | Fine at five items; decide it once before the next four arrive |

---

### `/team/members` – the account list

**M1 · job · major.** The page is "find a person", "change a person" and "create a person" at once
(`src/app/(team)/team/members/page.tsx`): the list of all accounts first, then the "Neues Konto" section. Creating
an account means scrolling past every account that exists – 22 000 px today, ~6 700 px at ten team members.
*Why it matters:* this is the page a technician opens on the museum floor with a new volunteer standing next to
them; the one thing they want is the form.
*Instead:* G1/G2 – the list is a list; "Neues Teammitglied" sits directly under the heading and leads to the form
(Open decision O1 settles the shape).

**M2 · understanding · major.** No count, no search, no filter. Accounts are sorted by name
(`teamMemberAccounts`, `src/modules/team/accounts.ts`) and deactivated ones stay in the list for good, marked only
by "· deaktiviert" in the small grey second line of their card.
*Why it matters:* a technician comes here to reset *one* person's password, and has to read every card to find
them; departed volunteers accumulate in the middle of the list and never leave.
*Instead:* G4 – how many team members there are, a search over name and username, and deactivated accounts behind
a filter rather than in the list.

**M3 · understanding · major.** Every card renders three forms at once: the role-switch button, a password input
with its own button, and the destructive "Deaktivieren". That is ~670 px per entry.
*Why it matters:* it is the actual cause of the page length (M1, M2 are symptoms of it), and it means every scroll
past a name passes a destructive button and a password field.
*Instead:* G5 – the entry shows name, username, role and whether the account is active; what can be done to that
person happens on that person's own page.

**M4 · states · major.** `createAccountAction` redirects to `/team/members?error=…`
(`src/app/(team)/team/members/actions.ts`), and the page renders the rejection directly under the heading – while
the form that was submitted is at the very bottom. Name, username, role and password are gone; the technician
retypes all four.
*Why it matters:* "username-taken" is the normal case on a first attempt, so this is not the rare path. After the
redirect the person is at the top of the page, reads a sentence, and has to scroll 22 000 px back to an empty
form.
*Instead:* G8 – the form keeps name, username and role (never the password), and the reason stands immediately
above its submit button. The machine model form already does exactly this through the Server Action runner
(ST-073); these actions predate it.

**M5 · states · major.** "Deaktivieren" is a single tap, with no confirmation. It ends all of that person's
sessions, and nothing in La Guardia reactivates an account – ST-005 has no such action.
*Why it matters:* the button sits a finger's width below a password input, on a dense list of lookalike cards, on
a phone, in a workshop. A mis-tap is permanent; the only repair is a second account for the same person.
*Instead:* G10 – ask once, naming the person and what happens ("Zugang für Anna Berger beenden? Anna wird sofort
abgemeldet."). Whether reactivation should exist is Open decision O3.

**M6 · states · minor.** The confirmations are generic ("Konto angelegt.", "Passwort neu gesetzt.") and the new
account is sorted alphabetically into a list the technician cannot see the end of.
*Instead:* G3 – name the person in the confirmation; after creating, land where that person is visible.

**M7 · language · major.** The navigation item and the page heading say **Teammitglieder**; every button, label and
confirmation says **Konto** – "Neues Konto", "Konto anlegen", "Konto angelegt.", "Konto deaktiviert", and
`accountErrors` says "Dieses Konto gibt es nicht mehr." `CONTEXT.md` has *Team member / Teammitglied* and no entry
for an account at all.
*Why it matters:* the glossary is the one place this is decided, and right now the page decided it twice. Every
later screen that mentions a team member will pick one of the two at random.
*Instead:* G12 – one word on the screen, and the decision belongs in `CONTEXT.md` first, through the domain-model
skill, not on this page. My recommendation to that decision: add **Account** (`_UI (de)_` *Konto*) as its own term,
because resetting a password and deactivating act on the access, not on the person – and then the heading and the
navigation of this page say *Konten*, while *Teammitglied* stays the person who appears as "claimed by" and
"logged by". The alternative (one term, *Teammitglied*, everywhere) is also defensible; what is not defensible is
leaving both.

**M8 · consistency · minor.** This page carries its state in the URL (`?error=`, `?done=`), the machine model form
in the action result. Two mechanisms, two behaviours, one product. Follows from M4 and disappears with it.

### `/team/machine-models` – the machine models

**MM1 · job · major.** Same shape as M1: 18 cards, then "Neues Modell". Same fix, G2.

**MM2 · states · major.** On success the action revalidates and redirects to the same page
(`src/app/(team)/team/machine-models/actions.ts`). There is no confirmation at all, and
`machineModelsToChooseFrom` sorts by title, so the new model appears somewhere in the middle of a 2 400 px list.
The technician sees an empty form at the bottom of the same page they started on.
*Why it matters:* this is the finding most likely to put wrong data in the database – the obvious reaction is to
fill the form in again, and nothing stops a second "Medieval Madness".
*Instead:* G3 – a confirmation naming the model, on a page where the model is visible.

**MM3 · states · minor.** The rejection is in the right place relative to the form (above the submit button) but
the page is 2 400 px tall, and the field that caused it is not marked. "Bitte ein Baujahr mit vier Ziffern
angeben, zum Beispiel 1997." leaves the technician looking for which field that was – fixable here, serious once a
form has ten fields (ST-007, ST-018).
*Instead:* G8 – mark the field.

**MM4 · states · minor.** The empty case is "Noch keine Modelle angelegt." and nothing else; the form is a screen
below it. *Instead:* G7 – the empty case carries the way to the first model.

**No finding on the model card.** Title plus "Hersteller · Jahr · Kategorie · Technik" is exactly what tells two
models apart, and nothing more. That is G5 done right – the one thing these five screens get right on the first
try.

### `/login`

**L1 · states · major.** `logInAction` redirects to `/login?error=…`, so after a wrong password both *Benutzername*
and *Passwort* are empty.
*Why it matters:* the password is the thing that was wrong; the username was right and is thrown away with it. On
a phone keyboard, with a username the volunteer half-remembers, the second attempt is harder than the first – and
after ten failures the account is locked for 15 minutes.
*Instead:* G8 – keep the username, clear the password, name the reason above the submit button. The machine model
form shows the behaviour we want; the login predates the runner.

**L2 · states · minor.** The error lives in the URL, so reloading, going back or opening a bookmark shows
"Anmeldung fehlgeschlagen" when nothing has failed. Disappears with L1.

**L3 · consistency · minor.** No way back to `/`. A visitor who taps "Anmeldung fürs Team" on the start page is
stuck with the browser's back button. *Instead:* G17.

### `/team` – the page after login

**T1 · job · major, and already owned.** The page says "Angemeldet als E2E Technician (Techniker:in)" and nothing
else. For a helper, the entire product today is their own name, "Passwort ändern" and "Abmelden".
*Why it matters:* this is the first screen after every login and the answer to "what can I do right now" – the
helper's whole reason for opening La Guardia.
*Instead:* nothing now. ST-048 and ST-049 are the dashboards, and they are in the backlog. The one thing to carry
over: logging in must land on the dashboard of the person's role, and that page – not a separate "Start" – is the
page after login.

**T2 · language · minor.** The heading is "La Guardia – Team" (the product), the navigation item is "Start". A
heading names the job of the page. Disappears with ST-048/ST-049.

### Navigation and the shell (ST-076)

**N1 · consistency · minor.** Five items, two rows at 360 px, every destination repeated on every page – which is
what navigation is for. No action.
*The thing to watch:* machines, triage, open defects, maintenance and the dashboards add at least four more items,
and five more will not fit in two rows. Decide the navigation once, with ST-048, rather than letting each story
add a link.

### `/` (ST-078) and `/team/password` (ST-005)

No findings. `/` is a declared placeholder replaced by ST-010 and ST-064. `/team/password` is a short page with one
form, its rejection and confirmation visible without scrolling – it is what the other forms should look like, and
its only weakness (the rejection comes back through the URL) is M8 again.

## What I would not act on

Four of the seven measurements, in whole or in part. I would rather drop a finding than carry it:

1. **Measurement 1, the missing count, search and sorting on the machine model list.** The museum will have ~60
   machine models, sorted by title, and this page is not how a model gets chosen – ST-007 picks one from a select
   when registering a machine. Nobody comes here to *find* a model; they come to add one or (ST-036) correct one.
   Keep the finding about the form's position (MM1) and the missing confirmation (MM2); drop search, filter and
   count here. Against G4 this list simply does not pass the 20-entry threshold that makes finding hard – it
   passes the *length* threshold, and that is fixed by moving the form, not by adding a search box.
2. **Measurement 5, the one-sentence team start page.** Real, but ST-048 and ST-049 replace the page entirely.
   Fixing it now is work we throw away; the only thing worth carrying is "login lands on the dashboard".
3. **Measurement 6, the navigation needing two rows.** Two rows of five items at 360 px is not a problem, and
   repeating every destination on every page is navigation working as intended. What deserves attention is the
   *next* four items, and that belongs to ST-048.
4. **Measurement 7, the dev indicator.** Next.js's, not ours.

I would also not act on the per-entry height of the machine model card (~78 px for two lines). Two lines is what
it takes to tell two models apart; 60 of them is a long page, and a long page of exactly the right information is
fine.

## What should happen next, and in which story

Nothing here is a story file – the requirements-engineer writes those. Marked **absorb** where an existing story
is coming anyway and should take it, **new** where nothing covers it.

### Absorb into existing stories

**ST-007 (Register a machine with its museum number) – absorb the house form pattern.**
It is the next story with a form and a list, and whatever it does becomes the pattern every later form copies. It
should carry G2, G3, G7 and G8 explicitly, so the rules are proven on a page before ST-008, ST-018 and ST-037 copy
them. Proposed `## Context` lines:
- The machine overview (ST-008) is the entry point; registering is reached by a named action under its heading,
  and the form is not inside the list.
- After registering, the technician lands on the new machine's record with a confirmation naming the museum
  number and the machine model.
- A rejection keeps every value that was typed, names the reason at the form, and marks the field that caused it.
Proposed scenarios:
- *Scenario: A rejected registration keeps what was typed* – Given a technician fills in the registration without
  a location / When they submit it / Then the registration is rejected with the reason at the form, and the
  machine model and museum number they chose are still filled in.
- *Scenario: After registering, the technician sees the new machine* – … / Then the machine record of "LG-042" is
  shown with a confirmation naming the museum number.

**ST-008 (Machine overview) – absorb the list rules and the empty case.**
It already has the count per machine status and the search, which is G4 satisfied; what is missing is the empty
case. Proposed scenario:
- *Scenario: No machines registered yet* – Given no machine is registered / When a team member opens the machine
  overview / Then it says that no machine is registered yet, and a technician is offered the way to register the
  first one.
Proposed Context line: a machine in the overview shows only what tells it apart (G5); everything that can be done
to it happens on its machine record (ST-009).

**ST-036 (Correct a machine model) – absorb the machine model page restructure.**
It is the story that gives a machine model its own page, which is exactly what M-findings MM1 and MM2 need. It is
currently XS, priority *must*, late in the order and dependent on ST-009 and ST-044 – its real dependency for this
part is only the page. **Recommendation to the product-owner and lead-dev:** pull it forward to just after ST-007
and re-size it (S), with: the create form moves off the list (O1), creating confirms and lands on the model's
page, correcting happens on that page.

**ST-048 (Technician dashboard) – absorb "the page after login" and the navigation decision.**
Proposed Context lines: logging in lands on the dashboard of the person's role; the team start page is that
dashboard, not a separate page. The navigation is decided once here, with all the destinations the MVP will have,
instead of one link per story.
Proposed scenario: *Scenario: A technician lands on their dashboard after logging in* – Given a technician logs in
/ Then the technician dashboard is shown.

**ST-049 (Helper dashboard) – the same for helpers.**
Proposed scenario: *Scenario: A helper lands on their dashboard after logging in.* And, because this is the
helper's answer to "what can I do right now", the empty case matters more here than anywhere:
*Scenario: Nothing is open for a helper* – Given no defect suitable for helpers is open and no maintenance task
suitable for helpers is due / When Anna opens the helper dashboard / Then it says that nothing is open for her
right now.

**ST-055 (Retired machines in views) – nothing to add.** Its "show retired machines" filter is the precedent for
G4; keep the wording consistent with whatever the account filter (new story B) uses for deactivated accounts.

### New stories

**New A – "The login keeps the username when it rejects" (XS).**
*Value:* a team member who mistypes their password does not retype their username, and does not meet an error
message that is no longer true.
*Scenarios:* wrong password keeps the username and empties only the password, with the reason above the submit
button; reloading the login page after a rejection shows no rejection; the locked-out message is unchanged.
*Note:* ST-004 is done and is not reopened – this is a new story, and it is the cheapest major on the list.

**New B – "Find a team member and act on one account at a time" (M).**
*Value:* a technician standing next to a new volunteer finds the right person, or creates one, without reading
every account in the museum.
*Scenarios:* the list shows name, username, role and whether the account is active, one entry per person, without
actions; it says how many team members there are; searching by name or username finds one; deactivated accounts
are not listed until a filter asks for them, and are marked when they are; opening one account shows what a
technician can do to it; creating is reached from the heading and a rejection keeps name, username and role but
never the password; after creating, the confirmation names the person.
*Replaces:* M1–M4, M6, M8. Needs Open decisions O1 and M7's glossary decision first.

**New C – "Deactivating a team member asks once, and can be undone" (S).**
*Value:* a mis-tap on a phone does not cost a volunteer their access permanently.
*Scenarios:* deactivation asks once, naming the person and saying their sessions end; cancelling changes nothing;
a technician reactivates a deactivated account and that person can log in again; the last active technician can
still not be deactivated.
*Depends on:* Open decision O3. If the answer is "deactivation stays final", the story shrinks to the confirmation
step alone – and then the confirmation is not optional.

### Not a story

G8's and G9's presentation – a rejection that marks its field and is recognisable without colour – is shared
platform work on the components all these pages use. It is pulled into the first story that needs it (ST-007),
the way this project pulls technical groundwork in just in time, not carried as a story of its own.
