# Story review 2026-11-03 – ST-115, ST-119 (retired machines)

Scope: only the consequences of the user decision of 2026-11-03 (files may be attached to retired machines everywhere;
no command refuses a retired machine, no retirement lock; the choice offers them as „LG-041 · Ausgemustert“ after the
others; unknown machines and machine models still reject). Not a second discovery.

Lead developer lens (testability, slicing, effort, risk, dependencies), value lens and UX lens.

## Result

| Story | Testable | size | risk | priority | Recommendation |
|---|---|---|---|---|---|
| ST-115 | yes, after 2 small edits | L (unchanged) | medium (unchanged) | should (unchanged) | Approve after majors 1 and minors 1-2 |
| ST-119 | yes, after 1 small edit | L (unchanged) | medium (unchanged) | should (unchanged) | Approve after major 1 and minor 3 |

No field was changed: `size`, `risk`, `depends_on` and `priority` still hold. The decision removes a rejection and a
lock (less work), adds only an ordering in the choice (retired last), which ST-114 and ST-117 already build for the
display and the filter. `depends_on` stays: ST-113 is done and reached through ST-114; ST-119 -> ST-115, ST-116, ST-117.
Status untouched.

## Consistency with the specs and ST-113's code

Consistent: `events.yaml` (CMD-AddFile, CMD-AttachFile, CMD-DetachFile, RM-AttachmentChoice), `data-model.md`
(*Retired machine* paragraph), `ux-guidelines.md` (G10a, G18) say the same as both stories. In
`src/modules/collection/files.ts` `addingFacts` only checks that machines and machine models exist, with no retired
check and no lock, and `add-file.ts` has `unknown-machine` / `unknown-machine-model` as the only machine rejections. So
ST-113's implementation already matches the decision; ST-119 can reuse it unchanged. CMD-AttachFile must be built
the same way (existence only).

## Findings

### Major

1. **The decision itself has no scenario that exercises it (ST-115 and ST-119).** After the removal of the rejection
   scenario and example row, nothing in either story sends an attach or an add with a retired machine chosen. ST-115
   "Only what can be attached is offered" proves the offer, ST-115's detach row proves detaching, but "never refused"
   (the point of the user's decision) is untested at story level.
   *Recommended:* add the retired machine to existing scenarios, no new scenario (ST-115 is at 10 of 10):
   - ST-115 "A helper attaches a file to several machines and machine models": the helper also chooses the retired
     machine "LG-041"; Then „Angehängt an“ lists it as „LG-041 · Ausgemustert“ and the confirmation reads „… hängt jetzt
     an 2 Geräten und 2 Modellen.“ (adjust the counts, or keep the count of the original and say 3 Geräten and 1 Modell,
     whichever the author prefers).
   - ST-119 "Adding and attaching happen in one step": Given also the retired machine "LG-041", chosen too; Then its
     machine record shows the file and the journal holds the file added and attached to all three in one step.
   Alternative (not recommended): leave it to ST-113's command test; but ST-113's done scenarios do not cover the new
   attach command or the overview form.

### Minor

2. **ST-115 "Only what can be attached is offered" cannot prove "at the end of its group".** Given has only "LG-042"
   (excluded) and "LG-041" (retired), so there is no active machine in the group to be ahead of the retired one.
   *Recommended:* Given also the active machine "LG-050" of the same machine category and technology; Then the group lists
   „LG-050 · Eight Ball“ before „LG-041 · Ausgemustert“ (the retired one has the lower number, so the order cannot be a
   side effect of numbering).
3. **ST-115, same scenario, last And ("when nothing is left to offer ...")** has no Given that creates that state; as
   written it is a second scenario folded into the first. A test needs: file attached to every machine and machine
   model and no machine left. *Recommended:* state in the Given that the second check runs after attaching to all
   remaining things, or drop the clause from the scenario and test the empty case once under G7 in the Context (a
   G-reference may carry it; the Context already names G7). Keeps the count at 10.
4. **ST-119 Notes, first bullet, and the rejection paragraph carry a leftover.** "The check that the chosen machines and
   machine models exist sits in the command ... so its rejection does delete the content: the sentence „… erneut
   ausgewählt werden“ is what the form says then." The form no longer offers anything that can be unknown, so this
   path is not reachable through the form and has no scenario. *Recommended:* shorten to "an unknown machine or machine
   model is a forged request; it is a command-level test (ST-113 has it)" and keep the text out of the form's contract.
   Same for ST-115's Rejections line: no user-facing wording is defined for the forged case, which is fine as long as
   the story says it is command-level only.
5. **ST-115 detach example row for the retired machine** shows detaching, but the story's "attaching it again undoes it"
   promise (G10a) is not asserted anywhere. *Recommended:* leave it (G10a is a pattern, tested once where built); optionally
   extend the scenario with the retired machine from major 1, which then also proves the round trip.

### Checks that passed

- Scenario count: ST-115 10 of 10 (outline counts once), ST-119 9 of 10. After the removals no scenario was lost that the
  rules still need; "A rejected attach attaches nothing and keeps the choice" keeps its title and is plain, so the
  `ST-NNN:` test link (none yet, status review) is not an issue.
- Each rejection that remains has a scenario: nothing chosen (ST-115), removed file (ST-115), no title / no category /
  over 100 MB / not logged in (ST-119). The empty case of the choice is present (see minor 3).
- Domain language: „Ausgemustert“, „Geräte“, „Modelle“, „Angehängt an“ match the glossary and G18; the entry „LG-041 ·
  Ausgemustert“ is identical in ST-114, ST-117, ST-115 and ST-119.
- Value: roles real (team member, technician, helper), inside the vision, no non-goal touched (OCR, duplicates, preview
  are listed out of scope). `priority: should` still fits; the decision changes nothing there.
- UX: entry point, job and landing are named in both; the empty, rejected and no-permission cases exist; patterns are
  referenced by G-number (G27, G10a, G11, G3, G8, G8a). No restated pattern scenarios found.
- UX note, no action: in the choice a retired machine shows only „LG-041 · Ausgemustert“, without the game title, unlike
  „LG-042 · Medieval Madness“. That is the user's and ST-114/ST-117's existing wording, so a person choosing cannot see
  which game it was. Left as decided.

## Spikes / tech tasks

None needed. CMD-AttachFile / CMD-DetachFile are new commands on AGG-File, whose existence check is already in
`addingFacts`; reuse it so ST-115 and ST-119 do not diverge.

## Technical risks for ADRs

None new. The decision removes the one cross-aggregate read that needed a lock (machine retired state), so the "no
retirement lock" is a simplification, consistent with ADR 0018 and the data-model *Concurrency* section.

## Questions for the user

None.
