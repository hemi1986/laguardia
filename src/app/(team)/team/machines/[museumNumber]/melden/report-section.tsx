"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { teamMessages } from "@/platform/messages";
import { PhotoField } from "../../../../../photo-field";

const { reportAndTriage: texts, reportProblem } = teamMessages;

/**
 * The section „Meldung“ of a form that reports and triages in the same step (ST-023, ST-052): the description and an
 * optional photo, as on the team's report form – without its sentence about triage, because this problem report is
 * triaged right here. `description` is what a rejection kept, `kept` the key that makes React show it again;
 * `invalid` marks the description when the rejection is about it (G8).
 */
export function ReportSection({
  description,
  kept,
  invalid,
  rejectionId,
  onPreparingPhoto,
}: {
  description: string | undefined;
  kept: string;
  invalid: boolean;
  rejectionId: string;
  /** Tells the form a photo is being prepared – it waits with sending until it is ready. */
  onPreparingPhoto: (preparing: boolean) => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="font-medium">{texts.report}</h2>
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="description">{reportProblem.description}</FieldLabel>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={description}
          key={`description-${kept}`}
          aria-invalid={invalid || undefined}
          aria-describedby={["description-hint", invalid ? rejectionId : undefined].filter(Boolean).join(" ")}
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
        onPreparing={onPreparingPhoto}
      />
    </section>
  );
}

/** Whether a form's error is about the description – then that field is marked (G8). */
export function isAboutDescription(error: string | undefined): boolean {
  return error === "description-required" || error === "description-too-long";
}
