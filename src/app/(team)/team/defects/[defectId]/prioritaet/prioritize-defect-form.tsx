"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { Priority } from "@/modules/repair";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import type { PrioritizeDefectState } from "./actions";

const { defects: texts, recordDefect } = teamMessages;

/** The rejections that are about the chosen priority – marked at the field (G8). */
const aboutThePriority: readonly TeamCommandErrorCode[] = ["priority-required", "priority-unchanged"];

/**
 * The form „Priorität ändern“ (ST-027): only the new priority, chosen from those the defect can be changed to (G11) – a
 * native select, so it works without JavaScript. A rejection keeps the choice and marks the field when the choice is
 * the reason (G8). Someone who could not prioritize the defect when the page loaded sees the reason instead of a form –
 * but a defect that changed while they chose keeps the form and the rejection.
 */
export function PrioritizeDefectForm({
  action: prioritize,
  version,
  priorities,
  whyNot,
}: {
  action: (previous: PrioritizeDefectState, formData: FormData) => Promise<PrioritizeDefectState>;
  version: number;
  priorities: Priority[];
  /** Why the team member may not prioritize the defect as it is now – CMD-PrioritizeDefect's own reason (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, action, pending] = useActionState(prioritize, null);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  const invalid = !!state && aboutThePriority.includes(state.error);

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="priority">{texts.prioritizeTo}</FieldLabel>
        <NativeSelect
          id="priority"
          name="priority"
          defaultValue={state?.values.priority ?? ""}
          key={`priority-${keptKey(state)}`}
          required
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? rejectionId : undefined}
        >
          <option value="">{texts.prioritizeChoose}</option>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {recordDefect.priorities[priority]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.prioritize}
      </Button>
    </form>
  );
}
