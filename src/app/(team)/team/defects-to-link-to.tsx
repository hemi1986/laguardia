"use client";

import { FieldLegend, FieldSet } from "@/components/ui/field";
import type { DefectsToLinkTo } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";

const { link: texts } = teamMessages;

/**
 * The defects a problem report can be linked to (ST-022, ST-053), shared by „Mit Defekt verknüpfen“ in triage and the
 * form that reports and links in the same step (ST-052): native radio buttons – they submit without JavaScript –, the
 * open defects first with since when they are open, then the recently resolved ones with how long ago they were
 * resolved; none preselected. Beside them, as one hidden field, the version of each recently resolved defect the page
 * showed – linking reopens it, and the reopening checks that version (HS-16).
 */
export function DefectsToLinkToField({
  defects,
  value,
  kept,
  invalid,
  describedBy,
}: {
  defects: DefectsToLinkTo;
  /** The chosen defect, kept after a rejection if it is still offered (G8). */
  value: string | undefined;
  kept: string;
  invalid: boolean;
  describedBy: string | undefined;
}) {
  const choices = [
    ...defects.open.map((defect) => ({ ...defect, when: texts.openSince(formatDateTime(defect.openSince)) })),
    ...defects.recentlyResolved.map((defect) => ({ ...defect, when: texts.resolvedDaysAgo(defect.resolvedDaysAgo) })),
  ];
  return (
    <FieldSet data-invalid={invalid || undefined} aria-describedby={describedBy}>
      <FieldLegend variant="label">{texts.defect}</FieldLegend>
      <input type="hidden" name="resolvedDefects" value={resolvedDefectsValue(defects)} />
      {choices.map((defect) => (
        <label key={`${defect.id}-${kept}`} className="flex items-start gap-2 text-sm [overflow-wrap:anywhere]">
          <input
            type="radio"
            name="defectId"
            value={defect.id}
            defaultChecked={value === defect.id}
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="flex flex-col">
            <span className="font-medium">{defect.title}</span>
            <span className="text-muted-foreground">{defect.when}</span>
          </span>
        </label>
      ))}
    </FieldSet>
  );
}

/** The recently resolved defects the page offered and their versions, as one field: `<id>:<version>` apart by spaces. */
function resolvedDefectsValue(defects: DefectsToLinkTo): string {
  return defects.recentlyResolved.map((defect) => `${defect.id}:${defect.version}`).join(" ");
}
