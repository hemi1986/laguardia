"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import type { LinkToDefectState } from "./actions";
import { triageRejectionText } from "../triage-rejection-text";

const { link: texts, triage } = teamMessages;

/**
 * The form „Mit Defekt verknüpfen“ (ST-022, story review 2026-10-03): the machine's open defects as native radio
 * buttons – they submit without JavaScript –, each with its title and since when it is open, none preselected. Linking
 * records a fact and asks nothing. A rejection keeps the chosen defect, if it is still offered, and is shown at the
 * form (G8). A problem report already triaged when the page loaded shows no form – but one triaged while the person
 * chose keeps the form and the rejection.
 */
export function LinkToDefectForm({
  action: link,
  version,
  triaged,
  openDefects,
}: {
  action: (previous: LinkToDefectState, formData: FormData) => Promise<LinkToDefectState>;
  version: number;
  triaged: boolean;
  openDefects: { id: string; title: string; openSince: Date }[];
}) {
  const [state, action, pending] = useActionState(link, null);
  const rejectionId = useId();
  if (triaged && !state) return <p>{triage.alreadyTriaged}</p>;
  const kept = state ? JSON.stringify(state) : "empty";
  const invalid = state?.error === "defect-required" || state?.error === "defect-not-open";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="version" value={version} />
      <FieldSet data-invalid={invalid || undefined} aria-describedby={invalid ? rejectionId : undefined}>
        <FieldLegend variant="label">{texts.defect}</FieldLegend>
        {openDefects.map((defect) => (
          <label key={`${defect.id}-${kept}`} className="flex items-start gap-2 text-sm [overflow-wrap:anywhere]">
            <input
              type="radio"
              name="defectId"
              value={defect.id}
              defaultChecked={state?.values.defectId === defect.id}
              className="mt-0.5 size-4 shrink-0"
            />
            <span className="flex flex-col">
              <span className="font-medium">{defect.title}</span>
              <span className="text-muted-foreground">{texts.openSince(formatDateTime(defect.openSince))}</span>
            </span>
          </label>
        ))}
      </FieldSet>
      {state && (
        <div id={rejectionId} className="flex flex-col gap-2">
          <Rejection>{triageRejectionText(state)}</Rejection>
          {state.error === "already-triaged" && (
            <Link href="/team/triage" className="self-start text-sm underline underline-offset-4">
              {triage.back}
            </Link>
          )}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
