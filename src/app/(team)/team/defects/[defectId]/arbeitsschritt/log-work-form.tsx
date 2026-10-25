"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { PhotosField } from "@/app/photos-field";
import type { LogWorkState } from "./actions";
import { logWorkRejectionText } from "./log-work-rejection-text";
import { VersionField, keptKey } from "@/app/_actions/form-parts";

const { defects: texts } = teamMessages;

/**
 * The form „Arbeitsschritt eintragen“ (ST-024): what was done, the parts used if any, and photos (ST-032). A rejection
 * keeps both texts and marks „Was wurde gemacht?“ when that is the reason (G8), with and without JavaScript; the photos
 * must be chosen again, and the rejection says so (G8a). A defect that was no longer
 * open when the page loaded shows the reason instead of a form – but one that changed while the person typed keeps the
 * form, the texts and the rejection.
 */
export function LogWorkForm({
  action: logWork,
  version,
  whyNot,
}: {
  action: (previous: LogWorkState, formData: FormData) => Promise<LogWorkState>;
  version: number;
  /** Why work cannot be logged on the defect as it is now – CMD-LogWork's own reason (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, action, pending] = useActionState(logWork, null);
  const [preparing, setPreparing] = useState(false);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  const kept = keptKey(state);
  const invalid = state?.error === "what-was-done-required";

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="whatWasDone">{texts.whatWasDone}</FieldLabel>
        <Textarea
          id="whatWasDone"
          name="whatWasDone"
          rows={3}
          defaultValue={state?.values.whatWasDone}
          key={`whatWasDone-${kept}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? rejectionId : undefined}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="partsUsed">{texts.partsUsed}</FieldLabel>
        <Textarea
          id="partsUsed"
          name="partsUsed"
          rows={2}
          defaultValue={state?.values.partsUsed}
          key={`partsUsed-${kept}`}
        />
      </Field>
      <PhotosField
        name="photos"
        onPreparing={setPreparing}
        texts={{
          ...texts.workLogPhotos,
          tooLarge: teamMessages.commandErrors["too-large"],
          notAnImage: teamMessages.commandErrors["not-an-image"],
        }}
      />
      {state && (
        <div id={rejectionId}>
          <Rejection>{logWorkRejectionText(state)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending || preparing}>
        {texts.logWork}
      </Button>
    </form>
  );
}
