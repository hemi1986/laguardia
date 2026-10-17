---
id: ST-087
title: How a dashboard visit is recorded
type: spike
context: BC-Team
priority: should
size: XS
risk: medium
events: []
depends_on: []
labels: [dashboard]
status: ready
---

## Question
How does La Guardia record a team member's **Last visit** (`CONTEXT.md`, HS-21) so that ST-050 can mark what is new since then – without the value being moved by things that are not a visit?
Found by the lead dev in the backlog grooming of 2026-10-17 (`docs/reviews/2026-10-17-backlog-grooming.md`, sections 3, 4 and 6): moving the Last visit whenever the dashboard is rendered is wrong, because Next.js renders the page for more than a person opening it.
- **One round on the floor is one visit** (user, story review 2026-10-17, decision 2): the Last visit moves forward only when the dashboard is opened more than one hour after the current visit began. Opening it again within that hour – after looking at a defect, going back, reloading – belongs to the same visit and keeps the same Last visit, so the marks stay. The spike reports whether this can be built.
- **Prefetch:** a link to „Übersicht“ in the team navigation may render the dashboard in the background. That must not count as a visit.
- **Server Action re-renders:** every Server Action re-renders its page (known), so an action taken from the dashboard (e.g. returning a machine to play, ST-048) re-renders it. That must not move the Last visit either, or the marks vanish while the person is still looking at them.
- **Own actions are not new** (user, 2026-09-26, ST-050): what the team member did themselves is never marked, independent of when the visit is recorded.
- **First visit:** with no recorded visit nothing is marked as new (user, 2026-09-26, ST-050); the spike shows how "never visited" is told apart from "visited long ago".
- One value per team member, shared across all their phones, tablets and the workshop PC (ST-050).

## Timebox
2 hours – stop there and record what is known, even if a criterion is not answered.

## Acceptance Criteria
- [ ] Everything is tried on a production build (`next build` and `next start`), not in `next dev`, where prefetch does not happen; read `node_modules/next/dist/docs/` first.
- [ ] Shows, with a throwaway page or a test, whether a prefetch of the dashboard runs the code that would record a visit, and how a real visit is told apart from it.
- [ ] Confirms that a Server Action called from the dashboard re-runs that code, and shows how the re-render keeps the Last visit of the current visit.
- [ ] Shows what the browser's back and forward buttons and a second tab with the dashboard do to the recorded visit.
- [ ] Shows what happens to the marks when the person opens one marked entry and comes back to „Übersicht“ – through the navigation, with the back button and with a reload – and that they stay within the hour of decision 2.
- [ ] Shows whether decision 2 can be built – the Last visit moves forward only when the dashboard is opened more than one hour after the current visit began – and names where the beginning of the current visit and the Last visit are kept and when the one replaces the other.
- [ ] Names how "never visited" is represented, so that the first visit marks nothing.
- [ ] Names how the team member's own actions are excluded from "new" (by who did it, not by time).
- [ ] Records the result as a short proposal in ST-050's Notes, or as an ADR proposal (`proposed`) if it is an architecture decision; the throwaway code is removed. If the result changes ST-050's Context or scenarios, ST-050 goes back to `review`.

## Notes
- ST-050 depends on this spike (already in its `depends_on`).
- Revised after the story review of 2026-10-17 (`docs/reviews/2026-10-17-story-review.md`): production build, back/forward and a second tab, coming back to „Übersicht“ after opening a marked entry, decision 2, a hard stop at 2 hours, and "Last visit" (glossary) throughout.
