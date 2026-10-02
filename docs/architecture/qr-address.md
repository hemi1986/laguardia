# The QR address of a machine (ST-060)

Every machine's QR sticker (ST-011) carries one address:

```
https://eschbach.michaelschempp.de/m/<museum number>
```

for example `https://eschbach.michaelschempp.de/m/LG-042`.

- **Only the museum number** follows `/m/` – no internal ID, no language, no query. The museum number is unique among all machines ever registered and never reused (`CONTEXT.md`, HS-17, D11), so an address once printed never points to another machine.
- **One address for everyone.** A visitor sees the visitor machine page (ST-010) in their language; a logged-in team member sees the machine record (ST-011). The page reads the request, so it is never served from a shared cache.
- **An unknown museum number** answers "Kein Gerät mit dieser Museumsnummer." / "There is no machine with this museum number." with HTTP status 404 (ST-010).
- **A reserved museum number** – the number a machine had before a correction – still leads to its machine: the address redirects to the current museum number (ST-035).
- **The museum's own domain, never the provider's.** The Vercel default address (`*.vercel.app`) is used in no link and no configuration (`src/platform/provider-address.test.ts`); it does not redirect – the user decided a redirect is unnecessary (2026-10-02). The login takes its address from `VERCEL_PROJECT_PRODUCTION_URL`, which is the custom domain once one exists, so logging in works on the museum's domain only.

## Stability

The scheme `/m/<museum number>` is fixed. **The domain `eschbach.michaelschempp.de` is provisional** (user, 2026-10-02): it may still change until the first sticker is printed (ST-011, ST-042) – from then on neither the domain nor the scheme ever changes, because printed stickers cannot be updated. Changing the domain before that means: add the new domain to the Vercel project (Production), point its DNS to Vercel, and update this document.

## Set up (2026-10-02)

- Vercel project `laguardia` → Settings → Domains → `eschbach.michaelschempp.de`, environment Production.
- DNS at the provider of `michaelschempp.de`: a `CNAME` for `eschbach` with the target Vercel shows.
- Vercel issues the HTTPS certificate itself.
