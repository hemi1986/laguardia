# Product Vision – La Guardia

> **Why the name?** In 1942, New York mayor Fiorello La Guardia banned pinball, had thousands of machines confiscated and smashed them with a sledgehammer for the press. La Guardia – the software – does the opposite: it keeps the museum's pinball machines alive.

## Problem
Total chaos today:
- Defects get lost, forgotten or reported twice.
- Nobody knows a machine's repair history; repair knowledge lives in a few people's heads.
- Manuals, schematics and other files are scattered.
- It is unclear who is working on what – duplicate work or no work at all.
- Nobody has an overview of which machines are playable right now.

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
5. Scheduled maintenance: a museum-wide maintenance plan (clean playfield, test switches and lamps, rubbers, …) shows what is due or overdue on which machine, and helpers can carry out most of it.

## Scope Notes
- Visitors report problems via a QR code on each machine: free text plus an optional photo, no account, no contact data.
- Every problem report – also from team members – is triaged by a technician; technicians triage their own reports in the same step.
- Team members (helpers, technicians) have personal accounts; technicians manage them.
- No active notifications (e-mail, push); instead the dashboard highlights what is new since the last login.
- Machines are registered and retired; loans, purchase prices and provenance are out of scope.
- Visitors see a machine's open defects (by title) before writing a report, to avoid duplicates.
- Helpers may resolve a problem report on the spot (e.g. stuck ball) and mark a machine *Out of order* when unsafe; all other triage, status changes, file deletion, the maintenance plan and machine registration are technician-only.
- Any team member can upload files.

## Non-Goals
- Ticketing / admission
- Accounting / invoicing
- Spare-parts purchasing and inventory (at most free-text "parts used")
- Staff scheduling
- Coin / revenue counting
- Public website
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
- On-site usage / devices: mainly smartphones, probably tablets; the workshop PC for administration.
- Network/Wi-Fi in the exhibition: good Wi-Fi everywhere, no offline capability needed.
- Operations & hosting: minimal operating effort – keep it simple.
- Who develops and maintains it long-term: a single volunteer, who is also one of the two technicians.
