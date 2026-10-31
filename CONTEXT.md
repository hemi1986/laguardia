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

**Museum settings**:
How the museum presents itself to visitors: its name, its logo, the privacy notice and the imprint, and whether the
machines on display are listed for visitors to report a problem. Only technicians change them.
_Avoid_: Configuration, admin settings, museum profile
_UI (de)_: Museumseinstellungen

**Logo**:
The museum's picture on the welcome page; there is at most one, and only technicians replace or remove it in the
museum settings.
_Avoid_: Banner, emblem, brand image
_UI (de)_: Logo

**Legal texts**:
The privacy notice and the imprint every visitor page links to, kept in the museum settings. The German privacy notice
always exists; an English one and the imprint are optional – visitors read the German text where no English one is
provided, and without an imprint no imprint link is offered.
_Avoid_: Legal notice, terms, disclaimer
_UI (de)_: Rechtstexte (the technicians' form); „Rechtliches“ heads the legal links on visitor pages (Datenschutz / Impressum)

**Welcome page**:
The visitor page at La Guardia's root address: the museum's name and logo, and – if the museum settings say so – the
machines on display, each leading to its visitor machine page to report a problem. The same for everyone, logged in or
not.
_Avoid_: Start page (in English text), home, landing page, dashboard
_UI (de)_: Startseite

**Dashboard**:
The page a team member lands on after logging in, showing what needs their attention right now; technicians and helpers each have their own.
_Avoid_: Start page, home, landing page, cockpit
_UI (de)_: Übersicht

**Dashboard visit**:
One round on the floor: it begins when a team member opens their dashboard and lasts while they open it again within
an hour of that beginning; opening it later begins the next dashboard visit. One per team member across all their
devices; a prefetch or a re-render after an action on the dashboard is no opening.
_Avoid_: Dashboard session, page view
_UI (de)_: Besuch der Übersicht

**Last visit**:
The moment the team member's previous dashboard visit began, recorded by the Team area; during the current dashboard
visit the dashboard marks everything that happened since then as new. On the very first dashboard visit it is that
visit's own beginning, so nothing is marked. Deliberately not the moment they last signed in – team members stay
signed in for weeks.
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
_Note_: in code and docs "device" means only the browser on a team member's phone or PC whose design choice is kept (ST-090, G26) – never a machine.

**Museum number**:
The museum's short identifier of a machine (e.g. LG-042), printed on its QR sticker; unique among all machines ever registered, retired ones included, so it is never reused.
_Avoid_: ID, inventory ID, serial number (that is the manufacturer's)
_UI (de)_: Museumsnummer

**Reserved museum number**:
The museum number a machine had before its museum number was corrected; it is never given out again and still leads to its machine, so an old QR sticker keeps working.
_Avoid_: Old number, freed number, retired number
_UI (de)_: Reservierte Museumsnummer

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

**Pending upload**:
Technical, not a domain term (ST-085, ADR 0009): content a team member uploaded from the browser for a machine or machine model that no file refers to yet. Attaching it as a file ends it; one older than 24 hours is abandoned and cleaned up. It is not a *File* – the noun "upload" alone still means nothing here.
_Avoid_: Upload (alone), temporary file

**Upload address**:
Technical, not a domain term (ST-085, ADR 0009, ADR 0012): the short-lived permission the server gives a team member's browser to put content of a declared size under exactly one name in the store. Issuing it records a *Pending upload*.
_Avoid_: Upload URL, upload token

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
The assessment of a problem report by a technician: it becomes a new defect, is linked to an existing defect, is resolved on the spot (helpers may do this too), or is dismissed. A technician triages their own problem report in the same step as reporting it.
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
A triage outcome for a problem report that was fixed immediately (e.g. a stuck ball freed) without becoming a defect; it stays in the machine history. Helpers may choose this outcome too. What was done is its *note* (free text, UI „Was wurde gemacht?“).
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

**Assign**:
A technician claiming a defect on behalf of another team member, who becomes its claimant.
_Avoid_: Delegate, dispatch, hand over
_UI (de)_: Zuweisen

**Release**:
Ending a claim without resolving the defect – by the claimant, or by a technician for someone else's claim; the defect is unclaimed afterwards.
_Avoid_: Unclaim, unassign, drop
_UI (de)_: Abgeben (eigene Übernahme) / Übernahme aufheben (durch Techniker:in)

**Stale claim**:
A claim older than 14 days without a work log entry since it was made. A defect on hold waits on purpose, so its claim is
never stale (user, 2026-10-24, ST-058 code review).
_Avoid_: Old claim, abandoned claim, dead claim
_UI (de)_: Liegengeblieben

**On hold**:
A defect that is open but temporarily cannot progress – waiting for a part, waiting for a technician, or another reason.
_Avoid_: Paused, blocked, parked
_UI (de)_: Pausiert (Wartet auf Ersatzteil / Wartet auf Techniker:in / Anderer Grund)

**Put on hold**:
Marking an open defect as on hold, with a reason.
_Avoid_: Pause (in English text), block, park
_UI (de)_: Pausieren

**Resume**:
Ending a hold, so the defect is open and can progress again.
_Avoid_: Unpause, continue, unblock
_UI (de)_: Fortsetzen

**Reopen**:
Returning a resolved defect to open because the fault came back, with a reason; the earlier resolution and its closing note stay in the repair history.
_Avoid_: Unresolve, reactivate, revive
_UI (de)_: Wieder öffnen

**Closing note**:
What a team member writes when resolving a defect – how it ended; required, and kept with the resolution for the repair history.
_Avoid_: Resolution text, final comment, summary
_UI (de)_: Abschlussnotiz

**Closed on retirement**:
The final end of a defect that was not resolved when its machine was retired; it does not count as resolved.
_Avoid_: Cancelled, abandoned
_UI (de)_: Geschlossen (ausgemustert)

**Work log entry**:
A record of work done on a defect – who, when, what was done, parts used as free text.
_Avoid_: Repair order, comment, note (*note* is the free text of *resolved on the spot*, not a work log entry)
_UI (de)_: Arbeitsschritt

**Repair history**:
All defects of a machine with their work log entries, plus problem reports resolved on the spot.
_Avoid_: Service history, log
_UI (de)_: Reparaturhistorie

**Repair times**:
The technician's view of how long repairs take: per priority (the defect's current priority) and period (last 30 or last 90 days), the typical time to first work log entry and the typical time to resolved, each with its number of defects. "Typical" is the median; the word "median" is not used in UI texts.
_Avoid_: Lead time, SLA, KPIs, repair statistics, median (in UI texts)
_UI (de)_: Reparaturzeiten

**Time to first work log entry**:
The time from the earliest problem report of a defect (originating or linked) to its first work log entry.
_Avoid_: Response time, reaction time, time to start, lead time
_UI (de)_: Bis zum ersten Arbeitsschritt

**Time to resolved**:
The time from the earliest problem report of a defect (originating or linked) to its resolution – after a reopen, its latest resolution; a defect closed on retirement has none.
_Avoid_: Resolution time, lead time, cycle time, turnaround time
_UI (de)_: Bis behoben

### Maintenance

**Maintenance task**:
A recurring job with a time-based interval, a short instruction and a *suitable for helpers* mark, which applies to the machines a technician chose for it – individually, not by machine category or technology. A machine a maintenance task newly applies to has it due at once; from then on its interval runs on that machine alone.
_Avoid_: Service, check, inspection, chore, restriction (machine category and technology only help choosing the machines), start date
_UI (de)_: Wartungsaufgabe

**Machines of a maintenance task**:
The machines a maintenance task applies to; only a technician changes them – when adding the maintenance task or later on it, from the machine record, or when registering a machine. Removing a machine ends its due maintenance for that task and keeps its maintenance records; a retired machine no longer counts as one of them. Choosing machines for a maintenance task is never *assign* – that word belongs to defects.
_Avoid_: Assignment, assigned machines, restriction, scope
_UI (de)_: Geräte der Wartungsaufgabe („Geräte ändern“ / „Wartungsaufgaben ändern“)

**Maintenance plan**:
The single, museum-wide set of all maintenance tasks.
_Avoid_: Schedule, checklist
_UI (de)_: Wartungsplan

**Due** / **Overdue**:
A maintenance task is due on a machine it applies to once its interval has passed since it was last done there – and at once when it newly applies to that machine – and overdue once it has been due for more than 25% of its interval; never for machines that are *Not on display*. After a machine returns to display, a task that was already due counts as due since the return, and overdue 25% of its interval after it.
_Avoid_: Pending, late
_UI (de)_: Fällig / Überfällig

**Maintenance record**:
A record that a maintenance task was carried out on a machine – who, when, done or partially done (only *done* restarts the interval), optional note.
_Avoid_: Maintenance log, service entry, work log entry (that belongs to a defect)
_UI (de)_: Wartungseintrag (Erledigt / Teilweise erledigt)
