import { wholeNumber } from "@/app/_actions/version";

/**
 * Reads the chosen defect of a link form (ST-022, ST-053) – no validation, no default. No chosen defect is none, which
 * the command rejects. When the page offered the chosen defect as recently resolved, its version from the hidden field
 * `resolvedDefects` comes with it: the link reopens it at that version. A defect the page offered as open has none – one
 * resolved meanwhile is not linked (ST-022).
 */
export function defectToLinkToInput(fields: { defectId?: string; resolvedDefects?: string }): {
  defectId: string | undefined;
  resolvedDefectVersion: number | undefined;
} {
  const defectId = fields.defectId || undefined;
  const offered = (fields.resolvedDefects ?? "").split(" ").map((entry) => entry.split(":"));
  const version = offered.find(([id]) => id === defectId)?.[1];
  return { defectId, resolvedDefectVersion: defectId ? wholeNumber(version) : undefined };
}
