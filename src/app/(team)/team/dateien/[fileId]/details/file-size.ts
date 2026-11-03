/** A file's size as the team reads it (G13): „12,4 MB“ from 1 MB on, „340 KB“ below, „120 Byte“ below 1 KB. */
export function fileSizeText(bytes: number): string {
  const MB = 1024 * 1024;
  if (bytes >= MB)
    return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / MB)} MB`;
  if (bytes >= 1024) return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(bytes / 1024)} KB`;
  return `${bytes} Byte`;
}
