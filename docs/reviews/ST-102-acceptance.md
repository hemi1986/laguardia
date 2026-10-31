# Acceptance – ST-102: Replace or remove the museum's logo on the welcome page
Date: 2026-10-31 · Tests run: `npx vitest run -t "ST-102"` → 10 passed (2 files); `npx vitest run src/photo/accept-logo.test.ts` → 6 passed; `npx playwright test e2e/museum-logo.spec.ts` → 1 passed · Preview: none (local only)

Traceability: `check-scenarios.ts ST-102` → 10/10 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A technician uploads the first logo | museum-logo.integration.test.ts | Given: `withoutLogo`. When: real form runner as technician with a ~300 KB noise PNG (size asserted). Then: stored name, confirmation text, image in settings, welcome page has `<img src="/logo">` before `<h1`, journal names the technician (actor, previousLogo null); other viewer gets no confirmation | pass |
| Without a logo the welcome page shows only the museum name | same | Section text, only upload button, no replace/remove, section order, welcome page without `<img>` and the name first | pass |
| A technician replaces the logo | same | WebP replaces a logo; stored content type, old content gone, only one object in storage, welcome page, journal with previousLogo | pass |
| A technician removes the logo without being asked | same (+ e2e) | One call, no question; welcome page without image, content deleted, confirmation text, upload offered, journal, upload works again | pass |
| The stored logo is scaled down, carries no metadata and keeps its transparency | same | 2400×1200 transparent PNG with EXIF GPS; asserts 1000×500, hasAlpha, no exif/icc/xmp/comments, transparent and opaque pixels sampled. Literals from the scenario | pass |
| Anything but a PNG, JPEG or WebP ... rejected | same | SVG, PDF named .png, and a 20 000×20 000 PNG header (<2 MB, asserted) each rejected with the literal text; logo unchanged, storage holds only the old logo; no "choose again" sentence | pass |
| A logo larger than 2 MB is rejected | same | 3 000 000-byte JPEG, literal text, logo and storage unchanged | pass |
| A logo changed by someone else meanwhile is not overwritten | same | Second technician removes; upload and removal with the stale version both give the literal conflict text; no logo, storage empty. Extra test: a museum-details save in between does not reject | pass |
| Visitors get the logo without logging in | logo-route.integration.test.ts (+ e2e) | Real Request with no session: 307, Location with `valid-until` = clock + 5 min, `private, max-age=60`; 404 without a logo | pass |
| Helpers cannot replace or remove the logo | museum-logo.integration.test.ts | Both commands as helper give `not-authorized`; logo and storage unchanged | pass |

Also: unit test `accept-logo.test.ts` covers orientation, animation, never enlarging, format kept. The browser test covers a 360 px phone: logo above the name, centred, at most a third of the height, no horizontal overflow, `/logo` redirect, removal in one tap.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Engineering conventions amendment 1: exception to "Only team pages issue view addresses" with the story's sentence | yes | SKILL.md diff contains the sentence verbatim plus the `logoRoute` explanation | yes |
| Amendment 2: logo acceptance of its own | yes | SKILL.md paragraph "The logo has an acceptance of its own"; `src/photo/accept-logo.ts` | yes |
| Amendment 3: form step skipping the browser's photo preparation | yes | SKILL.md bullet "A form with the museum's logo"; `form-runner.ts` `logo: { field }` | yes |
| Usable at 360 px | yes | e2e asserts `pageWidth <= 360` on settings and welcome page | yes |
| List pages fast | no | no list | n/a |
| Command writes its journal entry | yes | EVT-LogoReplaced / EVT-LogoRemoved asserted, with actor and data | yes |
| Texts from message catalogs | yes | team catalogue (`messages/team/collection.ts`), visitor de/en catalogues; error texts via `commandErrorText` | yes |
| No personal data in logs | yes | nothing logged beyond content names on failed delete (existing mechanism) | yes |
| Advisories | n/a | no new dependency (`sharp` already used) | n/a |
| Full verify | yes | per the task: green except three unrelated flaky specs that passed on rerun | yes |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| A rejected 2 MB file is checked in the browser first (with JS) and by the server again; the browser-side message is not a scenario | Context: server checks; conventions note it | no action |
| A visitor's browser keeps the redirect for 60 s: a removed logo can still show for up to a minute, or the cached view address can be near its 5-minute expiry only on long-lived pages | Context states "at most a minute longer" | no action (accepted by the user) |
| Visitor page in English: logo alt text and `/logo` behave the same; alt text exists in visitor.en and visitor.de | not stated | no action |
| Very wide or very tall logos (e.g. 1000×50, 50×1000) on a phone | "at most a third of the screen height" | question: the e2e uses 3:1 only; the height cap is by rule, so likely fine |
| Retired or "Not on display" machine status | irrelevant to the logo | none |
| Two simultaneous uploads | covered by the version check (separate logo record) | none |

## Verdict
accepted
