---
id: ST-070
title: Full Content Security Policy for scripts
type: tech-task
context: BC-Repair
priority: should
size: M
risk: medium
events: []
depends_on: [ST-003]
labels: [follow-up, security]
status: draft
---

## Task
Follow-up of ST-003 (module structure, command layer, event journal): the CSP follow-up the user decided during ST-003 (`docs/reviews/ST-003-code-review.md`, preamble: "the CSP follow-up"; `docs/reviews/ST-003-acceptance.md`, checklist row "Security headers"). Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

ST-003 set the security headers in `next.config.ts`, but the Content Security Policy there is only `frame-ancestors 'none'`: it forbids framing and does nothing against injected scripts. Visitors type free text that team members read (ST-013), so a script policy is the second line of defence behind output encoding.

Build a nonce-based script policy as described in the Next.js guide `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`:
- Next.js 16 calls middleware "proxy"; the existing `src/proxy.ts` (CSRF Origin check for every POST, ST-003) generates a fresh, unpredictable nonce per page request and sets the CSP on the request (so Next.js applies the nonce to its own scripts) and on the response. The CSRF check stays as it is.
- `script-src` allows `'self'`, the nonce and `'strict-dynamic'`; no `'unsafe-inline'`; `'unsafe-eval'` only in local development (`next dev`), never on preview or production.
- The rest of the policy keeps or tightens the ST-003 protection: `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `default-src 'self'`, and only the sources that Vercel Blob needs for uploads and presigned downloads (`docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`, `docs/architecture/photos.md`) – the Blob store's host, no general wildcard.
- The `frame-ancestors`-only CSP in `next.config.ts` is replaced, so every response carries exactly one CSP (two CSP headers would be combined by the browser). The other headers in `next.config.ts` stay.
- Nonces need dynamic rendering: every page is rendered per request (the guide notes that static rendering, ISR and Partial Prerendering do not work with nonces). The visitor machine page is never served from a shared cache anyway (ST-010); the legal pages (ST-064) become dynamic as well.
- Vercel injects its toolbar script into preview deployments; the policy may block it on previews. That is acceptable – the browser tests must not rely on the toolbar, and CSP violations caused only by the toolbar are not counted as failures.
- [OPEN] `style-src`: whether styles also get the nonce or keep `'unsafe-inline'` is not decided – see Open Questions.

**Ordering.** This task is not a precondition for building the visitor pages (ST-010, ST-013, ST-064), but it should be done before visitor problem reports are live in production – the same gate as ST-065 – because from then on visitor free text reaches the team pages. Doing it before ST-010 has the added benefit that every later page is built under the policy from the start. [OPEN] Whether ST-010/ST-013 should formally depend on this task is for the PO and lead dev to decide in the story review.

## Acceptance Criteria
- [ ] Every page response – visitor machine page, report form, legal pages, login and team pages that exist when this task is done – carries exactly one `Content-Security-Policy` header whose `script-src` contains a `'nonce-…'` source and `'strict-dynamic'` and neither `'unsafe-inline'` nor `'unsafe-eval'`; asserted by the browser test in `e2e/security.spec.ts` against the commit's Vercel preview.
- [ ] Two consecutive requests for the same page get different nonces, and each nonce has at least 128 bits of randomness.
- [ ] The policy still contains `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` and `form-action 'self'`; the other ST-003 security headers are unchanged (existing header check stays green).
- [ ] An inline script without the nonce, injected into a page in a browser test, does not run, and the browser reports a CSP violation for it.
- [ ] All existing browser tests (including the 360 px checks: page width ≤ 360 px) pass on the preview under the policy, and no CSP violation is reported in the browser console during them.
- [ ] Both CSRF browser tests from ST-003 (foreign Origin, missing Origin) stay green.
- [ ] A photo upload and a file upload to the private Vercel Blob store and a presigned download of a stored file work on the preview under the policy; the policy allows only the Blob store's host for them.
- [ ] `npm run dev` works locally under the policy (with `'unsafe-eval'` only there).
- [ ] With every page rendered per request, the visitor machine page responds in under 1 s on the preview (Definition of Done, ST-059).
- [ ] The engineering conventions (`.claude/skills/engineering-conventions/SKILL.md`) state that pages are rendered per request because of the nonce, and that no inline script or third-party script is added without the nonce.

## Out of Scope
- The CSRF protection itself (ST-003, `src/proxy.ts`)
- Content Security Policy reporting to an external collector (`report-to` endpoint)
- Subresource Integrity (experimental in Next.js, not needed with nonces)
- The separate Blob store for previews (ST-061)

## Open Questions
- [OPEN] `style-src`: nonce for styles as well, or `'unsafe-inline'` for styles only? A nonce does not cover `style` attributes, so any inline `style={…}` in components (or in libraries such as the authentication UI) would break. Recommendation: `'self'` plus the nonce for style elements; check the pages for `style` attributes during implementation and, if needed, allow `'unsafe-inline'` for styles only – scripts are the real risk.
- [OPEN] Should ST-010 and ST-013 depend on ST-070, so the visitor pages cannot go live without the script policy? Recommendation: no hard dependency for building them, but ST-070 done before visitor problem reports are live in production (together with ST-065).
