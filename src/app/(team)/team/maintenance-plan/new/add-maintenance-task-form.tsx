"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { GroupedChoice, type ChoiceGroup } from "@/components/ui/grouped-choice";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { MaintenanceTaskFields, fieldOf } from "../maintenance-task-fields";
import { addMaintenanceTaskAction } from "./actions";
import { MACHINE_FIELD } from "./add-maintenance-task-input";
import { machinesRejectionText } from "../machines-rejection-text";

const { maintenancePlan: texts } = teamMessages;

/**
 * The form „Wartungsaufgabe hinzufügen“ (ST-040, ST-094): the name, the details every maintenance task has (shared with
 * changing one, ST-041) and „Geräte der Wartungsaufgabe“ – the machines in groups that fold (G27). A rejection keeps
 * every value and every machine ticked, opens the groups with a choice in them, names the reason above the submit
 * button and marks the field that caused it (G8).
 */
export function AddMaintenanceTaskForm({ version, groups }: { version: number; groups: ChoiceGroup[] }) {
  const [state, action, pending] = useActionState(addMaintenanceTaskAction, null);
  const rejectionId = useId();
  const kept = keptKey(state);
  const nameInvalid = state ? fieldOf[state.error] === "name" : false;

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={nameInvalid}>
        <FieldLabel htmlFor="name">{texts.name}</FieldLabel>
        <Input
          id="name"
          name="name"
          defaultValue={state?.values.name}
          key={`name-${kept}`}
          required
          aria-invalid={nameInvalid || undefined}
          aria-describedby={nameInvalid ? rejectionId : undefined}
        />
      </Field>
      <MaintenanceTaskFields values={state?.values ?? {}} kept={kept} error={state?.error} rejectionId={rejectionId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{texts.machines.title}</legend>
        {groups.length === 0 ? (
          <p className="text-sm">{texts.machines.noMachineYet}</p>
        ) : (
          <GroupedChoice
            name={MACHINE_FIELD}
            groups={groups}
            chosen={state?.chosen ?? []}
            key={`machines-${kept}`}
            header={texts.machines.groupHeader}
            selectAll={texts.machines.selectAll}
          />
        )}
      </fieldset>
      {state && (
        <div id={rejectionId}>
          <Rejection>{machinesRejectionText(state)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.add}
      </Button>
    </form>
  );
}
