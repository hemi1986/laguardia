"use client";

import { useActionState, useId } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import type { MachineToChoose } from "@/modules/maintenance";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { MaintenanceRecordFields, recordFieldOf } from "../erfassen/maintenance-record-fields";
import type { RecordForSeveralState } from "./actions";

const { recordForSeveral: texts } = teamMessages;

/**
 * The form „Für mehrere Geräte erfassen“ (ST-045, G4a): first the machines the task is due on, ticked; then „Weitere
 * Geräte“ – the others it applies to, by location; outcome, date and note once for all, as in ST-044's form. Native
 * checkboxes, so it works without JavaScript; after a rejection the ticks are the ones sent.
 */
export function RecordForSeveralForm({
  action: record,
  maintenanceTaskId,
  due,
  others,
  today,
  earliest,
  whyNot,
}: {
  action: (previous: RecordForSeveralState, formData: FormData) => Promise<RecordForSeveralState>;
  maintenanceTaskId: string;
  due: MachineToChoose[];
  others: MachineToChoose[];
  today: string;
  earliest: string;
  /** Why CMD-RecordMaintenance would refuse this team member on every machine – its own reason (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, action, pending] = useActionState(record, null);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  if (due.length === 0 && others.length === 0 && !state) return <p>{texts.none}</p>;
  const kept = keptKey(state);
  const museumNumberOf = new Map([...due, ...others].map((machine) => [machine.machineId, machine.museumNumber]));
  const choice = (machine: MachineToChoose, preselected: boolean) => (
    <li key={`${machine.machineId}-${kept}`}>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="machineId"
          value={machine.machineId}
          defaultChecked={state ? state.chosen.includes(machine.machineId) : preselected}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          <span className="font-medium">{machine.museumNumber}</span> · {machine.machineModelTitle} · {machine.location}
        </span>
      </label>
    </li>
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="maintenanceTaskId" value={maintenanceTaskId} />
      <fieldset className="flex flex-col gap-4 [overflow-wrap:anywhere]">
        <legend className="sr-only">{texts.title}</legend>
        {due.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-medium">{texts.due}</h3>
            <ul className="flex flex-col gap-3">{due.map((machine) => choice(machine, true))}</ul>
          </div>
        )}
        {others.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-medium">{texts.others}</h3>
            <ul className="flex flex-col gap-3">{others.map((machine) => choice(machine, false))}</ul>
          </div>
        )}
      </fieldset>
      <MaintenanceRecordFields
        values={state?.values}
        invalid={state ? recordFieldOf[state.error] : undefined}
        kept={kept}
        rejectionId={rejectionId}
        today={today}
        earliest={earliest}
      />
      {state && (
        <div id={rejectionId}>
          <Rejection>
            {state.rejected ? (
              <ul className="flex flex-col gap-1">
                {state.rejected.map(({ item, error }) => (
                  <li key={item}>
                    {texts.notRecorded(museumNumberOf.get(item) ?? texts.aMachine, rejectionText(error))}
                  </li>
                ))}
              </ul>
            ) : (
              rejectionText(state.error)
            )}
          </Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
