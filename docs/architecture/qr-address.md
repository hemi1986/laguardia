# The QR address of a machine (ST-060)

Every machine's QR sticker (ST-011) carries one address:

```
https://eschbach.michaelschempp.de/m/<museum number>
```

for example `https://eschbach.michaelschempp.de/m/LG-042`.

- **Only the museum number** follows `/m/` – no internal ID, no language, no query. The museum number is unique among all machines ever registered and never reused (`CONTEXT.md`, HS-17, D11), so an address once printed never points to another machine.
- **One address for everyone.** A visitor sees the visitor machine page (ST-010) in their language; a logged-in team member will see the machine record there – *comes with ST-011*. The page reads the request, so it is never served from a shared cache.
- **An unknown museum number** answers "Kein Gerät mit dieser Museumsnummer." / "There is no machine with this museum number." with HTTP status 404 (ST-010).
- **A reserved museum number** – the number a machine had before a correction – will still lead to its machine: the address redirects to the current museum number – *comes with ST-035*.
- **The museum's own domain, never the provider's.** The Vercel default address (`laguardia.vercel.app`) is written down in no link, page, script or configuration of the repository (`src/platform/provider-address.test.ts`), and no `BETTER_AUTH_URL` is set in Vercel (checked 2026-10-02). It still serves the production deployment – the user decided a redirect is unnecessary (2026-10-02) – so nobody should hand it out; the login's address is `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets to the custom domain.
- **Stickers take the domain from one written-down place** – a single setting in the code, never the request's host and never `VERCEL_PROJECT_PRODUCTION_URL` (which falls back to `*.vercel.app` when no custom domain is attached). *ST-011 implements it.*

## Stability

The scheme `/m/<museum number>` is fixed. **The domain `eschbach.michaelschempp.de` is provisional** (user, 2026-10-02): it may still change until the first sticker is printed (ST-011, ST-042) – from then on neither the domain nor the scheme ever changes, because printed stickers cannot be updated. Changing the domain before that means: add the new domain to the Vercel project (Production), point its DNS to Vercel, **redeploy production** (environment values such as `VERCEL_PROJECT_PRODUCTION_URL` are read at deployment), and update this document and the sticker setting of ST-011.

## Set up (2026-10-02)

- Vercel project `laguardia` → Settings → Domains → `eschbach.michaelschempp.de`, environment Production.
- DNS at the provider of `michaelschempp.de`: a `CNAME` for `eschbach` with the target Vercel shows.
- Vercel issues the HTTPS certificate itself.
