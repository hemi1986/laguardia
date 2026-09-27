---
id: ST-001
title: Walking skeleton on Vercel with EU database and object storage
type: spike
context: BC-Repair
priority: must
size: M
risk: high
events: [EVT-ProblemReported]
depends_on: []
labels: [mvp, foundation]
status: in-progress
---

## Question
Can La Guardia run as planned in `docs/adr/0001-tech-stack.md` and `docs/adr/0005-hosting-vercel.md`: a Next.js monolith on Vercel whose functions run in an EU region, with managed PostgreSQL and private object storage in an EU region, large files (scanned PDF manuals up to 100 MB) uploaded directly from the browser to object storage, an authentication library that supports username/password with server-side sessions (`docs/adr/0004-team-authentication.md`), and which Vercel plan (and cost) the museum needs?

This spike answers the open question on ADR 0005 in `docs/stories/OPEN_QUESTIONS.md`. The skeleton code is kept and becomes the base of the application. Team login itself is built in ST-004. The research on plan, cost and data processing agreements can be done in parallel by the museum's project owner (not the developer).

## Timebox
2 days. If the timebox runs out, stop and document what is known.

## Acceptance Criteria
- [ ] A Next.js (TypeScript) app from this repository's engineering workspace is deployed to Vercel; every push to the main branch deploys automatically.
- [ ] The app's functions are configured to run in an EU region; the region is documented with a screenshot or setting reference.
- [ ] Managed PostgreSQL in an EU region is connected; schema migrations run automatically in the build/deployment pipeline.
- [ ] Preview deployments and production use separate databases and separate secrets.
- [ ] One command works end to end on the deployed app: *Report problem* with a description for one hard-coded test machine is stored in PostgreSQL and shown again on a page (no styling required).
- [ ] Object storage in an EU region is connected and private: content is neither listable nor readable without permission, and the app can read stored content for a logged-in team member (private reads, e.g. short-lived signed addresses or streaming through the server).
- [ ] A PDF of 100 MB is uploaded directly from the browser to object storage without passing through a server function, using a short-lived permission issued by the server, and can be downloaded again.
- [ ] Auth library check (story review SP-3): one established library is chosen that supports username/password login and server-side sessions that can be ended when an account is deactivated; the choice and the reason are documented.
- [ ] Backups: the database provider's automatic backup and restore options are documented (no self-operated backup; see ST-062).
- [ ] Vercel plan: it is documented whether the museum's use is allowed on the free plan (non-commercial, personal use only) or which paid plan is needed, with the monthly cost for Vercel, database and storage at ~60 machines, a few hundred photos per year and ~200 PDF files.
- [ ] A data processing agreement (GDPR) is available from Vercel and from every database/storage provider used; links are documented.
- [ ] Result is written into `docs/adr/0005-hosting-vercel.md` (consequences) – or, if EU storage or region is not available, a follow-up ADR is proposed with the fallback (S3-compatible object storage from an EU provider); the row in `docs/stories/OPEN_QUESTIONS.md` is answered.

## Out of Scope
- Team login and roles (ST-004, ST-005)
- Photo downscaling and EXIF stripping (ST-002)
- CI and test harness (ST-059), monitoring (ST-061)
- Production-ready UI

## Open Questions
- none
