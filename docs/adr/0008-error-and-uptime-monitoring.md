---
status: proposed
date: 2026-10-15
---

# 0008 – Error monitoring with Sentry (EU), uptime checks with Better Stack

## Context and Problem
Production problems must become visible without anyone having to look, and the two pages visitors and team depend on
must be watched (ST-061, story review 2026-09-26, TT-D). Neither exists yet. Vercel's own logs are only seen when
someone opens them. Two external services would process data from production, so the choice carries a data protection
obligation and some lock-in (SDK in the code, alert rules, accounts) – which is why it is recorded here.

## Driving Requirements
- A deliberately raised error in production appears in the error monitoring within 5 minutes – `docs/stories/ST-061-environments-and-operations.md`
- No personal data in error reports or logs: no problem report text, no photos, no names – same story
- An uptime check on the visitor machine page and the login page; an alert to the maintainer when the visitor machine page is unreachable for 5 minutes – same story
- Minimal operating effort and cost, one volunteer maintainer – `docs/product/vision.md` (Constraints)
- EU hosting and a data processing agreement for anything that may see visitor data – `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`

## Considered Options
1. **Sentry (EU data region) for errors and uptime** – one account, but the free Developer plan includes only one uptime
   monitor and cannot buy more; two checked pages need the Team plan (~$26/month).
2. **Sentry (EU data region) for errors, Better Stack for uptime** – both free tiers suffice.
3. **Better Stack for both** (logs/errors and uptime) – one EU vendor, but error tracking of a Next.js app is less
   direct than with Sentry's SDK (source maps, server and client errors, Server Actions).
4. **Vercel only** (runtime logs, log drains) – no extra vendor, but nothing alerts by itself without a drain to a
   further service; not a solution on its own.

## Evaluation
| Criterion | 1 Sentry only | 2 Sentry + Better Stack | 3 Better Stack only | 4 Vercel only |
|---|---|---|---|---|
| Error within 5 min, with stack trace | yes | yes | partly (log-based) | no alert |
| Two uptime checks, alert on 5 min down | paid plan | yes (free: 10 monitors, 3-min interval, e-mail) | yes | no |
| EU data, DPA | Frankfurt, DPA | Frankfurt + EU company (Prague), DPAs | EU, DPA | covered by ADR 0006 |
| Cost | ~$26/month | $0 | $0–paid for logs | $0 |
| Accounts to run | 1 | 2 | 1 | 0 |

## Decision
**Option 2: Sentry in its EU data region (Frankfurt) for error monitoring, Better Stack Uptime for the uptime checks** –
both meet the requirements on their free tiers, both keep data in the EU, and the cost stays at zero for a volunteer
project; the second account is the price.
- **Sentry:** `@sentry/nextjs`, data region EU, on production only (no DSN in preview and development). Personal data
  stays out by configuration and is then checked on a sample: default PII collection off, no request bodies, no
  cookies, no user; `beforeSend` removes anything that could carry typed text (form data, Server Action arguments,
  query strings of team pages); no session replay. Alerts by e-mail to the maintainer.
- **Better Stack Uptime:** two HTTP monitors – a visitor machine page (`/m/<museum number>` of a machine that will not
  be retired) and `/login` – with alerts by e-mail to the maintainer after 5 minutes of failure.
- **Accounts:** both are the maintainer's own monitoring accounts (ST-061 Out of Scope: no notifications to team
  members); the DPAs of Sentry and Better Stack are accepted by the account owner.

## Consequences
- Positive: errors in production arrive with a stack trace within minutes; outages of the two pages are noticed
  without anyone looking.
- Negative / cost: two more vendors in the data processing record; a free-tier limit change could force a plan or a
  switch – the SDK is the only code dependency, the uptime checks need none.
- The DPAs of Sentry (https://sentry.io/legal/dpa/) and Better Stack are recorded with their acceptance, like the
  Vercel and Neon DPAs (ST-065).
- Follow-up: ST-061 builds it – in the museum's Vercel Pro team after ST-065, so nothing is set up twice.

## Open Points
- None.
