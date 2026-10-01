# UX Guidelines – La Guardia

> **Status: accepted by the user on 2026-10-01.** Every rule below (G1–G17, including G2a and G10a) is binding. One decision is still open (O2, how much of
> a wide screen a list may use) – it is at the end and is settled when the first long list is built (ST-008).

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

**G3 – After a successful action the person sees what changed.**
They land where the result is visible and get a confirmation that names the thing by its own words
("Modell *Medieval Madness* angelegt."), or they land on the new thing's own page. Never the same empty form again.
*Why:* creating a machine model today looks exactly like doing nothing – the list is sorted by title, so the new
model is somewhere in the middle, and no confirmation is shown. The next step is a second attempt and a duplicate.

## 2. Understanding what you are looking at

**G4 – A list is for finding, not for reading.**
A list that can pass ~20 entries shows how many there are and offers one way to narrow it – a search over the
words people actually know (museum number, title, name), or a filter over a status people actually think in. A
list that cannot pass 20 entries stays plain.
*Why:* a technician opens the account list to find one person, not to read 34 cards.

**G5 – A list entry shows only what tells it apart from its neighbours; the actions live on the entry's page.**
At most one action may sit on the entry itself, and only when it is the one thing people come to the list for.
*Why:* every account card carries a role button, a password field and a destructive button, which is what turns
10 team members into 18 screens of scrolling, and puts "Deaktivieren" under every single name.

**G6 – Say what a number or a state means, in words.**
A status, a count or a date is labelled where it stands; the person does not have to know a code or a colour.
*Why:* colours mean nothing on a dim phone in a bright hall, and nothing to someone who sees the screen once.

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
*Why:* "Deaktivieren" is one tap, it ends the person's sessions, and nothing in La Guardia undoes it.

**G10a – What can be undone is undoable in La Guardia** (user, 2026-10-01).
Deactivating an account is reversible: a technician can activate it again. A thing a person can switch off and the
software cannot switch back on is a bug, not a safety feature.
*Why:* a mistap in a list of ten names locks a colleague out, and the only repair today is a second account for the
same person – which splits their work history in two.

**G11 – Someone who may not do a thing does not see the control.**
The page shows the rest; the command refuses it anyway (`allowedActors` – the UI never carries the rule alone).
Where a whole page is not theirs, they do not reach it from the navigation.
*Why:* a helper looking at buttons that reject them learns to ignore rejections.

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

## 5. Consistency

**G15 – Same thing, same pattern, on every screen.**
Forms, rejections, confirmations, lists and headings follow the same shape everywhere. When a screen needs a new
pattern, the pattern comes here first.
*Why:* two forms with two rejection behaviours (login vs. machine model) is how we got here after five screens.

**G16 – Every screen works at 360 px, and the workshop PC shows the same screen.**
Nothing is tried first on a laptop. **How much of a wide screen a list may use is Open decision O2.**

**G17 – Every page is reachable and leaveable.**
Each page either stands in the navigation or is reached from a named link on a page that is, and every page has a
way back without the browser's button.

## 6. Then, and only then, polish

Proportion, rhythm and spacing are the last level. A screen that is ugly but clear ships; a screen that is pretty
and hides the open task does not.

---

## Open decisions

Not decided, not invented. Each needs the user's answer, and then it becomes a rule above, with the date.

**O2 – How much of the workshop PC's width may a list use?**
*Recommendation:* one layout, one column, and the maximum width may grow for list pages so long texts (defect
titles, locations) stop wrapping into four lines – but no second layout, no tables, no side-by-side columns. We
have one layout to maintain and one volunteer to maintain it.

---

## Changelog

| Date | Change | Reason |
|---|---|---|
| 2026-10-01 | First version proposed, derived from `docs/product/vision.md` and the review of the five existing screens (`docs/reviews/2026-10-01-ux-review-existing-screens.md`) | The user asked for a yardstick before the next screens are built (ST-007 ff.) |
| 2026-10-01 | G9 got its means: an icon from `lucide-react`, and the form layout moves to shadcn's `Field` so a rejection can mark the field it belongs to (`data-invalid`/`aria-invalid`). Neither is built yet – ST-007 is the first form on the new pattern. | The shadcn skill made the gap visible: G8/G9 were rules without anything to implement them with |
| 2026-10-01 | Accepted by the user. O1 became **G2a** (creating happens on its own page), O3 became **G10a** (deactivating is reversible), and the *Teammitglied* / *Konto* split went into **G12** and into `CONTEXT.md` as the new term **Account**. O2 stays open until the first long list (ST-008). | The three decisions the first version deliberately left to the user |
