"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { rejectionText } from "../report-and-triage-rejection-text";
import { isAboutDescription, ReportSection } from "../report-section";
import type { ReportAndLinkState } from "./actions";

const { reportAndLink: texts, link, reportProblem } = teamMessages;

/**
 * The form „Problem melden und mit Defekt verknüpfen“ (ST-052, G21a): the problem report – description and an optional
 * photo – and the machine's open defects as on „Mit Defekt verknüpfen“ (ST-022): native radio buttons, each with its
 * title and since when it is open, none preselected. Sent once and stored together. A rejection keeps what was typed
 * and the chosen defect, if it is still offered (G8), with and without JavaScript; the photo cannot be kept, so the
 * rejection says when it must be chosen again (G8a). Without open defects, or for a machine already retired when the
 * page loaded, there is no form – the page says why (G7); after a rejection the form stays.
 */
export function ReportAndLinkForm({
  action: report,
  museumNumber,
  retired,
  openDefects,
}: {
  action: (previous: ReportAndLinkState, formData: FormData) => Promise<ReportAndLinkState>;
  museumNumber: string;
  retired: boolean;
  openDefects: { id: string; title: string; openSince: Date }[];
}) {
  const [state, action, pending] = useActionState(report, null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const rejectionId = useId();
  if (retired && !state) return <p>{reportProblem.retired}</p>;
  if (openDefects.length === 0 && !state) return <p>{link.noOpenDefects(museumNumber)}</p>;
  const kept = state ? JSON.stringify(state) : "empty";
  const defectInvalid = state?.error === "defect-required" || state?.error === "defect-not-open";

  return (
    <form action={action} className="flex flex-col gap-8">
      <ReportSection
        description={state?.values.description}
        kept={kept}
        invalid={isAboutDescription(state?.error)}
        rejectionId={rejectionId}
        onPreparingPhoto={setPreparingPhoto}
      />
      <section className="flex flex-col gap-5">
        <h2 className="font-medium">{teamMessages.terms.Defect}</h2>
        <FieldSet data-invalid={defectInvalid || undefined} aria-describedby={defectInvalid ? rejectionId : undefined}>
          <FieldLegend variant="label">{link.defect}</FieldLegend>
          {/* After a rejection the form stays – also when no defect is open any more: said in words (G7). */}
          {openDefects.length === 0 && <p className="text-sm">{link.noOpenDefects(museumNumber)}</p>}
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
                <span className="text-muted-foreground">{link.openSince(formatDateTime(defect.openSince))}</span>
              </span>
            </label>
          ))}
        </FieldSet>
      </section>
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state, museumNumber)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending || preparingPhoto}>
        {texts.submit}
      </Button>
    </form>
  );
}
