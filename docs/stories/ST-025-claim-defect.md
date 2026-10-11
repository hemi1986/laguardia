---
id: ST-025
title: Claim or take over a defect
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-DefectClaimed]
depends_on: [ST-021]
labels: [mvp, defect-work, ui]
status: done
---

## Story
As a team member, I want to claim a defect or take it over from someone else, so that everyone sees who is working on it and nobody does the same work twice.

## Context
Command `CMD-ClaimDefect` (any team member). Rules and invariants:
- The defect is not resolved (and not closed on retirement).
- A defect has at most one claimant. Claiming a defect claimed by someone else takes it over – allowed for everyone.
- Helpers can only claim defects suitable for helpers.
- A claim is only a signal: others may still log work (HS-8).
- Concurrent claims are guarded by the version check on the defect (ST-003): the second one is rejected, not silently turned into a takeover.
The open defects list shows "claimed by" and gets the filter "claimed by me".

**Decided in the test plan (user, 2026-10-11, during `/implement ST-025`, answers 1a 2a 3a):**
- **Taking over (2a).** There is no question before taking over a claim from someone else – a claim is only a signal and locks nothing (HS-8). The confirmation names from whom it was taken over. G10 does not apply.
- **Claiming one's own claim again (3a)** is not offered (no button). If it is sent anyway, `CMD-ClaimDefect` rejects it and nothing changes – in particular the time of the claim is not renewed, so the stale claim rule (ST-048) cannot be reset this way.

**Screen (built as proposed in the test plan from `docs/product/ux-guidelines.md`, approved by the user on 2026-10-11 during `/implement ST-025`, answer 1a; no separate ux-designer round):**
- **Where.** The control lives on the defect's own page (`/team/defects/<defect id>`), not in the open defects list (G5).
- **Button.** „Übernehmen“ for an unclaimed defect; „Von Tom übernehmen“ when it is claimed by someone else (G14; the glossary word *Claim* is „Übernehmen“).
- **Claimant.** Shown as „Übernommen von Tom“ on the defect's page and in the open defects list; for the person looking at their own claim „Von dir übernommen“.
- **Confirmation** on the defect's page after claiming (G3): „Du hast „Left flipper weak“ übernommen.“, after taking it over from someone followed by „ Vorher: Tom.“
- **Filter "claimed by me".** A checkbox „Nur von mir übernommene“ in the existing filter form of the open defects list; it combines with the other filters.
- **Who does not see the button (G11).** A helper on a defect not suitable for helpers; nobody on a resolved defect or one closed on retirement; and the claimant on their own claim (3a).
- **Concurrent claim.** Answered with the existing text „Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.“

## Acceptance Criteria

Scenario: Team member claims an unclaimed defect
  Given the open defect "Left flipper weak" is not claimed
  When the technician Tom claims it
  Then "Left flipper weak" is claimed by Tom
  And the open defects list shows Tom as claimant

Scenario: Taking over a claimed defect
  Given the defect "Rubber cracked" is suitable for helpers and claimed by Tom
  When the helper Anna claims it
  Then "Rubber cracked" is claimed by Anna
  And Tom is no longer its claimant

Scenario: Helpers can only claim defects suitable for helpers
  Given the open defect "Display flickers" is not suitable for helpers
  When the helper Anna tries to claim it
  Then the claim is rejected
  And "Display flickers" keeps its claimant, if any

Scenario: Two team members claim at the same time
  Given the open defect "Left flipper weak" is not claimed
  When Tom and Eva claim it at the same time and Tom's claim is stored first
  Then "Left flipper weak" is claimed by Tom
  And Eva is told that the defect has changed and asked to reload before claiming again

Scenario: Resolved defects cannot be claimed
  Given the defect "Coin door jammed" is resolved
  When a team member tries to claim it
  Then the claim is rejected

Scenario: Filter "claimed by me"
  Given Anna claimed "Rubber cracked" and Tom claimed "Left flipper weak"
  When Anna filters the open defects list by "claimed by me"
  Then only "Rubber cracked" is listed

## Out of Scope
- Technicians assigning defects to others, releasing claims (ST-026)
- Highlighting stale claims (ST-048)

## Open Questions
- none
