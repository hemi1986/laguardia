"use client";

import { useActionState, useId } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import type { RecordMaintenanceState } from "./actions";
import { MaintenanceRecordFields, recordFieldOf } from "./maintenance-record-fields";

const { recordMaintenance: texts } = teamMessages;

/**
 * The form „Wartung erfassen“ (ST-044): outcome, date and note (`MaintenanceRecordFields`); it works without
 * JavaScript. The maintenance task and the machine are posted as hidden fields (team pages may post IDs); the command
 * checks them again.
 */
export function RecordMaintenanceForm({
  action: record,
  maintenanceTaskId,
  machineId,
  today,
  earliest,
  whyNot,
}: {
  action: (previous: RecordMaintenanceState, formData: FormData) => Promise<RecordMaintenanceState>;
  maintenanceTaskId: string;
  machineId: string;
  today: string;
  earliest: string;
  /** Why CMD-RecordMaintenance would refuse this team member here – its own reason (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, action, pending] = useActionState(record, null);
  const rejectionId = useId();
  // Shown in place of the form only while there is nothing to keep: a rejection after the machine was retired or the
  // task removed meanwhile keeps the form, the typed note and the reason (engineering conventions, ST-019 review).
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="maintenanceTaskId" value={maintenanceTaskId} />
      <input type="hidden" name="machineId" value={machineId} />
      <MaintenanceRecordFields
        values={state?.values}
        invalid={state ? recordFieldOf[state.error] : undefined}
        kept={keptKey(state)}
        rejectionId={rejectionId}
        today={today}
        earliest={earliest}
      />
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
