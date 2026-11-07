"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import type { RequestAiModelProposalState } from "./actions";

const { aiModelProposals: texts } = teamMessages;

/**
 * The form „Mit KI erstellen“ (ST-123): one field „Welches Gerät?“. A rejection keeps what was typed (G8, G8a); where
 * the command would refuse whatever is typed – AI off, one being written – its reason replaces the form (G11).
 */
export function RequestAiModelProposalForm({
  action,
  whyNot,
  initialDescription,
}: {
  action: (previous: RequestAiModelProposalState, formData: FormData) => Promise<RequestAiModelProposalState>;
  /** Why CMD-RequestAiModelProposal would refuse any description now – none when it would not (G11). */
  whyNot: TeamCommandErrorCode | undefined;
  /** „Nochmal versuchen“ (ST-126): the description of the failed proposal, typed in when the page opens. */
  initialDescription?: string | undefined;
}) {
  const [state, submit, pending] = useActionState(action, null);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Field data-invalid={state ? true : undefined}>
        <FieldLabel htmlFor="description">{texts.description}</FieldLabel>
        <Input
          id="description"
          name="description"
          placeholder={texts.placeholder}
          defaultValue={state ? state.values.description : initialDescription}
          key={`description-${keptKey(state)}`}
          aria-invalid={state ? true : undefined}
          aria-describedby={state ? rejectionId : undefined}
        />
        <FieldDescription>{texts.example}</FieldDescription>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.send}
      </Button>
    </form>
  );
}
