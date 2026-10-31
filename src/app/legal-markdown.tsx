import MarkdownIt from "markdown-it";

/**
 * The legal texts' Markdown (ST-103, ADR 0013) – the one place it is rendered. Visitors see headings, paragraphs, bold
 * and italic, lists and links to https and mailto addresses. Everything else stays its source, as typed (HS-26): raw HTML
 * is escaped (`html: false`), the rules of every other element are off – so an image, a table, a quotation, code, a rule
 * or a crossed-out word is plain text –, a bare address is no link (`linkify: false`), and a link to any other kind of
 * address fails `validateLink` and stays its text.
 */
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false }).disable([
  "table",
  "blockquote",
  "code",
  "fence",
  "hr",
  "backticks",
  "strikethrough",
]);

// An image is its source as typed – the whole of it. Switching its rule off would leave `![Bild](https://…)` a `!` and a
// link; so the image rule only measures how far the image goes, and what it covers becomes text.
const image = markdown.inline.ruler.__rules__.find((rule) => rule.name === "image")!.fn;
markdown.inline.ruler.at("image", (state, silent) => {
  const start = state.pos;
  if (!image(state, true)) return false;
  if (!silent) state.push("text", "", 0).content = state.src.slice(start, state.pos);
  return true;
});

const allowedAddress = /^(https|mailto):/i;
markdown.validateLink = (address) => allowedAddress.test(address);

// The visitor legal page's title is its one `h1`, so a text's own headings are shown one level below it.
markdown.core.ruler.push("headings-below-title", (state) => {
  for (const token of state.tokens) {
    if (token.type === "heading_open" || token.type === "heading_close") {
      token.tag = `h${Math.min(Number(token.tag.slice(1)) + 1, 6)}`;
    }
  }
});

/** A legal text's Markdown as the HTML visitors are shown – only the allowed elements (ADR 0013). */
export function legalTextHtml(text: string): string {
  return markdown.render(text);
}

/**
 * A legal text on a visitor legal page (ST-103). Its HTML is the only `dangerouslySetInnerHTML` of the application (ADR
 * 0013, lint `react/no-danger`): it comes only from `legalTextHtml`, whose tests assert that no script, image, table or
 * other link survives. Styled here, as the page's base styles reset headings and lists.
 */
export function LegalMarkdown({ text }: { text: string }) {
  return (
    <div
      className="flex flex-col gap-3 break-words [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-1 [&_h3]:font-semibold [&_h4]:font-medium [&_h5]:font-medium [&_h6]:font-medium [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: legalTextHtml(text) }}
    />
  );
}
