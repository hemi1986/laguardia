import type { DefectsToLinkTo } from "@/modules/repair";
import type { TeamCommandErrorCode } from "@/platform/messages";
import { wholeNumber } from "@/app/_actions/version";

/** Whether a problem report of the machine can be linked to anything – open or recently resolved defects (ST-053). */
export function anythingToLinkTo(defects: DefectsToLinkTo): boolean {
  return defects.open.length > 0 || defects.recentlyResolved.length > 0;
}

/** The rejections that are about the chosen defect – the defect choice is marked with them (G8). */
export function aboutTheChosenDefect(error: TeamCommandErrorCode | undefined): boolean {
  return (
    error === "defect-required" ||
    error === "defect-not-open" ||
    error === "defect-resolved-too-long-ago" ||
    error === "defect-not-resolved"
  );
}

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
