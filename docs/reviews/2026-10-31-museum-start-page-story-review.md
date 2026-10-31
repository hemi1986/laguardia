# Story review 2026-10-31 – feature `museum-start-page` (ST-100 – ST-103)

Lead-dev pass over all three lenses (value, build, UX). Decisions the user settled in the `/feature` session of
2026-10-31 are taken as settled; conflicts are flagged, not reopened. Frontmatter set: `size`, `risk`, `depends_on`,
`priority`. `status` untouched (all `review`). Everything else below is a recommendation for the requirements-engineer.

## Summary

| Story | Testable | size | risk | priority | Split/recommendation |
|---|---|---|---|---|---|
| ST-100 Museum settings (name, listing switch) | yes; 8 scenarios | M | medium | should | No split. Decide the storage shape of three separately versioned parts before building (major 1). Split scenario 1. |
| ST-101 Welcome page with the machines | yes; 9 scenarios | M | low | should | No split. Pin the sort order (collation, ties). Works without the logo. |
| ST-102 Logo | mostly; 10 scenarios | L | medium | could | Splitting proposal below (optional). Needs a logo pipeline of its own, not `acceptPhoto`. Convention amendments. |
| ST-103 Legal texts | needs two fixes; 10 scenarios | M | medium | should | No split. New dependency needs an ADR; pin what "shown as plain text" means. Glossary conflict "Rechtstexte". |

