# Acceptance – ST-010: Visitor machine page in German and English
Date: 2026-10-02 · Tests run: `npx vitest run` → 41 files, 238 tests passed; `npx playwright test e2e/visitor-machine-page.spec.ts` → 7 passed, 1 skipped (the cache-header test, preview only; reported green in CI) · Preview: https://laguardia-hm53snevm-hemi6.vercel.app (behind protection, no machines; curl only got the 302 to the protection page, so not checked by me)

`check-scenarios.ts ST-010`: 8/8 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Visitor with a German browser opens the page | e2e/visitor-machine-page.spec.ts | Given: machine registered through the real team pages, fresh phone context with locale de-DE, 360 px. When: opens /m/<number>. Then: h1 equals the model title, "Williams · 1997", "Status: Spielbereit", link "Problem melden" to /m/<n>/melden; no horizontal scroll. Literals, not recomputed. | OK |
| Visitor with an English browser opens the page | same | en-GB; asserts "Status: Playable" and "Report a problem". Does not assert that the German texts are absent, but the German status word is not present. | OK |
| Other browser languages get English | same, plus visitor-locale.test.ts | fr-FR; English texts asserted. The rule (q-values, "fr, de;q=0.8") is unit-tested. | OK |
| Visitor switches the language | same | Real click on the switch, stays on the same URL, English; a second machine's page is English; the switch then offers "Deutsch". The cookie is carried by the same browser context. | OK |
| Machine not on display | same | Machine registered as not-on-display; asserts the German sentence and that the report link is absent (count 0). | OK |
| Changes are visible immediately | src/app/m/[museumNumber]/visitor-machine-page.integration.test.ts | Data and view are called directly (not the route, no HTTP reload): "Spielbereit" first, then the status is changed through a command, then "Außer Betrieb". It proves the data is read per call. That it is not cached on the route rests on `headers()`/`cookies()` use and the `/m/` Cache-Control rule (see the cache-header test below). | OK with remark R1 |
| No internal data in the page source | e2e (+ integration test "shows no problem report text…") | e2e inspects the real HTML for a registered machine: no technician name, no location, no UUID. The integration test reports a problem with a secret text and checks that text, the team member name and any UUID are absent. The e2e has no problem report in it, so "no report text" is only covered at integration level (view output, not full route HTML). | OK with remark R2 |
| Unknown museum number | e2e | HTTP 404, German sentence for de-DE, English sentence for en-US. | OK |

Extra: "the QR address is never served from a shared cache" checks `private`, `no-store`, not `public`/`s-maxage` on /m/LG-999. It skips locally, so I did not run it. Where the preview is reachable, CI covers it.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | The e2e runs at 360 px and asserts scrollWidth ≤ 360. `Page` has `break-words`, so a long title wraps. No test uses a very long title. | OK |
| List pages fast | no | No list. One joined query by museum number. | n/a |
| Every command writes its journal entry | no | Read model and a language cookie only. | n/a |
| Texts from the message catalogs | yes | `visitor.de.ts` / `visitor.en.ts` with the same keys (typed). The status names match the CONTEXT.md wording. | OK |
| No personal data in logs | yes | Nothing is logged. The query selects only title, manufacturer, year and status, so nothing else can reach the page. | OK |
| Never from a shared cache | yes | `next.config.ts` sets `Cache-Control: private, no-store` for `/m/:path*`. The page is dynamic. The preview-only test checks it. | OK (not run by me) |
| Language remembered | yes | A cookie, one year, SameSite=lax, set by a Server Action. The `back` redirect only follows paths on this site (`//` rejected). | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Lowercase number ("lg-042", from hand-typed or a QR with a different case): the lookup is case-sensitive, so it gives the 404 "no machine" page | No rule. The story says "addressed by museum number". | Question. Cheap to fix here if the user wants it (compare case-insensitively or redirect to the canonical number). Not follow-up-hurdle material. |
| URL-encoded number ("LG%2D042") | No rule | Works through `decodeURIComponent`. Nothing to do. |
| Malformed percent sequence ("/m/%E0%A4%A"): `decodeURIComponent` in `page.tsx` can throw a URIError. I could not check whether Next rejects it earlier (400), because the preview is protected and no dev server ran. | No rule. | Question: check once on the local server. If it gives a 500, fix here (catch and treat as unknown, ~10 minutes). No new story. |
| Retired machine: "unknown" 404 text says "no machine with this museum number", which is slightly untrue | Out of scope: "Retired machines (ST-055)" | ST-055 takes it. The code comment says so. |
| 404 page has no language switch, so a visitor with an unsuitable browser language cannot change it | No rule. Scenario 4 only says "visitor machine page". | Question, low priority. |
| Very long machine model title at 360 px | DoD: usable at 360 px. | Not tested, but `break-words` on the page makes it wrap. Optionally add the long title to the existing e2e. |
| Switch for a visitor without JavaScript, or a cookie-blocking browser: the language falls back to the browser's, with no error | none | Fine. The form works without JS. |
| Machine status "Limited" and "Out of order" in both languages: only Playable, Out of order (de) and Not on display are asserted in tests | The context names the statuses only by the glossary. | Question, low priority. Typed catalog keys guard against a missing translation. |
| Open defect titles and the untriaged count named in the context "Fields" are not shown | Out of Scope lists ST-013 and ST-018. | OK, deferred. |
| Concurrent change between load and render | none | Not an issue. A single query per request. |

## Remarks
- R1: Scenario 6 is tested at data + view level, not by reloading the route. It still proves what the story needs (fresh read per call). The route-level guarantee (no cache) is the header test, which only runs on the preview.
- R2: Add a visitor problem report to the e2e source test, or accept the integration coverage of "no report text".

## Verdict
**accepted with remarks.** All 8 scenarios have a real test that passes. No rule is violated. The open points are R1, R2 and the questions above, mainly the lowercase number and a possible 500 on a malformed `%` sequence. None meets the follow-up hurdle.
