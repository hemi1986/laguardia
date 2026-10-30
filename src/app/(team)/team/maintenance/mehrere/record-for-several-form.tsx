"use client";

import { useActionState, useId } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { TeamGroupedChoice } from "../../team-grouped-choice";
import { Rejection } from "@/components/ui/message";
import type { MachineToChoose } from "@/modules/maintenance";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { MaintenanceRecordFields, recordFieldOf } from "../erfassen/maintenance-record-fields";
import type { RecordForSeveralState } from "./actions";
import type { ChoiceOfSeveral } from "./choice-for-several";

const { recordForSeveral: texts } = teamMessages;

/**
 * The machines to tick (ST-098, G27): the group „Fällig“, ticked and so open when the page opens; then under „Weitere
 * Geräte“ the further machines in groups by machine category and technology, closed. `chosen` is what is ticked – after a
 * rejection what was sent, whose groups open. Keyed on `kept`, so a rejection starts both choices again.
 */
export function ChoiceForSeveral({
  due,
  others,
  chosen,
  kept,
}: ChoiceOfSeveral & { chosen: readonly string[]; kept: string }) {
  const choice = { name: "machineId", chosen };
  return (
    <fieldset className="flex flex-col gap-4 [overflow-wrap:anywhere]">
      <legend className="sr-only">{texts.start}</legend>
      {due && <TeamGroupedChoice {...choice} key={`due-${kept}`} groups={[due]} />}
      {others.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">{texts.others}</h3>
          <TeamGroupedChoice {...choice} key={`others-${kept}`} groups={others} />
        </div>
      )}
    </fieldset>
  );
}

/**
 * The form „Für mehrere Geräte erfassen“ (ST-045, G4a): first the machines the task is due on, ticked; then „Weitere
 * Geräte“ – the others it applies to, in groups that fold (ST-098); outcome, date and note once for all, as in ST-044's
 * form. Native checkboxes in native folds, so it works without JavaScript; after a rejection the ticks are the ones sent.
 */
export function RecordForSeveralForm({
  action: record,
  maintenanceTaskId,
  due,
  others,
  choice,
  today,
  earliest,
  whyNot,
}: {
  action: (previous: RecordForSeveralState, formData: FormData) => Promise<RecordForSeveralState>;
  maintenanceTaskId: string;
  due: MachineToChoose[];
  others: MachineToChoose[];
  /** The same machines in their groups. */
  choice: ChoiceOfSeveral;
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

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="maintenanceTaskId" value={maintenanceTaskId} />
      <ChoiceForSeveral {...choice} chosen={state?.chosen ?? due.map((machine) => machine.machineId)} kept={kept} />
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
