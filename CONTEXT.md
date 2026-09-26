# La Guardia

Management of the pinball museum's pinball machines: defects, repairs, manuals and problem reports.

## Language

### People

**Visitor**:
A museum guest who plays the machines and may report problems, without an account.
_Avoid_: Guest, customer, player

**Helper**:
A volunteer who carries out simple tasks on machines but does not repair electronics.
_Avoid_: Assistant, volunteer (too broad – technicians are volunteers too)

**Technician**:
One of the specialists who can repair electronics; technicians set priorities, triage problem reports and decide a machine's status.
_Avoid_: Mechanic, repairer, admin

### Machines

**Machine model**:
A pinball title as built by a manufacturer (title, manufacturer, year, type), shared by all machines of that title; holds manuals and schematics.
_Avoid_: Game, title (alone), type

**Machine**:
One physical pinball machine owned by the museum, with its own serial number, status, files and history.
_Avoid_: Pinball, game, flipper, device, unit

**Machine status**:
The technician-set state of a machine: *Playable*, *Limited* (playable with a noticeable defect), *Out of order* (not playable for visitors) or *Not on display* (storage, workshop or restoration).
_Avoid_: State, availability

**Registered machine** / **Retired machine**:
A machine becomes part of La Guardia when a technician registers it; it is retired when it leaves the museum, keeping its history but leaving the active lists.
_Avoid_: Deleted, archived, sold

**Repair history**:
All defects of a machine with their work log entries, plus problem reports resolved on the spot.
_Avoid_: Service history, log

### Problems and repairs

**Problem report**:
A raw, unverified message from anyone – visitor or team member – about something wrong with a machine, optionally with a photo.
_Avoid_: Ticket, issue, complaint, bug report

**Triage**:
The assessment of a problem report by a technician: it becomes a new defect, is linked to an existing defect, is resolved on the spot (helpers may do this too), or is dismissed.
_Avoid_: Review, screening

**Defect**:
A confirmed, specific fault on a machine that stays open until it is resolved.
_Avoid_: Ticket, issue, bug, error, problem

**Priority**:
The technician-set urgency of a defect: *high*, *normal* (default) or *low*.
_Avoid_: Severity, urgency

**Suitable for helpers**:
A mark on a defect saying a helper may claim and resolve it.
_Avoid_: Easy task, simple ticket

**Resolved on the spot**:
A triage outcome for a problem report that was fixed immediately (e.g. a stuck ball freed) without becoming a defect; it stays in the machine history. Helpers may choose this outcome too.
_Avoid_: Quick fix, closed

**Claim**:
A team member taking on a defect so others see who works on it; technicians may also assign or release a claim. Maintenance tasks are not claimed.
_Avoid_: Assignment (for self-claiming), ownership, lock

**Work log entry**:
A record of work done on a defect – who, when, what was done, parts used as free text.
_Avoid_: Repair order, comment, note

### Maintenance

**Maintenance task**:
A recurring job on a machine with a time-based interval, a short instruction, a *suitable for helpers* mark and optionally a restriction to a machine type (e.g. EM only).
_Avoid_: Service, check, inspection, chore

**Maintenance plan**:
The single, museum-wide set of all maintenance tasks.
_Avoid_: Schedule, checklist

**Due** / **Overdue**:
A maintenance task is due on a machine once its interval has passed since it was last done there (or immediately if never done), and overdue once it has been due for more than 25% of its interval; never for machines that are *Not on display*.
_Avoid_: Pending, late

**Maintenance record**:
A record that a maintenance task was carried out on a machine – who, when, done or partially done, optional note.
_Avoid_: Maintenance log, service entry, work log entry (that belongs to a defect)
