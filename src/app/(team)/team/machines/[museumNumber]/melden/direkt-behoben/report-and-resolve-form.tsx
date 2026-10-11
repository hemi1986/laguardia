"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { teamMessages } from "@/platform/messages";
import { rejectionText } from "../report-and-triage-rejection-text";
import { isAboutDescription, ReportSection } from "../report-section";
import type { ReportAndResolveState } from "./actions";
import { keptKey } from "@/app/_actions/form-parts";

const { reportAndResolveOnTheSpot: texts, resolveOnTheSpot, reportProblem } = teamMessages;

/**
 * The form „Problem melden und als direkt behoben eintragen“ (ST-052, G21a): the problem report – description and an
 * optional photo – and what was done, as on „Direkt behoben“ (ST-019), sent once and stored together. For helpers and
 * technicians. A rejection keeps what was typed and marks the field (G8), with and without JavaScript; the photo cannot
 * be kept, so the rejection says when it must be chosen again (G8a). A machine that was already retired when the page
 * loaded shows no form – but one retired while the team member typed keeps the form, the input and the rejection.
 */
export function ReportAndResolveForm({
  action: report,
  museumNumber,
  retired,
}: {
  action: (previous: ReportAndResolveState, formData: FormData) => Promise<ReportAndResolveState>;
  museumNumber: string;
  retired: boolean;
}) {
  const [state, action, pending] = useActionState(report, null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const rejectionId = useId();
  if (retired && !state) return <p>{reportProblem.retired}</p>;
  const kept = keptKey(state);
  const noteInvalid = state?.error === "note-required";

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
        <h2 className="font-medium">{teamMessages.terms["Resolved on the spot"]}</h2>
        <Field data-invalid={noteInvalid}>
          <FieldLabel htmlFor="note">{resolveOnTheSpot.note}</FieldLabel>
          <Textarea
            id="note"
            name="note"
            rows={3}
            defaultValue={state?.values.note}
            key={`note-${kept}`}
            aria-invalid={noteInvalid || undefined}
            aria-describedby={noteInvalid ? rejectionId : undefined}
          />
        </Field>
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
