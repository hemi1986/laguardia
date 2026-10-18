/** The formats a file is opened in the browser in – PDFs and the usual images (ST-037); everything else is downloaded. */
const openedInBrowser = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Whether a file of this media type is opened in the browser (ST-037: "PDFs and images can be opened in the browser;
 * every other format is always offered as a download"). The media type is the one the store kept, not what a form
 * claimed. SVG is an image that can carry script, so it is downloaded too.
 */
export function opensInBrowser(contentType: string): boolean {
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  return openedInBrowser.includes(mediaType);
}