`depends_on`: ST-100: none (foundation stories, ST-070, ST-078 and ST-064 are done). ST-101, ST-102, ST-103: `[ST-100]`
(the page and the aggregate). No dependency among ST-101, ST-102, ST-103: ST-102 adds the logo to whichever welcome page
exists (the minimal ST-078 page, or ST-101's); ST-101 works without the logo. Suggested build order: ST-100, ST-101,
ST-103, ST-102 (the priority `could` of ST-102 produces exactly this order in the backlog).

Scenario counts: 8 / 9 / 10 / 10. Within the limit, but ST-102 and ST-103 are at it; the cuts below give room.

## Value (PO lens)

Real roles (visitor, technician); fits the vision (non-goal "public website" is clarified in `vision.md` and the stories
stay inside it: name, logo, legal texts, a report entry point, no hours or news). Priorities:
- ST-100 `should`: foundation of the feature and removes the hard-coded name.
- ST-101 `should`: the actual visitor value (report without a QR sticker). Listing is off by default, so nothing changes for
  visitors until a technician switches it on.
- ST-103 `should`: legal texts without a developer; the placeholder privacy notice has to be replaced before go-live
  anyway. Not `must`: a code change could still do it.
- ST-102 `could`: nice recognition value, but the riskiest and costliest story and the only one that touches a convention.
  Last in the order on purpose.

## Cross-cutting findings

### Major 1 – three versions in one singleton do not fit "aggregateStore" as written (ST-100, ST-102, ST-103)
The conventions (*Version check (HS-16)*) say every aggregate table has one `version` column and `aggregateStore` is the
only place that checks it. The data model gives `AGG-MuseumSettings` three versions (details, logo, legal texts) that never
reject each other, and a singleton with defaults and no creating event (first save "upserts" at version 0, as the
maintenance plan does with its row). This is not a story-text problem but ST-100 is the first to build it.
Input for the domain-architect / conventions: either three stores (one row or table per part, each its own version) or one
row with three version columns and an `aggregateStore` that names the version column. Settle this before `/implement
ST-100`, so the shape does not get decided in the code. Recommendation: one row per part (three small tables or one table
keyed by part), because `aggregateStore` then stays unchanged and every part is a plain aggregate with a default.

### Major 2 – new dependency, Markdown rendering (ST-103)
The story is right to stay domain-level, but nothing captures the decision. There is no Markdown library in
`package.json`. Needs an ADR proposal (user accepts) before ST-103: allow-list renderer (headings, paragraphs, strong,
emphasis, lists, links with `https`/`mailto`), no raw HTML path at all, link attributes (`rel="noopener noreferrer"`),
and, the hard part, **showing a disallowed element as plain text** (see ST-103 Major). Common renderers drop or unwrap
disallowed elements instead of printing their source; so the ADR must prove the chosen library (or a small walk over the
parsed tree) can print the element's source text. A 2-hour spike inside the ADR work is enough; no separate story. The
renderer should be a pure function (`markdown text -> React nodes`), tested with static markup. ST-103 goes through the
normal lane plus `/security-review` (input handling, user text shown to the public).

### Major 3 – logo cannot reuse `acceptPhoto` or the photo input (ST-102)
`acceptPhoto` (`src/photo/accept-photo.ts`) always re-encodes to JPEG, flattens transparency onto white, downscales to
`maxEdgePx`, and caps at `maxStoredBytes`; the browser half (`prepare-photo.ts`) turns every image into a JPEG before it is
sent. Both destroy the logo's transparency. The story says "reuses acceptance, keeps transparency" correctly but the
scope is bigger than "reuse": a sibling `acceptLogo` (same format and pixel checks, PNG/WebP output with alpha, JPEG stays
JPEG, orientation applied, then metadata dropped), and a file input that does **not** run `prepare-photo`. The form runner
has "one runner, an optional content step" (`photo`, `upload`, `each`): the logo needs a content step of its own
(`logo`) or a generalisation of `photo`, which is a convention amendment next to the one the story names. Add both to the
Definition of done. This is the main reason ST-102 is L.

### Major 4 – the logo is re-downloaded on every welcome page view (ST-102)
`/logo` answers with `303` + `private, no-store` (the `/team/dateien` pattern) to a freshly signed URL, so the browser
never reuses the image: up to 2 MB per page view, over mobile data, for the museum's most visited page. Decide before
building: (a) scale the logo on upload to a maximum edge (recommendation: 1000 px on the longer edge, never enlarged –
the page shows it at most a third of the screen height), and (b) let the `/logo` redirect be cacheable for less than the
view address's validity (recommendation: `private, max-age=60`; a removed or replaced logo then shows stale for at most
a minute, nobody is hurt) instead of `no-store`. (a) changes a stated outcome ("re-encodes without metadata, keeping
transparency") so it is a question for the user (Q1). The scenario "Visitors get the logo without logging in" stays
testable with the injected clock: the redirect target is valid until now + 5 minutes.

### Minor – module boundaries and CSP for `/logo`
`img-src` already contains the store origin (`src/platform/content-security-policy.ts`), so "content security policy
unchanged" holds, provided the welcome page uses a plain `<img src="/logo">` (not `next/image`, which would fetch through
the optimizer; expect a lint exception for `@next/next/no-img-element`). The route should call a query of the Collection
module (the `fileToOpen` counterpart, e.g. "logo to open") and `viewAddressOf`; the welcome page's data holds only
"there is a logo", never the content reference (that keeps "a visitor page's data never holds a photo reference"
literally true, and the amendment small). The proxy matcher already covers `/logo`; nothing to add.

## ST-100 – Museum settings with the museum's name and whether the machines are listed

**Testable:** yes. Seams per catalog: command through the command layer with a real database (name, version conflict,
no-change, helper refusal), page/form through the form runner, visitor pages through their render test.

Blockers: none.

Majors:
1. Storage shape of the three versioned parts (cross-cutting Major 1).

Minors:
1. **Scenario 1 asserts four things on four seams** (settings page, welcome page German and English, the not-found
   pages, the journal). When it fails nobody knows which. Split: keep "changes the name, settings show it with a
   confirmation, the change names the technician"; add "The museum's name replaces the hard-coded name on the visitor
   pages" (welcome page German and English; unknown address; unknown museum number). That is scenario 9 of 10.
2. **Name the two not-found pages.** `src/app/not-found.tsx` and `src/app/m/[museumNumber]/not-found.tsx` both read
   `messages.home.museum`. "An address that leads nowhere" should say both: an unknown path and an unknown museum number.
   Those pages (and the welcome page) now read the database; no fallback is written, the same as every other page.
