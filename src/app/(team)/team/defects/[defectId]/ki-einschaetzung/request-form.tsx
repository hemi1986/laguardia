"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { PhotosField } from "@/app/photos-field";
import { photosRejectionText } from "@/app/_actions/rejection-text";
import { MAX_AI_ASSESSMENT_PHOTOS } from "@/modules/ai-assistance";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { keptKey } from "@/app/_actions/form-parts";
import type { RequestAiAssessmentState } from "./actions";

const { aiAssessments: texts } = teamMessages;

/**
 * The form „KI-Einschätzung anfordern“ (ST-107): an optional note and optional photos (at most 5, as on a work log
 * entry). A rejection keeps the note and says when the photos must be chosen again (G8, G8a); a defect that cannot be
 * assessed now shows the command's reason instead of a form (G11).
 */
export function RequestAiAssessmentForm({
  action,
  whyNot,
}: {
  action: (previous: RequestAiAssessmentState, formData: FormData) => Promise<RequestAiAssessmentState>;
  /** Why CMD-RequestAiAssessment would refuse the viewer now – none when it would not (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, submit, pending] = useActionState(action, null);
  const [preparing, setPreparing] = useState(false);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  const kept = keptKey(state);

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor="note">{texts.note}</FieldLabel>
        <Textarea id="note" name="note" rows={3} defaultValue={state?.values.note} key={`note-${kept}`} />
      </Field>
      <PhotosField
        name="photos"
        max={MAX_AI_ASSESSMENT_PHOTOS}
        onPreparing={setPreparing}
        texts={{
          label: texts.photos(MAX_AI_ASSESSMENT_PHOTOS),
          full: texts.photosField.full(MAX_AI_ASSESSMENT_PHOTOS),
          take: texts.photosField.take,
          choose: texts.photosField.choose,
          remove: texts.photosField.remove,
          preparing: texts.photosField.preparing,
          tooLarge: teamMessages.commandErrors["too-large"],
          notAnImage: teamMessages.commandErrors["not-an-image"],
        }}
      />
      <FieldDescription>{texts.hint}</FieldDescription>
      {state && (
        <div id={rejectionId}>
          <Rejection>{photosRejectionText(state)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending || preparing}>
        {texts.request}
      </Button>
    </form>
  );
}
