/**
 * The title a chosen file proposes (ST-119): its name without the last ending – „medieval_manual-v2.pdf“ becomes
 * „medieval_manual-v2“. A name that is only an ending (“.gitignore”) or has none stays as it is.
 */
export function titleFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}