3. **Define "empty".** A name of only spaces: rejected as emptied? Add one line to Context ("a name of only spaces counts as
   empty"); the check is then trivially testable.
4. **G8 restated.** The line "And the listing is still switched on in the form" in "An emptied name is rejected" is the
   kept-input pattern (G8). Keep it only if you want it tested once here; ST-103 and ST-102 reference G8 instead.
5. **G33 is referenced, the scenario "Saving without a change" is the one place it is built** – fine, keep it here. Drop
   its twin in ST-103.
6. The visitor-side `home.museum` entries in `visitor.de.ts`/`visitor.en.ts` go away; the English catalog needs no
   separate name (the name is not translated). Say nothing in the story; just do it.
7. The "Context" mentions `HS-27` as resolved – fine. No `[OPEN]`.

UX lens: page job (G1), entry (under „Mehr“, G19), section order (G18, G29), confirmation (G3), empty/default case,
rejection, no-permission case (G11) are all present. German wording matches the glossary (`Museumseinstellungen`,
`Startseite`). Nothing restated that should be a G-number except Minor 4.

## ST-101 – Welcome page with the machines on display to report a problem

**Testable:** yes. Seams: the list as a read-model query against a real database (inclusion, grouping, order, status words,
current museum number), the page render for German/English and the empty states.

Blockers: none.

Majors: none.

Minors:
1. **Pin the sort order.** "Alphabetical by machine model title" is ambiguous for case and umlauts, and two machines of
   the same model have no order. Add to the Context: "alphabetical in the visitor's language, ignoring case; machines of
   one model by location, then by museum number (not shown)". Otherwise two builders get two orders.
2. **Works without the logo.** Confirmed: no dependency on ST-102. Step 2 of the page layout ("the logo (ST-102)") should say
   "when there is one", so the page is complete before ST-102 exists.
3. **Scenario 8 "Team members see the same welcome page"** only proves the page ignores the session. Cheap, keep, but the
   `an English helper` variant is not needed. It can be dropped first if the count gets tight (it is 9 of 10).
4. **Scenario 4** ("Tapping a machine opens its visitor machine page") is testable as "the entry links to `/m/LG-043`" plus
   the existing page test; say "the entry leads to" in the Then, which is the link target, not a browser click.
5. **Performance**: ~60 machines, one query, rendered per request (the root layout already forces that). No issue; do not
   add a cache, scenario 9 guards it.
6. The events list is long (eight events). That is the read model's sources, fine.

UX lens: one job, entry (the root address), the empty/off state (G7) and the no-rejection statement are present; G5, G6,
G13, G16, G26 are referenced, not restated. English sentence is decided. The language switch is ST-010's.

Risk low: one read model over the Collection's own data, no migration, no new technology.

## ST-102 – Replace or remove the museum's logo on the welcome page

**Testable:** mostly. Seams: `acceptLogo` as a unit test with real images (EXIF GPS plus alpha PNG is the scenario "The
stored logo carries no metadata and keeps its transparency", modelled on `accept-photo.test.ts`), the command with the
in-memory storage stand-in (deleted content, nothing left behind on a rejection), the `/logo` route handler with the
injected clock.

Blockers: none.

Majors:
1. Logo pipeline and form-runner content step (cross-cutting Major 3). Put into the Definition of done.
2. Re-download and cache question (cross-cutting Major 4).

Minors:
1. **Stale sentence in Context.** "The guidelines do not name this case yet – the ux-designer records it." G10c now exists
   (and the Open Questions say so). Replace it with "Guideline G10c".
2. **Which limit is "2 MB"?** Say "the uploaded file is at most 2 MB". Also say what happens to a small file with a huge
   pixel count (a 2 MB PNG can be 20 000 x 20 000 px): rejected by a pixel limit like the photo module's. Needs a message;
   see Q1, or reuse „Bitte ein Bild als PNG, JPEG oder WebP wählen.“ if the user prefers one text.
3. **Behaviour not stated:** JPEG logos from a phone are upright by their orientation (apply it, then drop metadata); an
   animated WebP/PNG becomes a still image of its first frame. One sentence in Context, no scenario.
4. **Scenario "Anything but a PNG, JPEG or WebP..."** has two inputs (SVG, PDF named `logo.png`). Both are one rule, fine
   as one scenario, but the test must run both rows.
5. **"Without a logo..." scenario** mixes the settings form and the welcome page and `/logo` being not found. Fine (all
   "no logo" outcomes) but if a second splitting is needed: move the `/logo` not-found line to the scenario "Visitors get
   the logo without logging in".
6. **Convention amendment** ("Only team pages issue view addresses") is correctly a Definition of done, not a scenario. Add
   the sentence the amendment should carry: "Exception: `/logo`, the museum's logo; the welcome page's data holds only
   whether a logo exists." And, per the finding above, the new content step.
7. **Helper scenario** is the right permission case (G11); the last Then ("settings are not offered to the helper") repeats
   ST-100's scenario - drop that line.
8. UX: page job and entry come from ST-100; empty case (no logo) has text; rejections have texts; the removal deviation is
   G10c. No G-number restated except G8a's last paragraph, which is correct. Fine.

**Optional splitting proposal (L, so named):** by workflow step. ST-102a "Upload the museum's logo, shown on the welcome
page": pipeline, content step, `/logo`, convention amendment; scenarios first upload, no logo, metadata/transparency,
wrong format, too large, visitors get the logo (6). ST-102b "Replace or remove the logo": replace, remove, previous content
deleted, version conflict, helper (4). Recommendation: do not split now. Neither part is much smaller than the pipeline,
the priority is `could`, and ST-102b is cheap once ST-102a exists; split only if the implementation runs long.

Risk medium: sharp and S3 are known; the new parts are a public route, a convention exception, a content step and the
deletion after commit (ADR 0009 pattern exists).

## ST-103 – Privacy notice and imprint written in the museum settings

**Testable:** two scenarios need a firmer outcome (Major 1). Seams: the Markdown renderer as a pure function with static
markup; the command with a real database for the invariants and the version check; the visitor pages' render test for
language fallback and the imprint link; `visitor-legal-links.test.ts` is adapted.

Blockers: none.

Majors:
1. **"Shown to visitors as plain text" is not an assertion.** For the image, the table and the `javascript:` link, what
   exactly is visible? Pin it: "the Markdown source of that element, as typed, is shown as text; a disallowed link shows
   its link text only". Then the scenario "Markdown outside the shown elements reaches visitors as plain text" can assert
   concrete strings, and "nothing runs or loads anything" becomes: the rendered page contains no `<script>`, `<img>`,
   `<table>` and no `href` that is not `https`/`mailto`. Say it in the Context (this is what the user decided: "saved as
   typed and shown as plain text"). Drop "in the visitor's browser" from the last Then; static markup is what a test sees.
2. **The HS-25 scenario has a soft Then.** "the reason says that an English imprint needs a German one" - use the exact text
   from the Context („Ein englisches Impressum geht nur zusammen mit einem deutschen. Bitte auch das deutsche Impressum
   angeben.“) and say at which field (the English imprint, G9).
3. Markdown library ADR (cross-cutting Major 2).

Minors:
1. **Glossary conflict.** `CONTEXT.md` gives Legal texts `_UI (de)_: Rechtliches (Datenschutz / Impressum)`; the story's
   section, button and confirmation say „Rechtstexte“. The user decided the wording, so update the glossary (Q2). The
   visitor link label stays „Rechtliches“.
2. **Defaults move out of the catalogs.** Today the privacy notice is a structured `LegalText` (title plus sections) in
   `visitor.de.ts`/`visitor.en.ts`, with `imprint: null` and a parity test in `messages.test.ts`. The stored text is
   Markdown, so the placeholder has to be converted to Markdown text and live as a default in the museum settings
   module (code constant; there is no creating event). The parity test about "same keys for the imprint" and the
   `LegalText` type go away; the visitor pages' link component reads whether an imprint exists from the stored settings
   instead of the catalog. Put "the defaults are what ST-064 shipped, converted to Markdown" in the Context. The
   scenario "Before any change the placeholder privacy notice is shown" says "today's placeholder" - replace with "the
   placeholder privacy notice (it contains the word PLATZHALTER / PLACEHOLDER)" so the test is time-independent.
3. **Every visitor page now reads the database for the imprint link.** `VisitorPage` is shared, so one place; but the
   cost is visible: the visitor machine page, report form, not-found pages. Say nothing in the story; include it in the
   test plan (visitor page tests need the settings).
4. **Page title and heading level.** The visitor legal page title („Datenschutzhinweis“, from the catalog) is an `h1`; the
   text's own `#` heading would be a second `h1`. Recommendation: shift Markdown headings down one level. One line in
   Context; the scenario "Visitors read the privacy notice..." still says "its heading".
5. **Whitespace and line endings.** Define empty as "only spaces or line breaks" (same as the name in ST-100) and normalise
   the browser's `CRLF` to `LF` before comparing, otherwise "Saving without a change" records an event for a form nobody
   edited. One line in Context.
6. **Drop the G33 twin.** "Saving without a change is no rejection" is built and tested once in ST-100; reference G33 and
   HS-27 in the Context here. That frees a scenario (9 of 10), room for the fixes above.
7. **The photo notice** (`reportForm.photo.notice`, marker removal) is catalog work unrelated to the museum settings; it is
   stated under Open Questions, not as a scenario. Make it an item in the Definition of done, so it is not forgotten, or
   take it out and let ST-016's owner handle it. Recommendation: Definition of done.
8. Links: relative links (`/impressum`) and `http://` are "disallowed" and shown as text. That is as decided, but a
   technician linking the imprint from the privacy notice will hit it. The hint text already says „https- und
   mailto-Adressen“; no change.
9. UX: page job from ST-100, empty (defaults), rejection (two), version conflict; hint text decided; labels decided. G8/G9
   referenced. No restated pattern other than the G33 twin.

Risk medium: the first rendering of user-written text to the public, a new dependency, a refactor of how all visitor
pages learn about the imprint. Needs `/security-review`.

## Proposed tech tasks / spikes

- **No new story.** Technical groundwork is pulled into the first story that needs it (CLAUDE.md): the museum settings
  storage into ST-100, the Markdown renderer into ST-103, the logo pipeline and content step into ST-102.
- **Spike inside ADR work, timebox 2 h (before ST-103):** can the chosen Markdown library render a disallowed element
  (image, table, `javascript:` link) as its source text? Output: the ADR proposal "Markdown for legal texts".
- **Convention/ADR input before ST-100:** storage shape for three separately versioned parts of one singleton (Major 1).

## Technical risks for ADRs

1. Markdown renderer: allow-list, no raw HTML, source-as-text for disallowed elements, link rules, heading shift.
2. Singleton aggregate with several independent versions and defaults without a row.
3. Public `/logo`: unauthenticated route that signs a store address; cacheability against the 5-minute validity; welcome
   page data holding a boolean, never the reference; plain `<img>`.
4. Logo pipeline: output format per input (alpha stays), orientation, first frame of animations, pixel-count limit,
   downscale; a `logo` content step in the form runner (one runner).
5. Visitor pages and the not-found pages depend on the database for the museum name and the imprint link; same
   availability as every other visitor page, but it is new for the not-found pages.

## Questions for the user (with recommended answer)

1. **Logo size and caching (Major 4):** scale the stored logo to at most 1000 px on its longer edge and let the `/logo`
   redirect be cached for 60 seconds, so the 2 MB logo is not downloaded on every visit? And which message for an image
   with too many pixels? *Recommendation:* yes to both; for the pixel limit reuse „Bitte ein Bild als PNG, JPEG oder WebP
   wählen.“.
2. **Glossary:** change the `_UI (de)_` of Legal texts to „Rechtstexte“ for the team form and keep „Rechtliches“ as the
   visitor link label? *Recommendation:* yes, add both to `CONTEXT.md`.
3. **"Shown as plain text" (ST-103):** is the Markdown source of the element, as typed, what a visitor sees (image
   `![x](y)` appears literally; a bad link shows only its text)? *Recommendation:* yes.
