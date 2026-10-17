"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import type { MachineStatus } from "@/modules/collection";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { MachineStatusChoice } from "../../../defect-fields";
import type { ReopenDefectState } from "./actions";

const { defects: texts } = teamMessages;

/**
 * The form „Defekt wieder öffnen“ (ST-030): why it is reopened and – for technicians only – a stricter machine status
 * in the same step, „Status nicht ändern“ preselected (ST-018's wording). A rejection keeps both and marks the field it
 * is about (G8). Someone who could not reopen the defect when the page loaded sees the reason instead of a form.
 */
export function ReopenDefectForm({
  action: reopen,
  version,
  whyNot,
  museumNumber,
  machine,
}: {
  action: (previous: ReopenDefectState, formData: FormData) => Promise<ReopenDefectState>;
  version: number;
  /** Why CMD-ReopenDefect would refuse as the defect and its machine are now (G11). */
  whyNot: TeamCommandErrorCode | undefined;
  museumNumber: string;
  /** The status choice – none for a helper (G11). */
  machine: { status: MachineStatus; version: number; stricter: MachineStatus[] } | undefined;
}) {
  const [state, action, pending] = useActionState(reopen, null);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  const kept = keptKey(state);
  const reasonInvalid = state?.error === "reason-required";
  const statusInvalid = state?.error === "machine-status-not-stricter";

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={reasonInvalid}>
        <FieldLabel htmlFor="reason">{texts.reopenReason}</FieldLabel>
        <Textarea
          id="reason"
          name="reason"
          rows={3}
          defaultValue={state?.values.reason}
          key={`reason-${kept}`}
          aria-invalid={reasonInvalid || undefined}
          aria-describedby={reasonInvalid ? rejectionId : undefined}
        />
      </Field>
      {machine && (
        <MachineStatusChoice
          museumNumber={museumNumber}
          machine={machine}
          value={state?.values.machineStatus}
          kept={kept}
          invalid={statusInvalid}
          aria={{
            "aria-invalid": statusInvalid || undefined,
            "aria-describedby": statusInvalid ? `machineStatus-hint ${rejectionId}` : "machineStatus-hint",
          }}
        />
      )}
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.reopen}
      </Button>
    </form>
  );
}
