# Story review 2026-10-25 – ST-088 to ST-098

Stories from the `/feature` session of 2026-10-25: `feature:member-pages` (ST-088), `feature:consistent-layout-dark-mode`
(ST-089–ST-093), `feature:per-machine-maintenance` (ST-094–ST-098). All carry `ui`. Reviewed in parallel by
product-owner, lead-dev and ux-designer; nobody edited a story.

## Per story

| Story | PO | Lead dev (size · risk · deps) | UX | Conflicts |
|---|---|---|---|---|
| ST-088 Account edit page, one-tap deactivate | approve with changes · should – merge two UI-detail scenarios | M · medium · [] – Better Auth stores username normalised + `displayUsername` + `<username>@users.invalid`, all three on rename; password cannot share the transaction, decide every rejection before writing; a password change ends all sessions | major: own edit page lets a technician demote themselves (lands on a refused page) and set a new password without the current one; the last-technician case is always the own page; texts for back link, deactivated account's edit page, old question address | UX + LD agree: own edit page fixes the role and has no „Neues Passwort“ (→ Decision 1) |
| ST-089 One page width | approve · should | S · low · [] – define what "672 px" measures; "submit spans the column" only for form pages with fields (not filter forms, not one-tap buttons) | ready; optional: legal and not-found pages | – |
| ST-090 Dark design | approve with changes · could – drop "rejection recognisable in both designs" (repeats G6/G9) | M · medium · [] – server renders `html.dark` from a device cookie + `color-scheme` (D1); visitor/legal/print must not follow the cookie (proxy header recommended); print needs a scoped light token set; no inline script (CSP ST-070); assert computed `color-scheme`, not pixels; one shared `Fold` | minor: switching on a form page loses typed input (say so); switching on a filtered list keeps the filter (scenario); team not-found follows the device, visitor not-found dark; file chooser in the native-controls scenario | – |
| ST-091 Headings and buttons | approve · could | S · low · [] – make "no form has „Speichern“…" a catalog scan or list the three forms | minor: F4 pattern has gaps – „„Wax playfield“ ändern“, „Modell „…“ korrigieren“, G28's „Konto von Anna Berger bearbeiten“; F10 hint scenario missing | heading pattern vs. G28 (→ Decision 4) |
| ST-092 Sections, lists, filters, links | approve with changes · could – split if L, or drop F7/F15 | L · low-medium · [ST-091] – split 092a records+dashboards (F1, F3, F5, F14; builds `Section`, G29) / 092b lists, filters, links (F6, F7, F11, F12, F13, F15); make "looks like" measurable | minor: F1 change lines in one shape („… · <what> von <who> · vor …“); search keeps the retired filter (scenario) | split (→ Decision 2) |
| ST-093 Status history | approve · could | S · low · [] – reserved museum number redirects; Berlin year boundary table test | ready + 5-entry boundary scenario | – |
| ST-094 Tasks apply to chosen machines | approve with changes · should – trim migration scenarios to one | L · high · [] – split 094a domain switch (machines + „added at“, due/record rule, drop restriction/start date, model-correction rule gone, migration, flat checklist) / 094b grouped folding choice (G27, „Alle auswählen“, empty case, group order in Collection's interface); migration writes no journal entry, `added_at = min(old-rule date at Berlin midnight, recorded_at of the earliest counting done record)`; retired machine among the machines not counted (scenario); tampered/duplicate IDs; `>=` for "recorded since added"; journal event has no single machine; shared retirement lock per machine in sorted order; DoD: list superseded scenarios of ST-036/040/041/043/044/045 and changed tests | major: Not-on-display entry says so („LG-030 · Fireball · Nicht ausgestellt“); rejection texts for retired meanwhile / unknown machine; minor: G31 fold look, header counts live only with JS | PO trim vs. LD exact migration (→ recommendation: keep the migration and its scenarios, user decided to migrate) |
| ST-095 Change machines of a task | approve · should | M · medium · [ST-094a, ST-094b] – single plan aggregate: the form posts the set as seen plus the new set, the command applies the delta versionless (no-ops instead of conflicts); two concurrent changes both stored; retired machine stays among the machines | major: the retired-meanwhile scenario is contradictory (a retired machine is never listed); minor: „Gilt für 3 Geräte“ + „Geräte ändern“ under the heading before the first field; empty case; „Zurück zur Wartungsaufgabe“ | – |
| ST-096 Tasks from the machine record | approve · should | M · medium · [ST-095] – same delta/stale-form scenario; atomic over several tasks (prove by rejecting via a removed task); plural forms 0/1/n | minor: count line texts; groups by interval shortest first, tasks by name; removed-meanwhile reason names the task | – |
| ST-097 Tasks at registration | approve with changes · could – proposals optional | M · medium-high · [ST-096] – composed command exported by Maintenance (ADR 0010 option 3); "Changed by" = registering technician (`runs` or actor on the policy, decide in the test plan); tampered task ID rejects | major: with option (a) three cases lack scenarios – model changed after proposals, rejected registration keeps ticks and proposes nothing, no JS = nothing proposed; a proposal line says why (G6a) | all three recommend (a): proposals ticked with JavaScript only |
| ST-098 Sticker selection and recording in folds | approve · could | S · low · [ST-094b] – search stays a GET reload, ticks lost as today; header counts live only with JS | major: search with closed groups – show only groups with a match, open, header counts what is listed; „2 Geräte ausgewählt“; „Fällig – 2 von 2 ausgewählt“ | – |

## [OPEN] items – recommended answers (all three reviewers agree)

| Story | Item | Recommendation |
|---|---|---|
| ST-088 | Changed username keeps sessions | Yes – sessions are keyed by team member ID; wording: "only deactivating and a password change end sessions" |
| ST-088 | Saving without a change | Accept and confirm „Konto von Anna Berger gespeichert.“ |
| ST-090 | Login design | Follows the device choice, dark without one; team not-found the same; visitor and legal pages dark |
| ST-094 | Group order | `CONTEXT.md` order (Flipper EM, Solid-State, DMD, LCD, without technology; Arcade CRT, LCD, without; Sonstiges), machines by museum number; groups without an entry are not shown |
| ST-094 | Empty case | „Noch kein Gerät erfasst. Die Wartungsaufgabe lässt sich trotzdem hinzufügen und gilt dann für kein Gerät.“ |
| ST-095 | Texts and landing | „Geräte ändern · Wax playfield“, button „Geräte ändern“, „Zurück zur Wartungsaufgabe“; landing on the plan with „„Wax playfield“ gilt jetzt für 3 Geräte.“ (also when nothing changed) |
| ST-096 | Section line | „Für dieses Gerät gelten 4 Wartungsaufgaben.“ / „… gilt 1 Wartungsaufgabe.“ / „… gilt keine Wartungsaufgabe.“ above „Wartungsaufgaben ändern“ |
| ST-096 | Texts | „Wartungsaufgaben ändern · LG-042“, „Zurück zum Gerät“, confirmation „Für LG-042 gelten jetzt 4 Wartungsaufgaben.“ |
| ST-097 | Pre-ticking | (a) with JavaScript once a model is chosen; untouched ticks follow a model change; after a rejection nothing is proposed again; without JS nothing is ticked; line „Vorgeschlagen: 3 Wartungsaufgaben, die schon für Geräte mit Flipper · EM gelten.“ |
| ST-098 | Search with groups | Only groups with a match, open, only the matches; header counts what is listed; a new search starts a new choice, as today |

## Proposed guideline changes (ux-designer)
- **G27 amendment:** header count live only with JS; groups without an entry not shown; group order per `CONTEXT.md`, entries by museum number / by name, task groups by interval shortest first; an entry that cannot become due says so („· Nicht ausgestellt“).
- **New rule:** a form sent unchanged is not a rejection – it lands like a save with a confirmation naming the resulting state. ST-031 and ST-036 (done) reject an unchanged form and stay an accepted exception until a story touches them.
- **G28 amendment:** one's own account page fixes the role and changes the password only through „Passwort ändern“ (if Decision 1 is accepted).

## Proposed vision change (product-owner)
Goal 5 and "Initial Maintenance Plan" in `docs/product/vision.md` still describe category restrictions and one interval start:
1. Goal 5: technicians choose, per maintenance task, the machines it applies to.
2. Scope Notes: add "the machines a maintenance task applies to" to the technician-only list.
3. Initial Maintenance Plan: intervals count per machine from the last done record since the task was added to it; a task newly applied to a machine is due at once.
4. Table column "Applies to" → "Suggested machines", with a sentence that technicians choose the actual machines and registration proposes tasks of the same category and technology.
5. "No maintenance tasks for machine category *Other* by default" → "No task is proposed for machine category *Other* by default".

## New stories, spikes, tech tasks
- Splits proposed by lead-dev: ST-094 → domain switch + grouped choice; ST-092 → records/dashboards + lists/filters/links.
- No spike. Checks inside stories: `<button>` inside `<summary>` (094b), how "drawn dark" is asserted (090).
- Candidate, no story (PO): a dashboard hint "machines without maintenance tasks".
- Convention topics for the pull requests: versionless set-delta commands on the single plan aggregate; actor identity for in-step cross-module commands; journal events concerning several machines; theme resolution per route group; how `verify.ts` treats superseded scenarios of done stories.

## Decisions (user)
User, 2026-10-25:
1. **Own account (ST-088):** the own edit page shows the role without a choice („Die eigene Rolle kann nur eine andere Techniker:in ändern.“) and has no „Neues Passwort“, only a link to „Passwort ändern“; this absorbs the last-technician case. G28 amended accordingly.
2. **No splits.** ST-094 and ST-092 stay one story each (size L) – "nicht noch mehr Stories".
3. **Order:** the maintenance chain first (ST-094 → 095 → 096 → 097 → 098, priority `must`), then ST-088, then layout and dark design (ST-089 → 090 → 091 → 092 → 093, priority `should`).
4. **Everything else as recommended:** all [OPEN] answers in the table above; headings follow „<job> · <thing>“ everywhere, including „Konto bearbeiten · Anna Berger“, „Wartungsaufgabe ändern · Wax playfield“, „Modell korrigieren · Medieval Madness“; the three guideline changes; the vision change; the migration stays (no reseed), without journal entries; the lead dev's scenario and DoD additions (set-delta command, concurrency, tampered IDs, superseded scenarios listed in the PR) go into the stories.
5. **Texts filled in by the requirements-engineer accepted** („… Es wurde nichts gespeichert.“, „Zurück zum Teammitglied“, „Dieses Konto ist deaktiviert.“).
6. **ST-088 to ST-098 approved → `ready`** (user, 2026-10-25).
