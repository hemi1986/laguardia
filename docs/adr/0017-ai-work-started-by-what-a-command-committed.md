---
status: accepted
date: 2026-11-02
---

# 0017 – AI work is started by what a command committed

Supersedes, once accepted, one point of `docs/adr/0015-background-ai-work-with-state-in-the-database.md` (accepted, not edited): the triggers it lists under "Started after the response – the only triggers" and under the consequence "a broken chain waits for the next trigger" name "saving the AI settings". Everything else of ADR 0015 stands.

## Context and Problem
ADR 0015 let each Server Action that makes work start a run by hand. Seven actions did. The architecture review of 2026-11-01 replaced these calls with one list of the events that make work (`makesAiWork`), asked by the form runner once a command has committed (PR #194).

A save of the form „KI“ that changes nothing journals no event (HS-27), so it no longer starts a run. Before, it did, and that run could take files already waiting. ADR 0015's wording no longer describes this.

## Decision
- **A run is started by the events a command committed:** a file attached, an AI assessment requested, a file tried again, or the AI settings changed in any way but the key removed.
- **A save that changes nothing starts no run.** Removing the key starts none, as before.
- A page that shows work left unfinished still starts a run when a hold has run out (HS-33, HS-35), unchanged.

## Consequences
- A new way to make work is one more event in the list; no Server Action can forget the call.
- No data or work is lost, but saving unchanged is no longer a way to start a run by hand when work waits with no hold behind it (a failed self-call, `AI_WORK_SECRET` set later). Typing the key again still starts one, because it always journals a change (`docs/operations/ai-work.md`).
- With nothing that makes work and no hold run out, waiting files stay waiting, as ADR 0015 already accepts.
