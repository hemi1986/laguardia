# Acceptance – ST-070: Full Content Security Policy for scripts
Date: 2026-10-25 · Tests run: no local run by me; evidence read from the GitHub run "Browser tests on preview" (run 40229536796, commit 40c9a1d) → 22 passed, 184 skipped, 0 failed; CI "verify" (run 40229536780) green; main session's local `next dev` run: 205 passed · Preview: Vercel preview of commit 40c9a1d (tested by the workflow)

## Checklist (tech task – each item needs evidence)
| # | Item | Evidence | Status |
|---|---|---|---|
| 1 | Exactly one CSP on every page, `script-src` with nonce + `'strict-dynamic'`, no `'unsafe-inline'` / (on preview) no `'unsafe-eval'` | `e2e/security.spec.ts` "every page carries exactly one script policy…" covers `/`, `/login`, `/datenschutz`, `/m/LG-999`, `/m/LG-999/melden`; passed on preview. Weak points: `/m/LG-999` is the unknown-number page, not a real machine page. The team-pages test is skipped on the preview (no technician account); passed locally only, where `'unsafe-eval'` is allowed. | Evidence, with the remarks below |
| 2 | Nonce = `randomBytes(16)` base64; two requests differ | `newNonce()` in `src/platform/content-security-policy.ts` uses `randomBytes(16).toString("base64")`. Tests: the regex `{22}==` proves 16 bytes; "two requests … different nonces" passed on preview. | Evidence |
| 3 | `style-src` has `'self'` + nonce; `'unsafe-inline'` only if needed (named in PR); never in `script-src` | "the policy keeps the ST-003 protection and allows styles only with the nonce" asserts `['self', nonce]` on preview (exact equality), passed. The need for `style` attributes is expressed as `style-src-attr 'unsafe-inline'` (not in `style-src`; narrower than the checklist allows). The story requires it to be **named in the pull request** – the PR does not exist yet. | Evidence; PR text still to write |
| 4 | `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; other headers unchanged | Same test asserts all four plus `default-src 'self'` (exact equality); existing "pages are served with the security headers" passed on preview. `next.config.ts` diff removes only the CSP header. | Evidence |
| 5 | Injected inline script without nonce does not run, violation reported | "an injected inline script … does not run and is reported as a violation" (route-rewrites the HTML, asserts `window.injected` undefined and a console violation). Passed on preview. Genuine Given/When/Then. | Evidence |
| 6 | All existing browser tests (360 px) pass under the policy, no CSP violation in console | Fixture in `e2e/fixtures.ts` fails every test on a CSP console error (ignores `vercel.live`). Local full run 205 passed. On the preview only 22 of 206 ran (184 skipped, no technician account), so the 360 px checks of team pages and the team flows were **not** run on the preview. Public 360 px tests (start page, legal pages, visitor pages) ran and passed. | Partial: local only for team pages; preview covers public pages |
| 7 | Both CSRF tests stay green | Foreign-origin and missing-origin tests passed on preview (and locally). | Evidence |
| 8 | Photo + file upload and presigned download on the preview; policy allows only the Blob store's host | Preview: the spec "the upload works under the security headers" (`file-upload.spec.ts:124`) is skipped; no upload/download ran. Local: passed against the Development Blob store (per main session; I did not rerun it). The host rule is implemented (`blobStoreHost()`), plus `https://vercel.com/api/blob/` for the upload API. **Not proven on the preview**: that `BLOB_STORE_ID` is set there so the host really lands in `img-src`/`connect-src`; if it were unset, the policy would silently omit the Blob host (`blobStoreHost` returns undefined). Pending: manual check by the user. | **Missing on preview** (local evidence only) |
| 9 | `npm run dev` works locally with `'unsafe-eval'` only there | Local full run under `next dev` 205 passed; code gates `'unsafe-eval'` on `NODE_ENV === "development"`; preview test asserts its absence. | Evidence |
| 10 | Visitor machine page < 1 s on the preview | No timing assertion in the diff or the run. | **Missing** (main session to close) |
| 11 | Engineering conventions state per-request rendering and "no inline/third-party script without the nonce" | `.claude/skills/engineering-conventions/SKILL.md` lines in the diff state both, name `await connection()`, and the test option for provoked violations. | Evidence |

## Does each test check its criterion?
Read side by side with the diff: header assertions use literal expected values and exact equality (not recomputed); the injection test goes through the real page via a route rewrite; nonce difference compares two real responses. One gap: the nonce check proves nonce *shape* and uniqueness, not that Next.js actually applies the nonce to its own scripts. That is covered indirectly because hydrated pages (login Server Action test, "same Server Action … reaches the action") pass under the policy and the fixture catches blocked scripts.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | Yes (regression) | Existing 360 px specs pass locally; public ones on preview | Partly on preview (see item 6) |
| List pages fast | Yes (every page now dynamic) | No timing test (item 10) | Missing |
| Journal entry per command | No (no command) | – | n/a |
| Texts from catalogs | No | – | n/a |
| No personal data in logs | Yes, trivially | Nonce/policy not logged; fixture logs only CSP console text | OK |
| Security advisories | No | – | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| `BLOB_STORE_ID` unset or in a different form on the preview/production: Blob host silently missing from `img-src`/`connect-src`, photos/uploads blocked | Checklist 8 ("policy allows only the Blob store's host") | Fix now: confirm on the preview (user's manual check covers it); optionally log/fail at build when missing |
| Production is a different Blob store than the preview (ST-061) | Out of scope (ST-061) | Question: ST-061 must keep the policy in step; one line in its notes |
| Real visitor machine page (existing machine) never tested for CSP on the preview, only the unknown-number page | Checklist 1 names "visitor machine page" | Fix now if a preview machine exists; otherwise rely on the local run |
| Error pages (404, `error.tsx`, 500) and Server Action responses: CSP set by the proxy matcher only for matched paths; `/api/*` routes (upload address, downloads) carry no CSP | Checklist says "every page response"; API excluded by the matcher (documented in proxy.ts) | Question: fine for JSON; a file download served from an API route inherits no script policy – acceptable since it redirects to Blob |
| Vercel toolbar on preview blocked: filter ignores only messages containing `vercel.live` | Task text accepts it | OK |
| `style-src-attr 'unsafe-inline'` allows injected style attributes (CSS-based exfiltration is limited, but possible) | Decided at test plan by the user | Accepted decision; name it in the PR |
| Nonce regex requires exactly 22 chars + `==`; fine for 16 bytes | – | none |

## Verdict: accepted with remarks
No scenario lacks a test, nothing failed, and no rule is violated. Remaining evidence gaps, none a new story (all closable within this story):
1. Item 10: no visitor machine page timing (< 1 s) on the preview.
2. Item 8: upload/download on the preview not run (local run only; user's manual check pending). Also confirm the preview has `BLOB_STORE_ID` so the Blob host is in the policy.
3. Item 6: 360 px and team-flow browser tests ran under the policy only locally; the preview skipped 184 tests for lack of a technician account.
4. Item 3: the pull request must name why `style-src-attr 'unsafe-inline'` is needed (React `style` props, Base UI).
5. Item 1: optionally assert the CSP on a real machine page instead of only the unknown-number page.

Tick items 2, 4, 5, 7, 9, 11 on the evidence above; 1 and 3 once the PR text exists; 6, 8, 10 once the gaps are closed.
