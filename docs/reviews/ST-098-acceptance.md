# Acceptance – ST-098: The sticker selection and recording for several machines choose in folding groups
Date: 2026-10-29 · Tests run: `npx vitest run` (sticker-groups + due-maintenance integration) → 39 passed; `npx playwright test e2e/qr-sticker.spec.ts e2e/due-maintenance.spec.ts` → 15 passed · Preview: https://laguardia-bor6r73vz-hemi6.vercel.app (not used, no team data)

Traceability: `check-scenarios.ts ST-098` → 10/10 covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| The sticker selection is grouped and closed | sticker-groups.integration.test.ts | 6 EM / 10 DMD / 4 CRT built through commands; page component rendered; header literals, order and closed state asserted | pass |
| Stickers for machines of two groups | e2e/qr-sticker.spec.ts | Real UI: ticks in two groups, print, two QR images for those museum numbers; 360 px width checked | pass |
| Choosing nothing is still rejected and opens nothing | e2e/qr-sticker.spec.ts | Real print click; URL error=none, no QR, alert text, zero `details[open]` | pass |
| The chosen count stays next to the way to print | e2e/qr-sticker.spec.ts | JS on, ticks, groups closed again; "2 Geräte ausgewählt" literal; headers use "1 von N" with N read from the page (shared DB, noted seam) | pass |
| Without JavaScript the header keeps the count of when the page opened | e2e/qr-sticker.spec.ts | javaScriptEnabled false; header stays "0 von N"; no "Alle auswählen"; print gives LG sticker | pass |
| A search shows only the groups with a match, opened | sticker-groups.integration.test.ts | Isolated DB; only DMD fold, open, LG-042 present, LG-043 and EM group absent | pass |
| A new search starts a new choice | e2e/qr-sticker.spec.ts | Tick, search, clear search; unchecked and status "0 Geräte ausgewählt" | pass |
| Recording for several keeps the due machines open and ticked | due-maintenance.integration.test.ts | Due state built via fixed-date records; rendered folds asserted: Fällig open with both ticked, EM/CRT closed with literals; order vs "Weitere Geräte" | pass |
| A machine from a further group is recorded too | due-maintenance.integration.test.ts | Page data shows LG-005 in the closed EM group; form runner action with both ticked; records for both asserted. The "open the group" click is not driven (seam: page data + form runner, as agreed) | pass |
| A rejected recording keeps the ticks and opens their groups | due-maintenance.integration.test.ts | Date too early rejected; no new records; re-render shows Fällig and EM open with ticks kept, CRT closed | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px usable | yes | page-width assertion in the two-groups e2e test | OK |
| List pages fast with realistic data | partly | groups are plain details; machine overview query unchanged | OK |
| Journal entry per command | n/a (no command changed; EVT-MaintenanceRecorded per machine unchanged, asserted via records) | – | OK |
| Texts from message catalogs | yes | new texts in `platform/messages/team/shared.ts` / `maintenance.ts` / `collection.ts`; headers shared with ST-094 | OK |
| No personal data in logs | n/a | nothing logged | OK |
| Advisories | n/a | no dependency change | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Retired machine in the sticker selection | ST-011: never a sticker; `machineOverview` lists active machines only, `stickersFor` filters again | covered, no action |
| Search with no match (all groups gone) | Not stated; empty-state text presumably from ST-011 | question (not verified here) |
| Browser back button restoring ticks | Header counts follow restored ticks via the initial sync (code comment) | question: not tested |
| Recording for several: a "Not on display" machine in the due or other group | G27 mentions "Nicht ausgestellt" in ST-094 only | question |
| Group with no technology (category-only label) | label rule in the catalog comment | covered by shared helper |
| Helper role on recording for several | ST-045 tests unchanged and green | no action |
| Long machine titles at 360 px | no rule | question |

## Verdict
accepted
