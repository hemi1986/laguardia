# La Guardia

Management of the pinball museum's machines – pinball, arcade and other machines: problem reports, defects, repairs, scheduled maintenance and files.

## Language

### Shared

**Visitor**:
A museum guest who plays the machines and may report problems, without an account.
_Avoid_: Guest, customer, player
_UI (de)_: Besucher:in

**Helper**:
A volunteer who carries out simple tasks on machines but does not repair electronics.
_Avoid_: Assistant, volunteer (too broad – technicians are volunteers too)
_UI (de)_: Helfer:in

**Technician**:
One of the specialists who can repair electronics; technicians set priorities, triage problem reports and decide a machine's status.
_Avoid_: Mechanic, repairer, admin
_UI (de)_: Techniker:in

**Team member**:
A helper or a technician – anyone on the museum team with a personal account.
_Avoid_: User, staff, volunteer, crew
_UI (de)_: Teammitglied

**Account**:
A team member's access to La Guardia – username, password and role. Resetting a password, changing a role and
deactivating act on the account, never on the person: a deactivated account's team member keeps their name on
everything they did.
_Avoid_: Login, user, profile
_UI (de)_: Konto

**Dashboard**:
The page a team member lands on after logging in, showing what needs their attention right now; technicians and helpers each have their own.
_Avoid_: Start page, home, landing page, cockpit
_UI (de)_: Übersicht

**Last visit**:
The moment a team member last opened their dashboard, recorded by the Team area; the dashboard marks everything that
happened since then as new. Deliberately not the moment they last signed in – team members stay signed in for weeks.
_Avoid_: Last login, last seen, session start
_UI (de)_: Letzter Besuch der Übersicht

**Suitable for helpers**:
A mark on a defect or a maintenance task saying a helper may take it on (claim and resolve the defect, or record the maintenance).
_Avoid_: Easy task, simple ticket
_UI (de)_: Für Helfer:innen geeignet

### Collection

**Machine model**:
A product as built by a manufacturer (title, manufacturer, year, machine category, technology), shared by all machines of that model; holds manuals and schematics.
_Avoid_: Game, title (alone), type
_UI (de)_: Modell

**Machine category**:
The kind of machine: *Pinball* (_de_ Flipper), *Arcade* (video arcade game) or *Other* (_de_ Sonstiges; e.g. jukebox, gum machine, table football).
_Avoid_: Type, class, kind
_UI (de)_: Kategorie

**Technology**:
The optional technical generation within a machine category – for Pinball *EM*, *Solid-state*, *DMD* or *LCD*; for Arcade *CRT* or *LCD*; none for Other.
_Avoid_: Generation, era, type
_UI (de)_: Technik

**Machine**:
One physical exhibit the team maintains – a pinball machine, an arcade machine or another machine – with its own museum number, status, files and history.
_Avoid_: Pinball (for machines in general), game, device, unit, exhibit
_UI (de)_: Gerät

