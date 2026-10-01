---
name: ux-design
description: How La Guardia decides user experience and UI – the questions to grill when a feature touches the frontend, what a story has to say about the interface, and the yardstick in docs/product/ux-guidelines.md. Use when a feature or story has a screen, a form or a flow, and in story reviews of stories labelled `ui`.
---

# UX Design

This skill is **how** we decide the interface. **What** we decided is `docs/product/ux-guidelines.md` – the
yardstick, owned by the `ux-designer` agent, approved by the user. The two are not interchangeable: a judgement
that is not in the guidelines is an opinion, and the next story will contradict it.

The technical side lives elsewhere and is not repeated here: `.claude/skills/engineering-conventions/SKILL.md`
(the `Page` container and the 360 px rules, shadcn, `NativeSelect` for anything that must submit without
JavaScript, where message catalogs live) and ADR 0001. Point at those, don't restate them.

## Who we are designing for

`docs/product/vision.md` is the source – read it, don't paraphrase it from memory. What it means for the
interface, and what every decision is measured against:

- **A visitor stands at a machine** with a phone they have never used this software on, no account, often in a
  noisy room, and wants to be done in under a minute. They may be reading German or English.
- **A helper is on the museum floor**, phone in one hand, possibly gloves or dirty hands, looking for "what can I
  do right now" – not for a database.
- **A technician** works at the machine on a phone and at the workshop PC on a wide screen, and needs the full
  history, not a summary.
- 360 px is the design size, not the exception. The workshop PC is the same layout, not a second one.
- No offline, no notifications (non-goals) – so the screen a person is looking at has to carry the information.

## When a feature has a frontend part

Assume it does. The exceptions are a policy, a migration, a pure read model with no page of its own, and tooling.
Everything else a person triggers has a screen, and if nobody designs it, it gets designed by accident.

**The test, during grilling:** can you name the screen a person is on when this happens, what they see before they
act, and what they see afterwards? If any of the three is unclear, the feature has an open UX question – raise it
in the grilling round, don't settle it while writing code.

Stories with a frontend part carry the label **`ui`**. `/review-stories` and `/groom-backlog` route them to the
`ux-designer` by that label, so a missing label means a story nobody looks at from this side.

## The UX frontier – what to grill

Ask these in the grilling round of `/feature` (or `/grill-with-docs`), each with a recommended answer, as the
`grilling` skill requires. They belong to the round whose prerequisites are settled – the purpose of a screen
cannot be asked before the domain decision it serves.

1. **Entry.** How does the person get here – QR code, navigation, a link from another screen, a dashboard? Is this
   a destination or a step in a flow?
2. **The one job.** What is the single thing this screen exists for? If there are two, say why they are not two
   screens.
3. **Before acting.** What does the person need to see to decide – and what can be left out? Name what is *not*
   shown; a screen that shows everything decides nothing.
4. **The action.** How many taps from arriving to done? What is the default, so the common case needs no input?
5. **Afterwards.** Where does the person land, and how do they know it worked? (Here: a redirect plus the changed
   list, or a confirmation – see the guidelines.)
6. **When it goes wrong.** Which rejections can the command return, what does each one say in German, and does the
   typed input survive? Every error code of the command needs a text in the catalog – the type check enforces it,
   but the *wording* is a UX decision.
7. **The empty case.** What does the screen show when there is nothing yet – and does it say what to do about it?
8. **The full case.** What happens at 50 machines, 200 defects, a 60-character name, a three-line defect title?
   Which of these is realistic for this museum, and which is not worth designing for?
9. **Permission.** What does someone who may not do this see – the screen without the action, or not the screen?
10. **Language.** Team UI German, visitor pages German and English. Which domain terms appear, and do they match
    `CONTEXT.md`'s `_UI (de)_` wording exactly?

A question whose answer is already in `docs/product/ux-guidelines.md` is not asked again – quote the guideline
instead. That is what makes the yardstick pay off.

## What goes into the story, and what does not

Stories stay at the level of observable behaviour. The `lead-dev` rule holds for UX too: no implementation detail
in a story, no markup, no component names, no pixel values.

- **Into the Gherkin**: what a person sees and can do, in terms a test can check. "Then the open defects of the
  machine are listed, newest first" – yes. "Then a card component with a muted description is rendered" – no.
- **Into `## Context`**: the screen's one job, the entry point, the states that have to exist (empty, rejected, no
  permission), and the German wording decided during grilling.
- **A scenario for the empty case and for the rejection**, when the story introduces a screen. These are the two
  that get forgotten, and they are the ones a person actually meets.
- **Not into the story**: layout, component choice, spacing, colour. Those follow from the guidelines and the
  engineering conventions; if a story needs to say them, the guidelines are missing something – say so.

## Reviewing a screen that exists

Against `docs/product/ux-guidelines.md`, in this order – stop at the first level that fails, the ones below it do
not matter yet:

1. **Can the person do the job at all**, at 360 px, without JavaScript where the conventions require it?
2. **Do they understand what they are looking at** – heading, what each number means, which machine this is about?
3. **Do the four states exist** – empty, full, rejected, no permission?
4. **Is the language right** – glossary wording, German that sounds like a museum and not like a database?
5. **Is it consistent** with the screens that already exist – same patterns, same words for the same thing?
6. Only then: proportion, rhythm, polish.

Report findings the way a code review does: what, where, why it matters, and what you would do instead. Never
"this feels unpolished" – name the decision that is wrong.

## Keeping the yardstick honest

Every decision the user approves goes into `docs/product/ux-guidelines.md` immediately, in the voice of a rule
("A form that is rejected keeps what was typed and names the reason above the submit button"), with the date and
the reason. A guideline nobody can point at is not a guideline. When the code and the guidelines disagree, raise
it – don't silently follow either.
