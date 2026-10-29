"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { GroupedChoice } from "@/components/ui/grouped-choice";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import { teamMessages } from "@/platform/messages";
import { registerMachineAction, type RegisterMachineState } from "./actions";
import type { RegistrationChoices } from "./register-machine-data";
import { TASK_FIELD, type RegisterMachineField } from "./register-machine-input";
import { keptKey } from "@/app/_actions/form-parts";
import { tasksRejectionText } from "../tasks-rejection-text";

const { machines: texts, terms, registration, maintenancePlan } = teamMessages;

type ErrorCode = NonNullable<RegisterMachineState>["error"];

/** No machine model chosen proposes nothing – one value, so the choice does not follow a new empty list each time. */
const NOTHING_PROPOSED = { tasks: [], line: "" };

/** The field that caused a rejection – marked at the form (G8). The others have no field of their own. */
const fieldOf: Partial<Record<ErrorCode, RegisterMachineField>> = {
  "machine-model-required": "machineModelId",
  "location-required": "location",
  "machine-status-required": "machineStatus",
  "museum-number-format": "museumNumber",
  "museum-number-taken": "museumNumber",
  // "no-museum-number-free" marks no field: nothing typed here can make a number free (ST-007 review).
};

/**
 * The registration form (ST-007), the first form on shadcn's Field (G8, G9): a rejection keeps every value, names the
 * reason above the submit button and marks the field that caused it – with and without JavaScript (ST-073).
 *
 * The section „Wartungsaufgaben“ (ST-097, G27) offers every task of the maintenance plan, in groups that fold. With
 * JavaScript, choosing a machine model ticks the tasks it proposes and says why above them; the ticks the technician has
 * not touched follow a change of the model. Without JavaScript, and after a rejection – which keeps the ticks as they
 * were sent and opens the groups with a choice in them –, nothing is proposed.
 */
export function RegisterMachineForm({ machineModels, machineStatuses, tasks, proposals }: RegistrationChoices) {
  const [state, action, pending] = useActionState(registerMachineAction, null);
  // The machine model chosen since the page opened – only with JavaScript, which is what proposes.
  const [machineModel, setMachineModel] = useState<string>();
  const proposal = !state && machineModel !== undefined ? (proposals[machineModel] ?? NOTHING_PROPOSED) : undefined;
  const rejectionId = useId();
  const kept = keptKey(state);
  const invalid = state ? fieldOf[state.error] : undefined;
  /** Marks a field as the cause of the rejection and links it to the reason, next to its own hint if it has one. */
  const marked = (field: RegisterMachineField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field data-invalid={invalid === "machineModelId"}>
        <FieldLabel htmlFor="machineModelId">{terms["Machine model"]}</FieldLabel>
        <NativeSelect
          id="machineModelId"
          name="machineModelId"
          defaultValue={state?.values.machineModelId ?? ""}
          key={`machineModelId-${kept}`}
          onChange={(event) => setMachineModel(event.currentTarget.value)}
          required
          {...marked("machineModelId")}
        >
          <option value="">{texts.choose}</option>
          {machineModels.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field data-invalid={invalid === "museumNumber"}>
        <FieldLabel htmlFor="museumNumber">{terms["Museum number"]}</FieldLabel>
        <Input
          id="museumNumber"
          name="museumNumber"
          placeholder="LG-042"
          defaultValue={state?.values.museumNumber}
          key={`museumNumber-${kept}`}
          {...marked("museumNumber", "museumNumber-hint")}
        />
        <FieldDescription id="museumNumber-hint">{texts.museumNumberHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="serialNumber">{terms["Serial number"]}</FieldLabel>
        <Input
          id="serialNumber"
          name="serialNumber"
          defaultValue={state?.values.serialNumber}
          key={`serialNumber-${kept}`}
          {...marked("serialNumber", "serialNumber-hint")}
        />
        <FieldDescription id="serialNumber-hint">{texts.serialNumberHint}</FieldDescription>
      </Field>
      <Field data-invalid={invalid === "location"}>
        <FieldLabel htmlFor="location">{terms.Location}</FieldLabel>
        <Input
          id="location"
          name="location"
          defaultValue={state?.values.location}
          key={`location-${kept}`}
          required
          {...marked("location")}
        />
      </Field>
      <Field data-invalid={invalid === "machineStatus"}>
        <FieldLabel htmlFor="machineStatus">{texts.status}</FieldLabel>
        <NativeSelect
          id="machineStatus"
          name="machineStatus"
          defaultValue={state?.values.machineStatus ?? "playable"}
          key={`machineStatus-${kept}`}
          required
          {...marked("machineStatus")}
        >
          {machineStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{registration.legend}</legend>
        {tasks.length === 0 ? (
          <p className="text-sm">{maintenancePlan.empty}</p>
        ) : (
          <>
            {proposal && proposal.tasks.length > 0 && <p className="text-sm">{proposal.line}</p>}
            <GroupedChoice
              name={TASK_FIELD}
              groups={tasks}
              chosen={state?.chosen ?? []}
              key={`tasks-${kept}`}
              header={maintenancePlan.machines.groupHeader}
              selectAll={maintenancePlan.machines.selectAll}
              proposed={proposal?.tasks}
            />
          </>
        )}
      </fieldset>
      {state && (
        <div id={rejectionId}>
          <Rejection>{tasksRejectionText(state)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.register}
      </Button>
    </form>
  );
}
