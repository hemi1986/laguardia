# Scenarios and Context lines proposed by the ux-designer – backlog grooming 2026-10-01

Companion to `2026-10-01-backlog-grooming.md`. Written in the Gherkin style of the story files, ready for the
`requirements-engineer` to apply.

**The user decided on 2026-10-01:** apply these **only to the MVP stories** (ST-007, ST-008, ST-011, ST-012,
ST-017, ST-018, ST-021, ST-033, ST-048 and ST-049, which became `must` in this run). Everything below for
**ST-020, ST-037, ST-039, ST-040, ST-041, ST-043, ST-045, ST-047, ST-051** is recorded here and applied in a later
grooming run – it is not lost, it is scheduled.

> **Known gap, deliberately carried:** ST-020 (dismissing as spam deletes description and photo), ST-039 (retiring
> closes every open defect) and ST-041 (removing a maintenance task) are irreversible **without a confirmation**,
> which contradicts guideline G10. Their confirmation scenarios are below and must be applied before any of the
> three is implemented. `/review-stories` will meet them again; the guideline now exists to catch them.

---

## MVP stories – apply now

### ST-007 – register a machine
`## Context` lines:
- The machine overview is the entry point: registering is reached by a named action directly under its heading and
  happens on its own page; the overview stays a list (G2a).
- After registering, the technician lands on the new machine's record with a confirmation naming the museum number
  and the machine model (G3).
- A rejection stays on the form, keeps every value that was typed, names the reason above the submit button and
  marks the field that caused it (G8).
- A helper is not offered registering; the command rejects it anyway (G11).
- The team navigation is decided in ST-008 with every destination the MVP will have (G19).

```gherkin
Scenario: No machine registered yet
  Given no machine is registered
  When a technician opens the machine overview
  Then it says that no machine is registered yet
  And registering the first machine is offered

Scenario: A rejected registration keeps what was typed
  Given a technician fills in the registration of a machine of the machine model "Medieval Madness" at "Hall 2, row 3" with the museum number "42"
  When they submit it
  Then the registration is rejected because a museum number has the format "LG-" plus three digits
  And the reason is shown at the form, with the museum number marked
  And the machine model, the location and the machine status they chose are still filled in

Scenario: After registering, the technician sees the new machine
  When a technician registers a machine of the machine model "Medieval Madness" at "Hall 2, row 3"
  Then the machine record of "LG-042" is shown
  And a confirmation names the museum number "LG-042" and the machine model "Medieval Madness"

Scenario: Helpers are not offered registering
  Given a helper is logged in
  When the helper opens the machine overview
  Then registering a machine is not offered
```

### ST-008 – machine overview
`## Context` lines: the machine overview is the first team page with more than one destination, so **the team
navigation is decided here**, with every destination the MVP will have (G19); a machine in the overview shows only
what tells it apart, and everything that can be done to it happens on its machine record (G5); which facts the
entry carries is decided here, a count that is zero is not shown, and every count is labelled in words (G6) –
ST-021 and ST-057 add to this decision, they do not reopen it.

```gherkin
Scenario: No machine matches the search
  Given the machines "LG-001" and "LG-002" are registered
  When a team member searches for "jukebox"
  Then no machine is listed
  And it says that no machine matches this search
  And clearing the search is offered

Scenario: No machine has the filtered machine status
  Given no machine is Out of order
  When a team member filters the machine overview by Out of order
  Then no machine is listed
  And it says that no machine is Out of order
```

### ST-011 – QR stickers
```gherkin
Scenario: No machine chosen for printing
  When a technician asks to print QR stickers without choosing a machine
  Then no printable page is produced
  And the technician is asked to choose at least one machine

Scenario: Finding the machines to print for
  Given 60 machines are registered
  When a technician chooses the machines to print stickers for
  Then the machines can be narrowed by museum number or machine model title, as in the machine overview
  And how many machines are chosen is shown next to the way to print
```

### ST-012 – change the machine status
```gherkin
Scenario: A helper is offered only Außer Betrieb
  Given a helper is logged in
  When the helper changes the machine status of "LG-042"
  Then Außer Betrieb is the only machine status offered
  And a reason is asked for

Scenario: A rejected status change keeps what was chosen
  Given a technician changes the machine status of "LG-042" to Limited without a reason
  When they submit it
  Then the change is rejected, and the reason field is marked with what to do next
  And the machine status they chose is still chosen

Scenario: After the change the team member sees the machine
  When a technician changes the machine status of "LG-042" to Limited with the reason "left flipper weak"
  Then the machine record of "LG-042" is shown with the machine status Eingeschränkt
  And a confirmation names "LG-042" and its new machine status
```

### ST-017 – triage list
`## Context` lines: the list entry shows machine, description, reporter and how long the problem report has been
waiting, plus one way to open it; the four triage outcomes live on that problem report's own page (G5). The long
wait is said in words, not only by a colour (G6a).

