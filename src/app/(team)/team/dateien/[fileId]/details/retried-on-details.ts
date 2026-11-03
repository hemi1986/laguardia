import { ORIGIN_PARAM } from "./file-origin";

/**
 * Where „Erneut versuchen“ on the file details lands (G3, G17): the same page, the origin kept as the page had it – the
 * page checks it again, so nothing here is trusted – and the mark `retried`, which the page confirms only when the
 * journal says the viewer's latest step on the file was that.
 */
export function retriedOnDetails(fileId: string, origin: string | undefined): string {
  const search = new URLSearchParams();
  if (origin) search.set(ORIGIN_PARAM, origin);
  search.set("retried", "1");
  return `/team/dateien/${fileId}/details?${search}`;
}
