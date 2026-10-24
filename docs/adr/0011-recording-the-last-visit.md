---
status: accepted
date: 2026-10-24
---

# 0011 – The Last visit is recorded by a client-effect Server Action, computed purely for display, and never journaled

## Context and Problem
The dashboards mark what is new since a team member's **Last visit** (`CONTEXT.md`; HS-21 in `docs/domain/events.yaml`; `docs/stories/ST-050-new-since-last-visit.md`). The Last visit is "the moment a team member last opened their dashboard", one value per member shared across all their devices. ST-087 asked *how* that moment is recorded so that ST-050 can rely on it, without the value being moved by things that are not a visit. The backlog grooming of 2026-10-17 (`docs/reviews/2026-10-17-backlog-grooming.md`, sections 3/4/6) flagged that the naive approach – write the Last visit whenever the dashboard renders – is wrong, because Next.js renders the dashboard for more than a person opening it.

The spike (branch `st-087-spike-how-a-dashboard-visit-is-recorded`) confirmed on a **production build** (`next build` + `next start`, Next.js 16.4.0; prefetch does not happen under `next dev`) what the Next.js docs describe:

- A page/layout render runs during **prefetch**: `node_modules/next/dist/docs/01-app/02-guides/prefetching.md` ("Triggering unwanted side-effects during prefetching") and the route-segment `prefetch` config note that a dynamic page which reads cookies/headers is prefetched with a *fresh server render* when a link forces it (`<Link prefetch>`) or Partial Prefetching is on. The „Übersicht" link in `src/app/(team)/navigation.tsx` is a default `<Link>`, so Next prefetches `/team` on viewport in production.
- A **Server Action** that revalidates **re-renders the current route server-side** in the same response (`docs/.../02-guides/server-actions.md`); every action taken from the dashboard (e.g. ST-048 "return a machine to play") therefore re-runs the page render.

Measured counters from the spike's throwaway instrumented page (render-side counter vs. a client-effect Server Action counter), production build:

| Event | page render ran | client-effect action ran | Last visit moved |
|---|---|---|---|
| prefetch of the page (link in viewport) | **yes** | no | no |
| real open (click) | (served from prefetch cache) | **yes** | first visit set |
| unrelated Server Action (revalidate) | **yes** | no | no |
| reload / second tab / browser back | yes | **yes** | no (same round) |

So a side-effect in the page render moves the Last visit on prefetch and on every dashboard action – the bug the grooming predicted. A client `useEffect` → Server Action never runs on prefetch or on a Server-Action re-render; it does run again on reload, a second tab and browser back, which is why the recording must be idempotent within one visit.

## Driving Requirements
- "new" is measured since the viewer's Last visit, recorded by the Team area; sessions are long-lived – HS-21, `docs/adr/0004-team-authentication.md`
- **One round on the floor is one visit** (decision 2): the Last visit moves forward only when the dashboard is opened more than one hour after the current visit began; opening again within the hour keeps the marks – `docs/reviews/2026-10-17-story-review.md`, ST-050
- A prefetch of the dashboard and a re-render after an action on it are not visits; the first visit marks nothing; own actions are never marked – ST-050
- One value per team member, shared across phones, tablets and the workshop PC – ST-050
- One volunteer maintainer: no broker, no background worker; state-based persistence with an event journal for domain facts – ADR 0002, `docs/product/vision.md`

## Considered Options

**How the open is recorded**
1. **In the page render / data function** (the naive approach) – rejected: runs on prefetch and on every Server-Action re-render (measured), so the Last visit is overwritten by non-visits.
2. **In middleware or a route handler on `/team`** – rejected: middleware also runs for prefetch requests, and it would move a cross-cutting concern out of the Team area that owns the value.
3. **A Server Action triggered from a client effect on the dashboard** (`useEffect` with empty deps, calling the action) – chosen: the only writer; proven not to run on prefetch or on a Server-Action re-render.

**Whether the write is a journaled command**
1. **A journaled command/event per open** (like every other command, ADR 0002) – rejected: a dashboard open is not a domain fact, it is high-frequency per-member state; reload, a second tab and browser back each fire the action, which would flood the event journal with non-facts.
2. **A direct, idempotent state write to a per-member row, owned by the Team area, not journaled** – chosen.

**Where the display gets its mark line**
1. **Read the stored Last visit after the action has written it** – rejected: the client-effect action runs *after* the page render, so the page would read the previous round's line, or a stale one on re-render.
2. **Compute the mark line purely at render time** with the same rule, `decideVisit(stored, now).lastVisit`, writing nothing – chosen: a pure computation is inherently prefetch- and re-render-safe, and it always matches what the action persists for the next round.

## Decision
- **One writer, from the client.** The dashboard renders a small client component whose `useEffect` (empty deps) calls a Team-area Server Action that records the open. This is the only place the Last visit is written. Prefetch and Server-Action re-renders do not run it (measured).
- **Idempotent by the one-hour rule (decision 2).** The recording applies a pure rule over two per-member values – `currentVisitStartedAt` (the beginning of the current round) and `lastVisit` (the mark line): never visited → begin a round and mark nothing (`lastVisit = now`); more than one hour after the round began → a new round, `lastVisit = currentVisitStartedAt`, `currentVisitStartedAt = now`; within the hour → unchanged. So reload, a second tab and browser back are no-ops and the marks stay stable (measured). The rule is a time-based rule tested with a fixed clock (seam catalog); the spike's throwaway unit test covered first visit, within-the-hour, the new round and the exact-hour boundary.
- **Per-member state in the Team area, not journaled.** The two values live in one row per team member in the Team module (a versioned aggregate row, `aggregateStore`), shared across devices. Recording the open does not append an event to the journal (ADR 0002's journal is for domain facts); the write only persists when the value actually changes (first visit or a new round). HS-21 assigns ownership to the Team area.
- **The display computes its mark line purely.** The dashboard read models (`RM-TechnicianDashboard`, `RM-HelperDashboard`) take the mark line as `decideVisit(stored, now).lastVisit` – a pure computation, no write – and mark entries newer than it, excluding the viewer's **own** actions by actor id from the journal (not by time). This is prefetch- and re-render-safe on its own, independent of when the client-effect action runs.

## Consequences
- ST-050 can be built as specified; **decision 2 is buildable**, so ST-050 stays `ready` (its Context and scenarios are unchanged; this ADR adds the mechanism only).
- ST-050 introduces a new Team-module command/store for the Last visit (a per-member versioned row) and a client component with a `useEffect`-triggered Server Action on both dashboards. It also adds the pure `decideVisit` rule, used by both the recorder and the read models.
- Recording a visit deliberately bypasses the "every command appends an event" convention. ST-050 touches the command layer / a new store and shared dashboard code, so it is reviewed in the normal lane plus `/code-review`.
- The Server Action is input-handling that writes per-member state; ST-050's review includes `/security-review` (it must record only for the acting team member from the session, ST-069 `currentPerson()`, never from form data).
- A `loading.tsx` on `/team`, `<Link prefetch>` on the „Übersicht" link, or enabling Partial Prefetching would each make the dashboard render during prefetch; none of that can move the Last visit, because the render never writes it. This is the point of the design and should stay true.
- The one-hour rule is a product constant; if it ever changes, only `decideVisit` changes.

## Open Points
- The exact store shape (reuse `aggregateStore` with a `team` aggregate type keyed by member id, vs. a small dedicated table) and whether the non-journaled write needs a new tiny platform helper are decided in ST-050's implementation.
