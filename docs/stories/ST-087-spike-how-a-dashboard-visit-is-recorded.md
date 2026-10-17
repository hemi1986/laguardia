---
id: ST-087
title: How a dashboard visit is recorded
type: spike
context: BC-Team
priority: should
size: null
risk: null
events: []
depends_on: []
labels: [dashboard]
status: draft
---

## Question
How does La Guardia record a team member's **Last visit** (`CONTEXT.md`, HS-21) so that ST-050 can mark what is new since then – without the value being overwritten by things that are not a visit?
Found by the lead dev in the backlog grooming of 2026-10-17 (`docs/reviews/2026-10-17-backlog-grooming.md`, sections 3, 4 and 6): writing "previous visit" when the dashboard is rendered is wrong, because Next.js renders the page for more than a person opening it.
- **Prefetch:** a link to „Übersicht“ in the team navigation may render the dashboard in the background. That must not count as a visit.
- **Server Action re-renders:** an action taken from the dashboard (e.g. returning a machine to play, ST-048) re-renders the page. That must not move the previous visit either, or the marks vanish while the person is still looking at them.
- **Own actions are not new** (user, 2026-09-26, ST-050): what the team member did themselves is never marked, independent of when the visit is recorded.
- **First visit:** with no recorded visit nothing is marked as new (user, 2026-09-26, ST-050); the spike shows how "never visited" is told apart from "visited long ago".
- One value per team member, shared across all their phones, tablets and the workshop PC (ST-050).

## Timebox
About 2 hours.

## Acceptance Criteria
- [ ] Shows, with a throwaway page or a test, whether a prefetch of the dashboard runs the code that would record a visit, and how a real visit is told apart from it (in Next.js as installed – read `node_modules/next/dist/docs/` first).
- [ ] Shows whether a Server Action called from the dashboard re-runs that code, and how the re-render keeps the previous visit of the current page load.
- [ ] Names where the moment of the current visit and the previous visit are kept, and when the current one becomes the previous one, so that two page loads in a row (ST-050's "Highlight disappears after the visit") behave as ST-050 describes.
- [ ] Names how "never visited" is represented, so that the first visit marks nothing.
- [ ] Names how the team member's own actions are excluded from "new" (by who did it, not by time).
- [ ] Records the result as a short proposal in ST-050's Notes, or as an ADR proposal (`proposed`) if it is an architecture decision; the throwaway code is removed.
