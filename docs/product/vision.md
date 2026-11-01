# Product Vision – La Guardia

> **Why the name?** In 1942, New York mayor Fiorello La Guardia banned pinball, had thousands of machines confiscated and smashed them with a sledgehammer for the press. La Guardia – the software – does the opposite: it keeps the museum's pinball machines alive.

**The museum:** Flipper- & Arcade Museum Eschbach (user, 2026-09-29) – the name visitors see, e.g. on the welcome page; technicians can change it in the museum settings (user, 2026-10-31).

## Problem
Total chaos today:
- Defects get lost, forgotten or reported twice.
- Nobody knows a machine's repair history; repair knowledge lives in a few people's heads.
- Manuals, schematics and other files are scattered.
- It is unclear who is working on what – duplicate work or no work at all.
- Nobody has an overview of which machines are playable right now.

Machines are not only pinball: the museum also has arcade machines and other machines (jukeboxes, gum machines, table football, …).

Scale: ~50 playable machines (some with minor defects) plus ~5–10 machines that are not playable. Two technicians who can repair electronics, plus a number of helpers for simple tasks.

## User Groups
| Role | Description | Key needs |
|---|---|---|
| Visitor | Museum guest playing the machines | Report a problem at the machine quickly (e.g. via QR code) |
| Helper | Volunteer for simple tasks | See which simple tasks are open, record what they did |
| Technician | One of the two electronics specialists; sets priorities and decides whether a machine is taken out of play | Overview of all open problems, prioritize, full repair history, manuals and schematics at the machine |

## Goals
1. No defect gets lost: every reported problem stays visible until it's resolved.
2. Every machine has a traceable repair history.
3. At any time it's clear which machines are playable, limited, or out of order.
4. Files (manuals, schematics, etc.) are attached to the machines and available at the machine.
5. Scheduled maintenance: a museum-wide maintenance plan (clean playfield, test switches and lamps, rubbers, …) in which technicians choose, per maintenance task, the machines it applies to; it shows what is due or overdue on which machine, and helpers can carry out most of it.

## Scope Notes
- Visitors report problems via a QR code on each machine: free text plus an optional photo, no account, no contact data.
- Every problem report – also from team members – is triaged by a technician; technicians triage their own reports in the same step.
- Team members (helpers, technicians) have personal accounts; technicians manage them.
- No active notifications (e-mail, push); instead the dashboard highlights what is new since the team member's previous visit to it (HS-21; team members stay logged in on their phones for weeks, so the last login would highlight nothing).
- Machines are registered and retired; loans, purchase prices and provenance are out of scope.
- Visitors see a machine's open defects (by title) before writing a report, to avoid duplicates.
- Helpers may resolve a problem report on the spot (e.g. stuck ball) and mark a machine *Out of order* when unsafe; all other triage, status changes, file deletion, the maintenance plan, the machines a maintenance task applies to and machine registration are technician-only.
- Any team member can upload files.
- AI assessments (user, 2026-10-31, `feature:ai-assessment`): once a technician saves an OpenRouter API key and
  two models in the settings, a team member who may work on an open defect can ask for an AI assessment – probable
  causes, what to check first and references into the machine's manuals, schematics and images. The machines' and
  machine models' files are indexed for it (text, PDF pages as images, image files). The AI never changes a defect,
  and nothing reaches the AI while AI is off. Out of the first version: AI in triage, chat or follow-up questions,
  automatic assessments, video and audio, rating assessments, AI for visitors, asking the files without a defect.

## Non-Goals
- Ticketing / admission
- Accounting / invoicing
- Spare-parts purchasing and inventory (at most free-text "parts used")
- Staff scheduling
- Coin / revenue counting
- Public website – no opening hours, news, prices or freely designed content. In scope (user, 2026-10-31,
  `feature:museum-start-page`): the welcome page with the museum's name and logo, the legal texts, and,
  if the technicians switch it on, the machines on display to report a problem at
- Offline capability
- Active notifications (e-mail, push)
- Counting plays (maintenance intervals are purely time-based)
- Loans, purchase prices, provenance of machines
- Visitor accounts or visitor contact data

## Success Criteria
- 100% of defects reported during the trial are recorded in La Guardia – no side channels.
- The time from report to start of repair and to resolution can be measured for every defect.
- For every machine, anyone on the team can see the current status and full repair history in under a minute.

## Constraints
- Language: the software (UI) is in German – the visitor pages in German and English; defect titles are shown untranslated; all documentation, the glossary, stories and code are in English.
- On-site usage / devices: mainly smartphones, probably tablets; the workshop PC for administration.
- Network/Wi-Fi in the exhibition: good Wi-Fi everywhere, no offline capability needed.
- Operations & hosting: minimal operating effort – keep it simple.
- AI: OpenRouter is the only AI backend, paid with the museum's own API key; any model OpenRouter offers may be
  chosen – free ones and providers that keep or train on the data included (user, 2026-11-01, ADR 0016). Problem
  report descriptions and photos – also visitors' – reach it, so the privacy notice has to say so (the technicians
  change the legal texts).
- Who develops and maintains it long-term: a single volunteer, who is also one of the two technicians.

## Initial Maintenance Plan
Starting point agreed in the event storming; technicians maintain the maintenance plan in La Guardia. Intervals are time-based and count per machine from the last *done* maintenance record on that machine since the task was added to it; a task newly applied to a machine is due at once (user, 2026-10-25). The table is a starting point: technicians choose the actual machines per task, and when a machine is registered, the tasks that already apply to a machine of the same machine category and technology are proposed.

| Maintenance task | Interval | Suitable for helpers | Suggested machines |
|---|---|---|---|
| Clean glass (inside & out) | 1 month | yes | Pinball |
| Switch test (every switch) | 1 month | yes | Pinball |
| Lamp & flasher test, replace dead bulbs/LEDs | 1 month | yes | Pinball |
| Check balls for chips/rust, replace if needed | 1 month | yes | Pinball |
| Check flipper strength & play | 1 month | yes | Pinball |
| Clean playfield | 3 months | yes | Pinball |
| Check rubbers, replace cracked ones | 3 months | yes | Pinball |
| Check coin door, legs, leg bolts, levelling | 3 months | yes | Pinball |
| Wax playfield | 12 months | yes | Pinball |
| Replace all rubbers and balls | 12 months | yes | Pinball |
| Flipper rebuild check (bushings, coil stops, links) | 12 months | no | Pinball |
| Check fuses, connectors, boards for burn marks | 12 months | no | Pinball |
| Clean & adjust score reels / stepper units | 12 months | no | Pinball / EM |
| Clean screen, bezel and cabinet | 1 month | yes | Arcade |
| Test joysticks, buttons, coin door | 1 month | yes | Arcade |
| Check control panel for loose parts, replace worn microswitches | 3 months | yes | Arcade |
| Clean fans and dust out cabinet | 12 months | yes | Arcade |
| Check PSU voltages, connectors, board | 12 months | no | Arcade |
| Check monitor geometry, convergence, capacitors | 12 months | no | Arcade / CRT |

No task is suggested for machine category *Other* by default.
