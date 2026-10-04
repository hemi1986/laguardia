"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { PhotoField } from "../../../../../photo-field";
import type { TeamReportProblemState } from "./actions";

const { reportProblem: texts } = teamMessages;

/**
 * The team's report form (ST-015): the description of the problem and an optional photo (ST-016). A rejection keeps it, names the reason above the
 * button and marks the field (G8), with and without JavaScript.
 */
export function TeamReportProblemForm({
  action: report,
}: {
  action: (previous: TeamReportProblemState, formData: FormData) => Promise<TeamReportProblemState>;
}) {
  const [state, action, pending] = useActionState(report, null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const rejectionId = useId();
  const kept = state ? JSON.stringify(state) : "empty";
  const invalid = state?.error === "description-required" || state?.error === "description-too-long";

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="description">{texts.description}</FieldLabel>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={state?.values.description}
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
          ...texts.photo,
          tooLarge: teamMessages.commandErrors["too-large"],
          notAnImage: teamMessages.commandErrors["not-an-image"],
        }}
        onPreparing={setPreparingPhoto}
      />
      {state && (
        <div id={rejectionId}>
          <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending || preparingPhoto}>
        {texts.submit}
      </Button>
    </form>
  );
}
