# Story review 2026-10-10 – ST-023, ST-052

Reviewers: product-owner, lead-dev, ux-designer (both stories are labelled `ui`). Background: during `/implement ST-023` the user decided that CMD-ReportProblem itself rejects a technician's problem report without a triage part, and chose option B of `docs/reviews/ST-023-ux-form.md` (1a), the landing on the machine record (2a) and follow-up ST-084 for the existing report forms (3a).

## ST-023 – Technician reports a problem and records a defect in the same step

| Reviewer | Verdict |
|---|---|
| product-owner | approve with changes · **must** · still one story of user value, don't split |
| lead-dev | size **M → L**, risk medium · don't split (a command-only half would block every technician from reporting) |
| ux-designer | matches the approved proposal; three gaps |

Change requests (consolidated):
1. **Split the scenario "Technician's problem report needs a triage outcome"** (lead-dev, PO: it overlaps "Technicians are offered…"): a command scenario "A technician's problem report without a triage part is rejected" (new error `triage-required`, nothing stored) and a page scenario for the stale plain form (choice page with the message, description not kept). "Triage outcomes are offered" becomes "recording a defect is offered" while only one outcome exists. The choice page has no submit and no description field.
2. **New: "Helpers cannot record a defect when reporting"** (lead-dev and ux, scenario A of the UX review): a helper opening `/melden/defekt-erfassen` lands on ST-015's form; a forged send stores nothing. ST-023 introduces the optional triage part, so it owns the guard; ST-052's "Helpers cannot choose other triage outcomes" is reduced to *link*.
3. **New: "Machine status changed in the meantime stores nothing"** (lead-dev: the atomicity test of the `context.run` rejection; ux: optional scenario B) – neither problem report nor defect stored, the form keeps description and title.
4. **"No photo is stored"** added to "Invalid triage part stores nothing" and "A rejected report says the photo must be chosen again" (lead-dev).
5. Order of rejections when description and title are both missing: the description first (report part), then the title (lead-dev).
6. Photo rejected itself (ST-016 texts: not an image, over 20 MB): **no** extra photo sentence (ux; same as ST-084's `[OPEN]`) – ST-016's texts apply unchanged.
7. "Two faults become two own problem reports" and "After reporting, the technician is back on the machine record" overlap the happy path (lead-dev) – keep, the first at the command seam (HS-4), the second as the browser scenario.
8. Text for *Not on display*: keep „LG-042 ist schon Nicht ausgestellt – der Status bleibt.“ (ux: accept it, G15).
9. **events.yaml** (lead-dev): CMD-ReportProblem's `produces`/description and rules don't say that a technician's report is rejected without a triage part and may record a defect and change the machine status in the same step – domain-architect.
10. Release order (PO): build ST-052 right after ST-023 – until then a technician who freed a stuck ball has no valid way to report it (only *record a defect*). A note in the story, no `depends_on`.
11. Technical points for the test plan, not the story (lead-dev): the triage part as a discriminated union (ST-052 adds variants); the stale-page rejection as a pre-check in the plain form's action (redirect) or a runner feature – decide in the test plan; journal mapping for two event types, title stays out; one commit for the arrangement rewrite of the e2e specs via a test-support helper.

## ST-052 – Report a problem and link it or resolve it on the spot in the same step

| Reviewer | Verdict |
|---|---|
| product-owner | approve with changes once the helper path is decided · must (helper path), should (technician *link*) · optional split technician/helper |
| lead-dev | size **S → M**, risk **low → medium** · 3 more scenarios |
| ux-designer | major: helper entry undecided, form pages without states and texts |

**Helper path – all three agree on the same shape:** PO ("a secondary action on ST-015's plain form"), lead-dev (option c, a link to the shared page) and ux (**H2**): `/melden` keeps ST-015's form for helpers; above the description „Schon selbst behoben?“ and the button „Direkt behoben“ lead to `/melden/direkt-behoben`, the same page technicians reach from „Sichten“. Above the description so it is seen before anything is typed (a link does not carry typed text).

Change requests: the UX review's Context lines for the pages `/melden/direkt-behoben` and `/melden/mit-defekt-verknuepfen` (headings, sections, submit labels, rejections with G8a, confirmations of ST-019/ST-022, landing on the machine record) and its eight scenarios ("Technicians are offered all three triage outcomes…", "No open defect, nothing to link when reporting", "Helpers are offered resolving on the spot when reporting", the two rejections that keep the input, "A defect resolved in the meantime cannot be linked when reporting", the two landings); "Missing note stores nothing" is replaced by the rejection that keeps the input; "Technician reports and links" gets "And no defect is created". A defect resolved in the meantime is rejected, as in ST-022 – reopening on linking stays ST-053. "Open Questions: none" is wrong until the helper path is decided.

Split (PO's option): with the helper path decided there is no blocker left, so the split is not needed.

## Guidelines

ux-designer proposes **G21a** (from `docs/reviews/ST-023-ux-form.md`) plus one sentence for H2: "Someone who may decide only one outcome and may also leave it undecided keeps the plain form as the default, with that outcome offered as one button above the first field." Not written yet – needs the user's approval.

## Proposed new stories / tasks

- None new. ST-084 (draft) keeps the G8a sentence and the G13 wording for the existing forms; its `[OPEN]` is answered by change request 6.
- Optional (lead-dev): a reusable browser assertion for G8a – inside ST-023, no task of its own.
- Conventions after ST-023 (lead-dev): role-dependent content on one route; a creating command with a triage part in the seam catalog.

## Decisions (user, 2026-10-10)

1. **1a** – ST-023: all change requests 1–11 adopted; size L; ST-052 is built right after ST-023.
2. **2a** – ST-052: helper path H2, the UX review's Context lines and eight scenarios, size M, risk medium, no split; a defect resolved in the meantime is rejected (reopening stays ST-053).
3. **3a** – the ux-designer writes G21a with the H2 sentence into `docs/product/ux-guidelines.md`; no photo sentence after a rejection of the photo itself (ST-023 and ST-084).
