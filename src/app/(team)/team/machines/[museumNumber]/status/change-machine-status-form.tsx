"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { MachineStatus } from "@/modules/collection";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { changeMachineStatusAction, type ChangeMachineStatusState } from "./actions";
import type { ChangeMachineStatusField } from "./change-machine-status-input";

const { machines, machineStatusChange: texts } = teamMessages;

type ErrorCode = NonNullable<ChangeMachineStatusState>["error"];

/** The field that caused a rejection – marked at the form (G8). The others have no field of their own. */
const fieldOf: Partial<Record<ErrorCode, ChangeMachineStatusField>> = {
  "machine-status-required": "machineStatus",
  "machine-status-unchanged": "machineStatus",
  "helpers-only-out-of-order": "machineStatus",
  "reason-required": "reason",
};

/**
 * The status change form (ST-012): the machine statuses the team member may set, and the reason. A technician
 * chooses one of all four – nothing preselected; a helper is offered only Außer Betrieb, preselected (user,
 * 2026-10-03). A rejection keeps the choice and the reason and marks the field (G8), with and without JavaScript.
 */
export function ChangeMachineStatusForm({
  machineId,
  version,
  offered,
}: {
  machineId: string;
  version: number;
  offered: readonly MachineStatus[];
}) {
  const [state, action, pending] = useActionState(changeMachineStatusAction, null);
  const rejectionId = useId();
  const kept = state ? JSON.stringify(state) : "empty";
  const invalid = state ? fieldOf[state.error] : undefined;
  const marked = (field: ChangeMachineStatusField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };
  const onlyOne = offered.length === 1;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="machineId" value={machineId} />
      <input type="hidden" name="version" value={version} />
      <Field data-invalid={invalid === "machineStatus"}>
        <FieldLabel htmlFor="machineStatus">{machines.status}</FieldLabel>
        <NativeSelect
          id="machineStatus"
          name="machineStatus"
          defaultValue={state?.values.machineStatus ?? (onlyOne ? offered[0] : "")}
          key={`machineStatus-${kept}`}
          required
          {...marked("machineStatus")}
        >
          {!onlyOne && <option value="">{machines.choose}</option>}
          {offered.map((status) => (
            <option key={status} value={status}>
              {machines.statuses[status]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field data-invalid={invalid === "reason"}>
        <FieldLabel htmlFor="reason">{texts.reason}</FieldLabel>
        <Input
          id="reason"
          name="reason"
          defaultValue={state?.values.reason}
          key={`reason-${kept}`}
          {...marked("reason", "reason-hint")}
        />
        <FieldDescription id="reason-hint">{texts.reasonHint}</FieldDescription>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
