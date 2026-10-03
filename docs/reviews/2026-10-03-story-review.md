# Story review 2026-10-03 – ST-018, ST-019, ST-020, ST-022 (triage outcomes on the problem report's page)

Reviewed after ST-017 (done 2026-10-03) built the triage list and each problem report's own page, and the four stories
got a scenario each that their outcome is offered on that page (branch `stories-triage-outcomes-on-problem-report-page`).
Reviewers: product-owner, lead-dev, ux-designer (all four stories are `ui`).

## Per story

| Story | PO | Lead dev | UX |
|---|---|---|---|
| ST-018 Record defect | approve with changes · must · next in the backlog | L, risk medium; testable. Recommends splitting the `context.run` foundation into its own tech task (story → M). Soft line "did not have to enter a separate reason" → "the form has no reason field". | Current machine status shown on the form; status choice options and texts undecided (G20, Q3); retired-rejection and "already triaged" messages say what next (G8); not offered on a triaged report. |
| ST-019 Resolve on the spot | approve · must | S, low. "Already triaged" Given needs ST-018 → reword to a neutral "triaged a moment ago". | Landing + confirmation scenario (G3); kept input after rejection (G8); field label "Was wurde gemacht?" instead of "note" (_Avoid_ word). |
| ST-020 Dismiss | approve · must (only spam protection, D3) | **S → M, risk low → medium**: description becomes nullable (migration), reason columns, CHECK "spam ⇒ no description, no photo", "other ⇒ text"; photo deletion through the storage seam (ADR 0007 – no new ADR needed) – add a scenario "Failed photo deletion does not undo the dismissal". Neutral "triaged" Given. The triage list / page must render a report without description (or ST-033 shows it). | Spam asks once, naming what is deleted (G10); reasons in order, none preselected, free text always visible (G20, no JS); landing + confirmation (G3); kept input (G8). |
| ST-022 Link to defect | approve with changes · **must → should** (a technician can record a second defect instead) | S, low; depends on ST-018, ST-021 – last of the four. Gap: defect resolved after the page was opened (→ rejected, or ST-053 reopens?). Neutral "triaged" Given. | No open defect → linking not offered, said in words (G7); "a defect has to be chosen" rejection; landing + confirmation (G3). |

## Cross-cutting

- **Page layout (UX, G18 – no owner since ST-017 is done):** one section „Sichten“ with the outcomes the person may choose, in a fixed order – Mit Defekt verknüpfen (only with open defects), Defekt erfassen, Direkt behoben, Meldung verwerfen; each a button to its own form page (repeats machine and description, „Zurück zur Meldung“), rejection stays there and keeps the input, success lands on the triage list with a confirmation naming the machine. Proposed new guideline **G21**; addition to **G10** (a triage outcome is a recorded fact and asks nothing; spam deletes bytes and asks once).
- **"Already triaged" Givens** in ST-019/020/022 name another story's outcome (hidden dependencies) → reword to "was triaged a moment ago".
- **No outcome offered on a triaged problem report** – one line per "offered" scenario.
- **ST-039 (not in this batch):** the system's retirement dismissal has no TeamMemberId for "triaged by"; the CHECK of migration 0009 refuses it – ST-039 must decide how a system triage is stored. ST-020 should not hard-code "technician" as the dismissing actor.
- **Gap in a done story (ST-017):** "Diese Meldung ist schon gesichtet." says neither by whom nor how – a new story if wanted.

## Proposed new stories / spikes / tech tasks

- Optional: tech task "`context.run` – a second command in the same transaction" split out of ST-018 (lead dev, PO: user's call – it was moved into ST-018 on purpose on 2026-09-27).
- No spike; no new ADR (photo deletion is ADR 0007).

## Decisions

User, 2026-10-03 – all as recommended:
1. **Layout (new G21):** the problem report's page offers, in a section „Sichten“, only the outcomes the person may choose, in this order: Mit Defekt verknüpfen (only when the machine has open defects), Defekt erfassen, Direkt behoben, Meldung verwerfen. Each is a button to its own form page (heading „<Outcome> · LG-042“, repeats machine and description, „Zurück zur Meldung“); a rejection stays there and keeps the input; success lands on the triage list with a confirmation naming the machine. No outcome is offered on a triaged problem report.
2. **Confirmation (G10):** only dismissing as spam asks first – „Meldung zu LG-042 als Spam verwerfen? Beschreibung und Foto werden endgültig gelöscht.“ (Endgültig verwerfen / Zurück). Every other outcome records a fact and asks nothing.
3. **Machine status when recording a defect (HS-3):** the form shows the current status in words; „Status nicht ändern“ is preselected; only a stricter status is offered – Playable → Limited or Out of order; Limited → Out of order; Out of order or Not on display → no choice, said in words.
4. **ST-022 stays must.**
5. **`context.run` stays in ST-018** (L).
6. **All further proposals adopted:** ST-020 size M, risk medium, scenario "Failed photo deletion does not undo the dismissal" (ADR 0007, no new ADR); neutral "was triaged a moment ago" Givens in ST-019/020/022; "not offered on a triaged problem report" in each; landing + confirmation (G3) and kept input (G8) scenarios in ST-019/020/022; ST-022 "no open defect" (G7) and "a defect has to be chosen"; ST-022: a defect resolved after the page was opened is rejected (ST-053 extends this later); the UI texts proposed by the ux-designer (ST-019 field „Was wurde gemacht?“, buttons, confirmations, rejections); ST-018's soft line becomes "the form has no reason field"; ST-020 does not hard-code "technician" as the dismissing actor (the system dismisses on retirement, ST-039).
