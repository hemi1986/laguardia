---
status: accepted
date: 2026-09-26
---

# 0001 – Tech stack: one Next.js monolith with shadcn/ui, used in the browser

## Context and Problem
The big-picture event storming and a first domain model exist (`docs/domain/events.yaml`, `docs/domain/context-map.md`, `docs/architecture/data-model.md`), so the application shape and framework can be decided. The user's stated preference is **a Next.js monolith to keep it simple, with shadcn/ui for the UI**. This ADR checks that preference against the documented requirements and compares it with the options required by the `architect` skill.

## Driving Requirements
- Mainly smartphones and probably tablets on the museum floor, the workshop PC for administration – `docs/product/vision.md` (Constraints)
- Good Wi-Fi everywhere, **no offline capability** – `docs/product/vision.md` (Constraints, Non-Goals)
- Visitors report via a **QR code on each machine**, without an account, free text plus optional photo – `docs/product/vision.md` (Scope Notes), `CMD-ReportProblem`, `RM-VisitorMachinePage`
- Team members have personal accounts with roles helper / technician, managed by technicians – `docs/product/vision.md` (Scope Notes)
- Photo uploads from visitors (problem reports) and team (work log entries, files) – `EVT-ProblemReported`, `EVT-WorkLogged`, `EVT-FileAttached`
- **No e-mail or push notifications**; the dashboard highlights what is new – `docs/product/vision.md` (Non-Goals), `RM-TechnicianDashboard`, `RM-HelperDashboard`
- UI in German, visitor pages German and English – `docs/product/vision.md` (Constraints)
- **One volunteer developer, who is also one of the two technicians, maintains it long-term; minimal operating effort** – `docs/product/vision.md` (Constraints)
- Scale: ~60 machines, 2 technicians, a number of helpers, anonymous visitors – `docs/product/vision.md` (Problem)
- No other clients or integrations: `external_systems: []` in `docs/domain/events.yaml`
- Project tooling is already TypeScript on Node – `CLAUDE.md`

## Considered Options
1. **A – Full-stack monolith, used in the browser** (Next.js, TypeScript, shadcn/ui), with a cleanly separated domain layer per bounded context. One codebase, one deployment. Responsive web app; installable as a PWA only if convenient – no offline support.
2. **B – Separate API + web app + native mobile app.** Maximum decoupling; three codebases and release processes.
3. **C – Hybrid:** monolith now with an explicit internal API layer; extract an API or build a native app later when there is concrete need.

Other full-stack monoliths (Rails, Django, SvelteKit, React Router/Remix) would satisfy the same criteria. Next.js is chosen within option A because of the user's preference and because the repository's tooling is already TypeScript, so the maintainer works in a single language.

## Evaluation
| Criterion | A – Next.js monolith | B – API + web + native | C – Hybrid |
|---|---|---|---|
| On-site use (phones/tablets, good Wi-Fi, no offline) | Fully covered by a responsive web app | Native adds nothing without offline needs | Same as A |
| Device features (camera, QR, push) | Camera via the browser's file input with capture; QR codes are scanned by the phone's camera app and open a URL; push is a non-goal | Native camera/scanner – not needed | Same as A |
| User groups & access (anonymous visitors + team roles) | Public visitor pages and authenticated team pages in one app | Needs auth across three apps | Same as A |
| Other consumers | None exist – no API needed | Builds an API nobody else uses | Internal API layer with no consumer yet |
| Team & maintenance (one volunteer, long-term) | One language, one codebase; shadcn/ui components are copied into the repo, so no UI library upgrades | Three codebases, app-store releases – unrealistic for one volunteer | Extra layer to maintain without benefit today |
| Operations (minimal effort) | One deployable + database + photo storage | API, web, app-store accounts | Same as A |
| Future-proofing without up-front cost | Domain layer independent of Next.js keeps later extraction possible | Paid up front | Paid partly up front |
| Effort (relative) | 1 | ~3 | ~1.3 |

## Decision
**Option A: one Next.js (TypeScript) monolith with shadcn/ui, used as a responsive web app in the browser.** Commands are server-side actions; read models are server-rendered queries. The domain logic of each bounded context lives in plain TypeScript modules that do not depend on Next.js, so option C (extracting an API) stays possible if a concrete consumer ever appears. No native app, no offline support, no separate API. Module structure and persistence style: `docs/adr/0002-modular-monolith-state-based-persistence.md`.

The requirements do not demand Next.js specifically; it is chosen within option A because of the user's preference and the existing TypeScript tooling.

## Consequences
- Positive: one codebase, one language (matching the repo tooling), one deployment; visitor pages and team app share domain logic; shadcn/ui gives accessible, mobile-friendly components owned in the repo (Tailwind CSS comes with it).
- Negative / cost:
  - **Upgrade and security discipline.** Next.js changes quickly (routing and caching defaults have changed between major versions) and has had critical advisories – e.g. the 2025 middleware authorization bypass (CVE-2025-29927) and the React Server Components remote code execution "React2Shell" (CVE-2025-55182, December 2025). The visitor pages are public, so updates must be applied promptly: automated dependency update PRs, and authorization checks inside the server-side command layer, never only in middleware.
  - **Photo uploads:** server actions have a small default request body limit (1 MB), while phone photos are several MB. Photos need client-side downscaling or a dedicated upload route; metadata (EXIF, including location) should be stripped from visitor photos.
  - Next.js runs most smoothly on Vercel; self-hosting (standalone Node server or container) is supported but is more work – this couples into the hosting decision.
- Follow-up decisions:
  - Architecture shape → `docs/adr/0002-modular-monolith-state-based-persistence.md` (proposed)
  - Database → `docs/adr/0003-postgresql.md` (proposed)
  - Authentication for team accounts → `docs/adr/0004-team-authentication.md` (proposed)
  - **Hosting** – open, needs user input (budget, existing infrastructure, data protection) → Open Points
  - **File and photo storage** – open, depends on hosting → Open Points
  - **Spam protection for anonymous problem reports** – open → Open Points
  - **i18n** – recommendation, no ADR needed (easy to reverse): the visitor pages use message catalogs for German and English, language from the browser with a manual switch; the team UI is German only; defect titles are shown untranslated (`docs/product/vision.md`).
  - ORM / migration tool – implementation detail for the engineering workflow, not ADR-worthy.
- Spikes (to become stories):
  - Walking skeleton deployed to the chosen hosting: database, team login, one command (e.g. *Report problem*) end-to-end.
  - Photo upload from a phone camera: downscaling, EXIF stripping, storage, display on the machine record.

## Open Points
- **Hosting and file/photo storage:** answered by the user – Vercel with managed PostgreSQL and object storage in the EU, see `docs/adr/0005-hosting-vercel.md` (availability to be verified in the walking-skeleton spike).
- **Spam protection for anonymous problem reports:** answered by the user as recommended – start without CAPTCHA: hidden honeypot field, rate limit per client and per machine, image type/size limits and re-encoding; add a privacy-friendly CAPTCHA only if spam actually appears.
- Confirmed by the user: the long-term maintainer is comfortable with TypeScript/React.
