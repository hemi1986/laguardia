# Code review – ST-064: Legal pages for the visitor pages in German and English
Base: main · Commits: 5 · Date: 2026-10-04

Scope reviewed: `git diff main...HEAD` (pages `/datenschutz`, `/impressum`, `LegalPage`, `VisitorLegalLinks`, `legal` section of the visitor catalogs, legal links on the start page, the visitor machine page incl. confirmation, the report form and the unknown-machine page, `e2e/legal-pages.spec.ts`, `src/app/visitor-legal-links.test.ts`, ST-042 checklist item).
These user decisions (2026-10-04) were respected and not reviewed again: placeholder privacy notice in the catalogs, imprint `null` with `/impressum` returning 404, the addresses, and the approved test plan.

Checks: `check-language.ts` reports no new warnings from this diff (all 7 warnings come from older code). `visitor-legal-links.test.ts` and `messages.test.ts` pass. No commands, events or read models are involved (`events: []`), so ADR 0002 command/journal rules don't apply. The pages are public and read only the catalog and the request locale. They post no IDs and log nothing. The language switch's `back` is a fixed path, and the existing same-site check validates it.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Design | `src/app/page.tsx:17`, `src/app/m/[museumNumber]/page.tsx:38`, `.../melden/page.tsx:40`, `.../not-found.tsx:21`, `src/app/legal-page.tsx:24` | Every visitor page now repeats the same frame: `<div lang>` → `Page` → `VisitorLanguageSwitch` … `VisitorLegalLinks`. Adding the legal links meant touching every visitor page, and a future visitor page can quietly miss them. That would break "reachable from every visitor page", and nothing checks for it except the e2e test on today's three pages. | Shotgun Surgery, Duplicated Code; conventions "Every visitor page shows `VisitorLanguageSwitch` and sets `lang`" | Deepen into one visitor page frame (a `VisitorPage` module taking `locale`, `messages`, `back`, `title`, children) that owns `lang`, the switch and the legal links. Then the convention line can name it. |
| 2 | minor | Language | `src/platform/messages/visitor.de.ts:84`, `visitor.en.ts:63` | "Standortdaten" / "location data" means GPS metadata here. But **Location** (_UI (de)_: Standort) in `CONTEXT.md` means where a machine stands in the museum. The same word in two meanings is a collision, even though the story wording says "location metadata". | Glossary `CONTEXT.md` (Location) | Use "GPS-/Ortsdaten (Geodaten)" / "GPS data (geolocation)" in the placeholder, and give the museum the same hint for its own text (ST-042). |
| 3 | minor | Type safety | `src/platform/messages/visitor.de.ts:89-90` | `privacyNotice: {…} as LegalText` and `imprint: null as LegalText \| null` are type assertions. An assertion accepts an object that is *missing* `sections` (a subtype check in either direction), so a museum text pasted in with a typo'd key would type-check and break at render. | Code smell (unchecked cast) | Declare the texts as typed constants (`const privacyNotice: LegalText = {…}`, `const imprint: LegalText \| null = null`) and reference them in the catalog. This widens the type without an assertion. |
| 4 | minor | Test quality | `e2e/legal-pages.spec.ts:75-79` | The imprint half of "Legal pages in English" sits behind `if (count > 0)`. Today it never runs. Once the museum provides an imprint, it only checks that the h1 is `not` "Impressum", which proves nothing about the English text. This is accepted for now (imprint `null` by decision), but the branch will be the only coverage later and is weak. | tdd: scenario's Then not checked | When the branch can run, assert the English imprint title literally. Or let ST-042's go-live item add that assertion together with the texts. Leave a note in the ST-042 checklist item. |
| 5 | minor | Test quality / UX | `src/app/impressum/page.tsx:8` | Without an imprint, `/impressum` falls through to the default Next.js 404 (there is no root `not-found.tsx`): an English, unstyled page with no visitor language and no way back. No test pins the 404. This is in line with the decision; only the look and the missing guard are noted. | Conventions (visitor pages: language, `lang`); seam catalog | Optional: a 404 assertion (`page.request.get("/impressum")`, like `home.spec.ts` does for the spike paths) so a stray imprint route can't ship by accident. |
| 6 | minor | Duplicated Code | `src/platform/messages/visitor.de.ts:72`, `visitor.en.ts:51` | The museum name is a third and fourth literal copy of `home.museum`. | Duplicated Code | Fine for placeholder text that the museum will replace. If the museum's own text keeps the name, consider deriving it from `home.museum`. |
| 7 | minor | Stale comment | `src/app/page.tsx:9-10`, `src/platform/messages/visitor.de.ts:9` | The comments still say the start page is a placeholder "until … the legal pages (ST-064)". The legal pages exist now and did not replace the start page. | Mysterious/stale documentation | Drop "and the legal pages (ST-064)" from both comments (and from the `e2e/home.spec.ts:5` doc comment). |
| 8 | minor | React keys | `src/app/legal-page.tsx:27` | `key={section.heading}` assumes unique headings in a text the museum writes. Duplicate headings would give React key warnings. | Judgement call | Key on the index, like the paragraphs, or on heading plus index. |

Severity counts: blocker 0 · major 0 · minor 8 · follow-up 0

Not flagged:
- The scenario tests sit at the agreed seams and go through the browser or the rendered component only.
- Scenario 1 checks German through the `lang="de"` content. Scenario 3 checks the links on the machine page, the report form and the confirmation.
- Scenario 4's unit test varies only the catalog state, matching the seam catalog row "a page state the shared databases can never show".
- The key-equality test in `messages.test.ts` keeps the German and English catalogs agreeing on whether an imprint exists.

ready to merge
Most important: the visitor page frame (lang + language switch + legal links) is copied into every visitor page. Deepen it into one `VisitorPage` module so a new visitor page can't miss the legal links (finding 1).

## Resolution (2026-10-04, /implement refactor step)
| # | Outcome |
|---|---|
| 1 | Fixed – `src/app/visitor-page.tsx` (`VisitorPage`) owns `lang`, the language switch and the legal links; the start page, the visitor machine page, the report form, the unknown-machine page and `LegalPage` use it. |
| 2 | Fixed – "GPS-Daten" / "GPS data" in the placeholder privacy notice. |
| 3 | Fixed – `privacyNotice: LegalText` is a typed constant; the `legal` section is a constant with an explicit type (`imprint: LegalText \| null`). A bare `const imprint: LegalText \| null = null` would have been narrowed to `null` by TypeScript, so the section carries the type. No assertion left. |
| 4 | Fixed in part – the imprint branch now asserts the English content (`lang="en"`) has an h1 on `/impressum`; its literal English title is checked when the museum's text arrives (ST-042 item). |
| 5 | Fixed in part – new e2e test "the imprint address is not found while the museum provides no imprint" pins the 404. The default unstyled Next.js 404 for unknown paths outside `/m/…` is left as it is (not this story's subject; revisit when a visitor-wide not-found page is wanted). |
| 6 | Skipped – placeholder text the museum replaces (ST-042). |
| 7 | Fixed – comments in `src/app/page.tsx`, `visitor.de.ts` and `e2e/home.spec.ts`. |
| 8 | Fixed – sections keyed by index. |
