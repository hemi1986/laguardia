"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import type { MachineStatus } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import { PhotoField } from "../../../../../../photo-field";
import { DefectFields } from "../../../../triage/[problemReportId]/defekt-erfassen/defect-fields";
import type { ReportAndRecordDefectState } from "./actions";
import type { ReportAndRecordDefectField } from "./report-and-record-defect-input";
import { rejectionText } from "./report-and-record-defect-rejection-text";

const { reportAndRecordDefect: texts, reportProblem } = teamMessages;

type ErrorCode = NonNullable<ReportAndRecordDefectState>["error"];

/** The field that caused a rejection – marked at the form (G8). */
const fieldOf: Partial<Record<ErrorCode, ReportAndRecordDefectField>> = {
  "description-required": "description",
  "description-too-long": "description",
  "title-required": "title",
  "machine-status-not-stricter": "machineStatus",
};

/**
 * The form „Problem melden und Defekt erfassen“ (ST-023, G21a): the problem report – description and an optional
 * photo, as on the team's report form – and the defect's fields exactly as on „Defekt erfassen“ (ST-018), sent once
 * and stored together. A rejection keeps what was typed and marks the field (G8), with and without JavaScript; the
 * photo cannot be kept, so the rejection says when it must be chosen again (G8a). A machine that was already retired
 * when the page loaded shows no form – but one retired while the technician typed keeps the form, the input and the
 * rejection.
 */
export function ReportAndRecordDefectForm({
  action: report,
  museumNumber,
  machine,
}: {
  action: (previous: ReportAndRecordDefectState, formData: FormData) => Promise<ReportAndRecordDefectState>;
  museumNumber: string;
  machine: { status: MachineStatus; version: number; stricter: MachineStatus[]; retired: boolean };
}) {
  const [state, action, pending] = useActionState(report, null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const rejectionId = useId();
  if (machine.retired && !state) return <p>{reportProblem.retired}</p>;
  const kept = state ? JSON.stringify(state) : "empty";
  const invalid = state ? fieldOf[state.error] : undefined;
  const descriptionInvalid = invalid === "description";

  return (
    <form action={action} className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <h2 className="font-medium">{texts.report}</h2>
        <Field data-invalid={descriptionInvalid}>
          <FieldLabel htmlFor="description">{reportProblem.description}</FieldLabel>
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={state?.values.description}
            key={`description-${kept}`}
            aria-invalid={descriptionInvalid || undefined}
            aria-describedby={["description-hint", descriptionInvalid ? rejectionId : undefined]
              .filter(Boolean)
              .join(" ")}
          />
          <FieldDescription id="description-hint">{texts.descriptionHint}</FieldDescription>
        </Field>
        <PhotoField
          key={`photo-${kept}`}
          name="photo"
          texts={{
            ...reportProblem.photo,
            tooLarge: teamMessages.commandErrors["too-large"],
            notAnImage: teamMessages.commandErrors["not-an-image"],
          }}
          onPreparing={setPreparingPhoto}
        />
      </section>
      <section className="flex flex-col gap-5">
        <h2 className="font-medium">{texts.defect}</h2>
        <DefectFields
          values={state?.values}
          kept={kept}
          invalid={invalid}
          rejectionId={rejectionId}
          museumNumber={museumNumber}
          machine={machine}
        />
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