```gherkin
Scenario: Nothing waits for triage
  Given no problem report is untriaged
  When a technician opens the triage list
  Then it says that nothing waits for triage
  And no problem report is listed

Scenario: How many problem reports wait
  Given 12 problem reports are untriaged
  When a technician opens the triage list
  Then it says that 12 problem reports wait for triage

Scenario: The long wait is said in words
  Given a problem report for "LG-042" was reported 73 hours ago and is untriaged
  When a technician opens the triage list
  Then that problem report says in words how long it has been waiting

Scenario: Triaging happens on the problem report's own page
  Given a problem report for "LG-042" is untriaged
  When a technician opens that problem report from the triage list
  Then its machine, description, reporter and waiting time are shown
  And the triage outcomes the technician may choose are offered there
```

### ST-018 – record a defect
```gherkin
Scenario: A rejected defect keeps what was typed
  Given a technician records a defect from an untriaged problem report with the priority high, the suitable-for-helpers mark set, the machine status Out of order and no title
  When they submit it
  Then nothing is recorded and the problem report stays untriaged
  And the reason is shown at the form, with the title marked
  And the priority, the mark and the machine status they chose are still chosen

Scenario: After recording, the technician sees the new defect
  When a technician records the defect "Left flipper weak" from a problem report of "LG-042"
  Then the defect "Left flipper weak" is shown with its machine
  And a confirmation names "Left flipper weak" and "LG-042"
```

### ST-021 – open defects list
```gherkin
Scenario: No defect is open
  Given no defect is open
  When a team member opens the open defects list
  Then it says that no defect is open

Scenario: How many defects are open
  Given 7 defects are open
  When a team member opens the open defects list
  Then it says that 7 defects are open

Scenario: A filter that matches nothing
  Given no open defect is suitable for helpers
  When a team member filters the open defects by suitable for helpers
  Then no defect is listed
  And it says that no open defect is suitable for helpers
  And going back to all open defects is offered
```

### ST-033 – repair history on the machine record
`## Context` line: the machine record shows the open defects and the most recent repairs by default; the rest of
the history is reached from there (G4a) – the story may not put five years on one phone page.

```gherkin
Scenario: A machine with no repair history
  Given "LG-042" has no defect and no problem report resolved on the spot
  When a team member opens the machine record of "LG-042"
  Then it says that nothing has been repaired on this machine yet
```

### ST-048 – technician dashboard
`## Context` lines: logging in lands on the dashboard of the person's role, and that page – not a separate start
page – is the page after login (user, 2026-10-01). The team navigation is already decided (ST-008); this story
takes its place in it. The dashboard says **how many** and how old, in words, and leads to the triage list and the
due maintenance list; it does not repeat them.

```gherkin
Scenario: A technician lands on their dashboard after logging in
  Given a technician logs in
  Then the technician dashboard is shown

Scenario: Nothing needs the technician right now
  Given no problem report is untriaged
  And no machine is Limited or Out of order without open defects
  When a technician opens the technician dashboard
  Then it says that nothing needs attention right now

Scenario: The dashboard leads to the triage list
  Given 3 problem reports are untriaged
  When a technician opens the technician dashboard
  Then it says that 3 problem reports wait for triage
  And the triage list can be opened from there

Scenario: Returning a machine to play happens on the machine
  Given "LG-042" is listed as Out of order without open defects
  When a technician chooses to return "LG-042" to play
  Then the machine status of "LG-042" can be changed with a reason
  And after the change a confirmation names "LG-042" and its new machine status
```

### ST-049 – helper dashboard
```gherkin
Scenario: A helper lands on their dashboard after logging in
  Given a helper logs in
  Then the helper dashboard is shown

Scenario: Nothing is open for a helper
  Given no defect suitable for helpers is open
  And no maintenance task suitable for helpers is due
  And nothing changed on the defects the helper claimed
  When the helper Anna opens the helper dashboard
  Then it says that nothing is open for her right now
```

---

## Recorded for the next grooming run – do not apply now

### ST-020 – dismiss a problem report (G10 gap)
```gherkin
Scenario: Dismissing as spam asks once
  Given an untriaged problem report for "LG-042" has a description and a photo
  When a technician dismisses it with the reason spam
  Then it asks once, saying that the description and the photo will be deleted and cannot be restored
  And the problem report is dismissed only after the technician confirms
```

### ST-039 – retire a machine (G10 gap)
```gherkin
Scenario: Retiring asks once and says what will happen
  Given "LG-013" has 2 open defects and 1 untriaged problem report
  When a technician starts retiring "LG-013" with the reason "Sold to a collector"
  Then it asks once, naming "LG-013", that its 2 open defects will be closed, its 1 problem report dismissed, and that this cannot be undone
  And "LG-013" is retired only after the technician confirms

Scenario: Cancelling the retirement changes nothing
  Given a technician started retiring "LG-013"
  When the technician does not confirm
  Then "LG-013" is not retired
  And none of its defects or problem reports changes

Scenario: Helpers are not offered retiring
  Given a helper is logged in
  When the helper opens the machine record of "LG-013"
  Then retiring the machine is not offered
```

