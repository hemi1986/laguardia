---
status: accepted
date: 2026-10-31
---

# 0013 – Legal texts are rendered with markdown-it: no HTML, no images or tables, only https and mailto links

Technicians write the privacy notice and the imprint as Markdown in the museum settings, and every visitor sees them
(`docs/stories/ST-103-legal-texts-in-the-museum-settings.md`, feature `museum-start-page`). The user decided that only
headings, paragraphs, bold and italic, lists and links to https and mailto addresses are shown, and that anything else
is **saved as typed and shown as plain text** – a pasted text is never refused, and visitors only ever see safe text
(HS-26 in `docs/domain/events.yaml`, user 2026-10-31). This is the first Markdown in the application and the first text
a person types that is rendered as more than plain text on a public page.

## Decision
- **`markdown-it`**, rendered on the server into the page, with `html: false` (raw HTML is escaped and appears as
  typed), the `image` and `table` rules disabled (their source stays text), `linkify` off, and `validateLink` allowing
  only `https:` and `mailto:` (any other link stays as its source text). Headings are shifted down one level so the
  page keeps one `h1`.
- The rendered HTML is the only `dangerouslySetInnerHTML` in the application; it lives in one component next to the
  renderer configuration, and its tests assert that no script, image, table or other link survives.

## Considered Options
- **`react-markdown` (remark) with an element allow-list** – rejected: disallowed elements are dropped or unwrapped,
  not shown as typed, so it does not do what HS-26 decided without custom plugins.
- **`marked` plus an HTML sanitizer (DOMPurify on the server)** – rejected: two libraries and a DOM on the server for
  what one renderer's configuration does; a sanitizer removes, it does not show the source.
- **A hand-written subset parser** – rejected: Markdown edge cases (nested emphasis, lists, escaping) are where such a
  parser goes wrong, on a public page.

## Consequences
- A new runtime dependency (`markdown-it`, no dependencies of its own beyond small helpers); the dependency routine
  (ST-063) watches it.
- ST-103 runs `/security-review` (rendered user input on a public page).
- The engineering conventions get one line: legal texts are rendered only through this component; "React escapes
  output; `dangerouslySetInnerHTML` is not used" gains this one named exception.
