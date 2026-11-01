/**
 * Reading a page rendered to static markup in a page test (`renderToStaticMarkup`): a form field, the chosen option of a
 * select, an option, a label, and the visible text. Plain patterns – they read React's markup, not any HTML.
 */

/** The `<input>` or `<select>` start tag named `name`, or "" when the page has none. */
export const field = (html: string, name: string): string =>
  html.match(new RegExp(`<(input|select)[^>]*name="${name}"[^>]*>`))?.[0] ?? "";

/** The value of the selected option of the select named `name`. */
export const selectedOf = (html: string, name: string): string | undefined =>
  html
    .match(new RegExp(`<select[^>]*name="${name}"[^>]*>(.*?)</select>`))?.[1]
    ?.match(/<option[^>]*selected=""[^>]*value="([^"]*)"|<option[^>]*value="([^"]*)"[^>]*selected=""/)
    ?.slice(1)
    .find(Boolean);

/** The option with `value` of the select named `name`, or "". */
export const optionOf = (html: string, name: string, value: string): string =>
  html.match(
    new RegExp(`<select[^>]*name="${name}"[^>]*>.*?(<option[^>]*value="${value}"[^>]*>[^<]*</option>)`),
  )?.[1] ?? "";

/** The text of the label for the field with this `id`. */
export const labelOf = (html: string, id: string): string | undefined =>
  html.match(new RegExp(`<label[^>]*for="${id}"[^>]*>([^<]*)</label>`))?.[1];

/** The visible text – tags replaced by spaces, whitespace collapsed. */
export const textOf = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
