---
status: accepted
date: 2026-09-26
---

# 0005 – Hosting on Vercel with managed PostgreSQL and object storage in the EU

La Guardia is run and maintained by a single volunteer with minimal operating effort, and visitor photos may show people (`docs/product/vision.md`). We host the Next.js monolith (`docs/adr/0001-tech-stack.md`) on **Vercel**, with **managed PostgreSQL** (`docs/adr/0003-postgresql.md`) and **object storage** for photos and files (manuals and schematics as PDF, photos) – all from Vercel or its integrated providers, all in an **EU region**, so there is no server to run and no backup to operate ourselves. File metadata (file category, title, owning machine or machine model) stays in PostgreSQL; only the file content goes to object storage.

## Consequences
- The user expects, but has not yet confirmed, that Vercel offers both a PostgreSQL database and object storage for this setup. This is verified in the walking-skeleton spike (ADR 0001) before stories build on it:
  - PostgreSQL (e.g. via the Vercel Marketplace) and object storage (e.g. Vercel Blob) are available with an EU region, and the app's functions run in an EU region too.
  - Large files (a scanned manual can be tens of MB) are uploaded directly from the browser to object storage, not through a server function – serverless request bodies are small (a few MB), see also the photo limit in ADR 0001.
  - Which plan is needed: check whether the museum's use is allowed on the free plan (it is restricted to non-commercial, personal use) or needs a paid plan, and what that costs.
- A data processing agreement (GDPR) with the provider(s) is needed because visitor photos are personal data.
- If the spike shows that storage or the EU region is not available as expected, this ADR is revised before implementation continues – the fallback is S3-compatible object storage from an EU provider next to Vercel.
