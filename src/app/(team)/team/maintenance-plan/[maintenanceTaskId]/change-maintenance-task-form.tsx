"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { MaintenanceTaskFields } from "../maintenance-task-fields";
import { changeMaintenanceTaskAction } from "./actions";

const { maintenancePlan: texts } = teamMessages;

/** A maintenance task as its change form shows it before anything was typed – the values as the form writes them. */
export type TaskAsItIs = {
  id: string;
  name: string;
  instruction: string;
  intervalMonths: string;
  suitableForHelpers: boolean;
};

/**
 * The change form of a maintenance task (ST-041, G5): its details as they are, „Änderungen speichern“ – and
 * „Wartungsaufgabe entfernen“, which only asks, once, on its own (G10, G10b): the question names the task, says that it
 * never becomes due again and that its maintenance records stay. „Zurück“ returns to the form with everything typed;
 * only „Entfernen“ removes it. A rejection keeps every value and marks the field that caused it (G8). A task already
 * removed when the page loaded shows no form – but one removed while the technician typed keeps the form and the
 * rejection.
 */
export function ChangeMaintenanceTaskForm({
  task,
  version,
  removed,
}: {
  task: TaskAsItIs;
  version: number;
  removed: boolean;
}) {
  const [state, action, pending] = useActionState(changeMaintenanceTaskAction, null);
  const rejectionId = useId();
  if (removed && !state) return <p>{texts.notInPlan}</p>;

  if (state?.asking) {
    return (
      <form action={action} className="flex flex-col gap-4">
        {/* Everything typed goes along, so „Zurück“ returns to the form with it; an unticked checkbox is not sent. */}
        {Object.entries(state.values)
          .filter(([field, value]) => value !== "" || field === "maintenanceTaskId")
          .map(([field, value]) => (
            <input key={field} type="hidden" name={field} value={value} />
          ))}
        <p className="font-medium" role="alert">
          {texts.removeQuestion(task.name)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="step" value="remove" variant="destructive" disabled={pending}>
            {texts.confirmRemove}
          </Button>
          <Button type="submit" name="step" value="back" variant="outline" disabled={pending}>
            {texts.questionBack}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="maintenanceTaskId" value={task.id} />
      <VersionField version={version} />
      <MaintenanceTaskFields
        values={state?.values ?? task}
        kept={keptKey(state)}
        error={state?.error}
        rejectionId={rejectionId}
      />
      {state?.error && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" name="step" value="change" disabled={pending}>
        {texts.save}
      </Button>
      <Button type="submit" name="step" value="ask" variant="outline" disabled={pending} className="self-start">
        {texts.remove}
      </Button>
    </form>
  );
}