### ST-040 – maintenance plan
`## Context` lines: the maintenance plan is a list; adding a maintenance task is reached by a named action under
its heading and happens on its own page (G2a). A helper sees the plan and its instructions, but adding is not
offered (G11).

```gherkin
Scenario: The maintenance plan is still empty
  Given the maintenance plan has no maintenance task
  When a technician opens the maintenance plan
  Then it says that no maintenance task has been added yet
  And adding the first maintenance task is offered

Scenario: A rejected maintenance task keeps what was typed
  Given a technician fills in a new maintenance task with a name, an instruction, the interval 3 months, the start date 1 October 2026, the restriction Arcade and the technology EM
  When they submit it
  Then the maintenance task is rejected because the technology does not fit the machine category
  And the reason is shown at the form, with the technology marked
  And the name, the instruction, the interval and the start date are still filled in

Scenario: After adding, the technician sees the new maintenance task
  When a technician adds the maintenance task "Clean glass (inside & out)"
  Then the maintenance plan is shown with "Clean glass (inside & out)" in it
  And a confirmation names "Clean glass (inside & out)"

Scenario: Helpers are not offered adding a maintenance task
  Given a helper is logged in
  When the helper opens the maintenance plan
  Then the maintenance tasks and their instructions are shown
  But adding a maintenance task is not offered
```

### ST-041 – change or remove a maintenance task (G10 gap)
Ask once, naming the maintenance task and saying that its maintenance records are kept.

### ST-043 – due maintenance list
`## Context` line (user's answer to the ux-designer's Q3 is still open – recorded as the recommendation): the
maintenance task stays the grouping; the list shows the tasks first, each with how many machines it is due on and
how many of those are overdue, and opening a task shows its machines sorted by location, narrowable by location
(G4a). The suitable-for-helpers filter stays.

```gherkin
Scenario: Nothing is due
  Given no maintenance task is due or overdue on any machine
  When a team member opens the due maintenance list
  Then it says that no maintenance is due right now

Scenario: How many machines a maintenance task is due on
  Given "Clean glass (inside & out)" is due on 48 machines and "Wax playfield" on 3
  When a team member opens the due maintenance list
  Then "Clean glass (inside & out)" is shown with 48 machines and "Wax playfield" with 3
  And the machines of a maintenance task are listed when that maintenance task is opened

Scenario: The filter matches nothing
  Given no maintenance task suitable for helpers is due
  When a team member filters the due maintenance list by suitable for helpers
  Then it says that no maintenance suitable for helpers is due
  And going back to all due maintenance is offered
```

### ST-037 – attach files
```gherkin
Scenario: A machine without files
  Given neither "LG-042" nor its machine model has a file
  When a team member opens the machine record of "LG-042"
  Then it says that no file is attached yet
  And attaching the first file is offered

Scenario: A rejected file keeps title and file category
  Given a team member fills in a file with the title "MM Operations Manual" and the file category Manual and chooses a PDF of 120 MB
  When they submit it
  Then the file is not attached, and the reason names the maximum of 100 MB
  And the title and the file category are still filled in
  And the team member is asked to choose the file again
```

### ST-045 – record maintenance for several machines
```gherkin
Scenario: How many machines are chosen
  Given "Clean glass (inside & out)" applies to 48 machines, 12 of them due
  When a team member starts recording it for several machines
  Then it says how many machines are chosen
  And that number changes as machines are chosen and unchosen

Scenario: No machine chosen
  When a team member records a maintenance task for several machines without choosing a machine
  Then no maintenance record is stored
  And the team member is asked to choose at least one machine

Scenario: After recording, the team member sees what was recorded
  When the helper Anna records "Clean glass (inside & out)" as done for "LG-042", "LG-043" and "LG-044"
  Then a confirmation names the maintenance task and the three machines it was recorded on
```

### ST-047 – maintenance on the machine record
```gherkin
Scenario: A machine with nothing due and no maintenance records
  Given no maintenance task is due or overdue on "LG-042" and no maintenance was recorded on it
  When a team member opens the machine record of "LG-042"
  Then it says that no maintenance is due and that no maintenance has been recorded yet
```

### ST-051 – repair times
```gherkin
Scenario: No defect was resolved in the period
  Given no defect was resolved in the last 30 days
  When a technician opens the repair times for the last 30 days
  Then it says that no defect was resolved in this period
  And no median is shown
```

### ST-016 – photo on a problem report
The story must say that a rejected form keeps the description but the photo has to be chosen again – a browser
never refills a file chooser (guideline G8a).