**Museum number**:
The museum's short identifier of a machine (e.g. LG-042), printed on its QR sticker; unique among all machines ever registered, retired ones included, so it is never reused.
_Avoid_: ID, inventory ID, serial number (that is the manufacturer's)
_UI (de)_: Museumsnummer

**Serial number**:
The manufacturer's number of a machine; optional, since many machines (especially EM pinball) have none that is readable.
_Avoid_: Museum number, inventory number
_UI (de)_: Seriennummer

**Location**:
Free-text description of where a machine stands in the museum (e.g. "Hall 2, row 3").
_Avoid_: Position, place, slot
_UI (de)_: Standort

**Machine status**:
The technician-set state of a machine: *Playable*, *Limited* (playable with a noticeable defect), *Out of order* (not playable for visitors) or *Not on display* (storage, workshop or restoration).
_Avoid_: State, availability
_UI (de)_: Status (Spielbereit / Eingeschränkt / Außer Betrieb / Nicht ausgestellt)

**Status history**:
Every machine status a machine has had, with previous status, new status, reason, who changed it and when; its first entry is the machine status given at registration.
_Avoid_: Status log, audit trail
_UI (de)_: Status-Historie

**Registered machine** / **Retired machine**:
A machine becomes part of La Guardia when a technician registers it; it is retired when it leaves the museum, keeping its history but leaving the active lists.
_Avoid_: Deleted, archived, sold
_UI (de)_: Erfasst / Ausgemustert

**File**:
A document or image attached to one machine or one machine model – manual, schematic, photo or other. Photos attached to a problem report or a work log entry are not files; they belong to that report or entry.
_Avoid_: Attachment, upload (as a noun)
_UI (de)_: Datei

**File category**:
The fixed kind of a file: *Manual*, *Schematic*, *Photo* or *Other*.
_Avoid_: File type, format, tag
_UI (de)_: Dateikategorie (Handbuch / Schaltplan / Foto / Sonstiges)

### Repair

**Problem report**:
A raw, unverified message from anyone – visitor or team member – about something wrong with a machine, optionally with a photo.
_Avoid_: Ticket, issue, complaint, bug report
_UI (de)_: Meldung

**Triage**:
The assessment of a problem report by a technician: it becomes a new defect, is linked to an existing defect, is resolved on the spot (helpers may do this too), or is dismissed.
_Avoid_: Review, screening
_UI (de)_: Sichtung

**Defect**:
A confirmed, specific fault on a machine that stays open until it is resolved.
_Avoid_: Ticket, issue, bug, error, problem
_UI (de)_: Defekt

**Priority**:
The technician-set urgency of a defect: *high*, *normal* (default) or *low*.
_Avoid_: Severity, urgency
_UI (de)_: Priorität (hoch / normal / niedrig)

**Resolved on the spot**:
A triage outcome for a problem report that was fixed immediately (e.g. a stuck ball freed) without becoming a defect; it stays in the machine history. Helpers may choose this outcome too.
_Avoid_: Quick fix, closed
_UI (de)_: Direkt behoben

**Dismissed**:
A triage outcome for a problem report that describes no fault, is spam, or is set aside for another reason given as free text; retiring a machine dismisses its untriaged problem reports.
_Avoid_: Rejected, deleted, ignored, closed
_UI (de)_: Verworfen (Kein Defekt / Spam / Anderer Grund / Gerät ausgemustert)

**Claim**:
A team member taking on a defect so others see who works on it; technicians may also assign or release a claim. Maintenance tasks are not claimed.
_Avoid_: Assignment (for self-claiming), ownership, lock
_UI (de)_: Übernehmen

**Stale claim**:
A claim older than 14 days without a work log entry since it was made.
_Avoid_: Old claim, abandoned claim, dead claim
_UI (de)_: Liegengeblieben

**On hold**:
A defect that is open but temporarily cannot progress – waiting for a part, waiting for a technician, or another reason.
_Avoid_: Paused, blocked, parked
_UI (de)_: Pausiert (Wartet auf Ersatzteil / Wartet auf Techniker:in / Anderer Grund)

**Closed on retirement**:
The final end of a defect that was not resolved when its machine was retired; it does not count as resolved.
_Avoid_: Cancelled, abandoned
_UI (de)_: Geschlossen (ausgemustert)

**Work log entry**:
A record of work done on a defect – who, when, what was done, parts used as free text.
_Avoid_: Repair order, comment, note
_UI (de)_: Arbeitsschritt

**Repair history**:
All defects of a machine with their work log entries, plus problem reports resolved on the spot.
_Avoid_: Service history, log
_UI (de)_: Reparaturhistorie

### Maintenance

**Maintenance task**:
A recurring job on a machine with a time-based interval, a short instruction, a *suitable for helpers* mark and optionally a restriction to a machine category and/or technology (e.g. Pinball/EM only).
_Avoid_: Service, check, inspection, chore
_UI (de)_: Wartungsaufgabe

**Maintenance plan**:
The single, museum-wide set of all maintenance tasks.
_Avoid_: Schedule, checklist
_UI (de)_: Wartungsplan

**Due** / **Overdue**:
A maintenance task is due on a machine once its interval has passed since it was last done there (or since the task's start date, or the machine's registration if later), and overdue once it has been due for more than 25% of its interval; never for machines that are *Not on display*.
_Avoid_: Pending, late
_UI (de)_: Fällig / Überfällig

**Maintenance record**:
A record that a maintenance task was carried out on a machine – who, when, done or partially done (only *done* restarts the interval), optional note.
_Avoid_: Maintenance log, service entry, work log entry (that belongs to a defect)
_UI (de)_: Wartungseintrag (Erledigt / Teilweise erledigt)
