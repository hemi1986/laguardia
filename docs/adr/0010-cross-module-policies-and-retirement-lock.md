---
status: accepted
date: 2026-10-23
---

# 0010 – Cross-module policies are added by the downstream module; retirement locks its machine with an advisory lock

## Context and Problem
Retiring a machine (`CMD-RetireMachine`, Collection) must, in the same transaction and as the system, close every defect of the machine that is not resolved (`POL-RetirementClosesDefects` → `CMD-CloseDefectOnRetirement`) and dismiss every untriaged problem report (`POL-RetirementDismissesProblemReports` → `CMD-DismissProblemReport`, reason *machine retired*) – both Repair commands (`docs/adr/0002-modular-monolith-state-based-persistence.md`: automatic policies run in-process and synchronously). These are the first automatic policies in the code, and they raise two questions the lead dev named in the backlog grooming of 2026-10-17 (sections 4 and 6; `docs/stories/OPEN_QUESTIONS.md`, row ST-039):

1. **Module cycle.** Repair already imports Collection (its commands read `machineForReporting`, CMD-RecordDefect runs CMD-ChangeMachineStatus). If Collection's command named Repair's policies, Collection would import Repair – a cycle the module boundaries forbid in spirit (ADR 0002: upstream does not know downstream; context map: Collection is upstream of Repair and Maintenance).
2. **Concurrency.** A problem report, defect or maintenance record created at the same moment as the retirement must be either rejected (machine already retired) or closed/dismissed by it – nothing may stay open on a retired machine (ST-039). Today the "is the machine retired?" reads take no lock (engineering conventions, *A rule that needs another module's data*), and the context map relies on "a machine retired in the same second is caught by the retirement policies". With READ COMMITTED that does not hold: a problem report inserted by a transaction that commits after the retirement's policies looked for untriaged reports, but before the retirement commits, stays untriaged on a retired machine.

Besides, the existing `policies` hook of `aggregateCommand` is a pure function of the command's own state and events – it cannot find "every open defect of the machine", which needs a query.

## Driving Requirements
- Nothing stays open on a retired machine; the policies run in the retirement's transaction – `docs/stories/ST-039-retire-machine.md`, ADR 0002
- Other modules reference aggregates by ID and change them only through the owning module's commands – ADR 0002
- Collection is upstream of Repair and Maintenance – `docs/domain/context-map.md`
- One volunteer maintainer: no broker, no outbox, no background worker – ADR 0002, `docs/product/vision.md`
- PostgreSQL in its default isolation, READ COMMITTED – ADR 0003, engineering conventions *Version check*

## Considered Options

**Question 1 – who connects the event to the policies**
1. **Collection names Repair's policies** – rejected: Collection would import Repair (cycle).
2. **An event bus in the platform** with policies registered by import side effects – rejected: which policies run depends on which files happen to be imported; a test of the command without the registering import silently runs no policy.
3. **The downstream module adds its policies to the upstream command** – chosen. Collection defines `CMD-RetireMachine` without knowing who reacts; Repair, which already depends on Collection, exports the same command with its two policies added (`withPolicies`, a platform function). This is the direction Repair already uses when CMD-RecordDefect runs Collection's CMD-ChangeMachineStatus.
4. **A neutral composition element** above the modules (e.g. `src/policies/`) that names the commands of several modules – not now: one more boundary element for one command. It becomes the better choice when a second downstream module reacts to the same command (then the composition no longer has a natural owner); this ADR is superseded then.

**Question 2 – how the machine is guarded**
1. **No lock, rely on the policies** – rejected: the race above.
2. **`SELECT … FOR SHARE` on the machine row** in every guarded read – rejected: CMD-RecordDefect may change the machine status in the same transaction; two of them on one machine would both hold the share lock and both wait to update the row – a deadlock.
3. **SERIALIZABLE isolation** for the commands involved – rejected: every command would need a retry loop, and the version check relies on READ COMMITTED (engineering conventions).
4. **A transaction-scoped advisory lock per machine** – chosen: retirement takes it exclusively, every command that creates or reopens something on a machine takes it shared. Advisory locks do not conflict with row locks, so status changes are unaffected.

## Decision
- **Policies across modules.** The platform's command layer gets `withPolicies(command, policies)`: it returns the same command (same ID, same allowed actors, same errors plus the policies' errors) that, after saving and after its `runs`, runs each policy in the same transaction as the system. A **policy** is a value with its `POL-…` ID that, given the transaction and the triggering command's state and events, returns the policy calls to make – so it may query the aggregates it acts on. The upstream module defines its command without policies; the **downstream module that owns the policy's commands adds them** and exports the result. For ST-039: Collection exports `retireMachineCommand`; Repair exports it with `POL-RetirementClosesDefects` and `POL-RetirementDismissesProblemReports` added, and the retire page uses Repair's export. Collection's own tests use Collection's command; nothing in Collection names Repair.
- **A policy that acts on many aggregates** selects them in the transaction with `FOR UPDATE`, filtered by the state it acts on (defects not resolved and not closed, problem reports untriaged). PostgreSQL re-checks the filter on a row a concurrent transaction changed, so a defect resolved or a problem report triaged a moment earlier is skipped instead of rejecting the retirement. Each selected aggregate is then changed through its own command (`CMD-CloseDefectOnRetirement`, `CMD-DismissProblemReport`), run as the system without a version (the row is already locked).
- **The retirement lock.** Collection owns one lock per machine: `pg_advisory_xact_lock(hashtext('machine:' || id))`. `CMD-RetireMachine` takes it **exclusively** in its facts, before deciding. Collection's in-command reads that other modules use to check "not retired" – `machineForReporting` (CMD-ReportProblem with every triage outcome, CMD-RecordDefect, CMD-ReopenDefect – and CMD-LinkProblemReportToDefect, which reads it from now on because linking to a resolved defect reopens it) and `machineForMaintenance` (CMD-RecordMaintenance) – take it **shared** (`pg_advisory_xact_lock_shared`) before they read. A command in flight therefore finishes before the retirement decides, and the retirement's policies see what it created; a command that starts while the retirement runs waits for its commit and then reads *retired* and is rejected. Shared holders never block each other, and every command takes the advisory lock before any machine row lock, so the order is the same everywhere (no deadlock). Page reads (no transaction of a command) take no lock.
- The convention "a read of another module's data takes no lock" stays for every other fact; these two reads are the named exception, because their answer guards an invariant of the retired machine.

## Consequences
- The context map's "a machine retired in the same second is caught by the retirement policies" now holds because of the lock; ST-039's scenario "Problem report at the moment of retirement" proves it with two real transactions (`whileHoldingRow`-style, holding the retirement's lock).
- A report or a maintenance record on a machine waits at most for one retirement – a rare, technician-only command of milliseconds. Concurrent reports on the same machine do not wait for each other.
- `hashtext` collisions between two machines only make one wait for the other's retirement; correctness is unaffected.
- A new command that creates something on a machine must read the machine through one of these two guarded reads (or a new one in Collection that takes the same lock). The engineering conventions say so after ST-039.
- `withPolicies` and policies with a query are shared platform code: ST-039 is reviewed with `/code-review` in addition to the code review.
- The app imports the retire command from Repair, not from Collection – the one place where the owner of a command and the module exporting the composed command differ. Option 4 replaces this if a second module ever reacts to the retirement.
