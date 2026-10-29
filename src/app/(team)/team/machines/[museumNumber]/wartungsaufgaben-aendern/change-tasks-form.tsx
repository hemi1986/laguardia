"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { keptKey, SeenField } from "@/app/_actions/form-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { GroupedChoice, type ChoiceGroup } from "@/components/ui/grouped-choice";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { changeTasksAction } from "./actions";
import { TASK_FIELD } from "./change-tasks-input";
import { tasksRejectionText } from "../../tasks-rejection-text";

const { changeTasks: texts, maintenancePlan } = teamMessages;

/**
 * The form „Wartungsaufgaben ändern“ (ST-096, G27): the maintenance tasks in groups by interval that fold – closed when the
 * page opens, the tasks that apply to the machine ticked. It posts the tasks as they were ticked when the page opened
 * (`seen`) next to the tasks ticked now, so the command applies what the technician changed. A rejection keeps `seen` and
 * every tick, opens the groups with a choice in them and names the reason above the button (G8). With no maintenance task
 * in the maintenance plan it says so and leads there (G7).
 */
export function ChangeTasksForm({
  machineId,
  groups,
  chosen,
}: {
  machineId: string;
  groups: ChoiceGroup[];
  /** The tasks that apply to the machine now. */
  chosen: string[];
}) {
  const [state, action, pending] = useActionState(changeTasksAction, null);
  const rejectionId = useId();
  if (groups.length === 0 && !state) {
    return (
      <>
        <p>{maintenancePlan.empty}</p>
        <Link href="/team/maintenance-plan" className={buttonVariants({ className: "self-start" })}>
          {texts.toPlan}
        </Link>
      </>
    );
  }
  const kept = keptKey(state);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="machineId" value={machineId} />
      {/* What was ticked when the page opened: after a rejection what the first page showed, not what is stored now. */}
      <SeenField seen={state?.seen ?? chosen} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{texts.legend}</legend>
        <GroupedChoice
          name={TASK_FIELD}
          groups={groups}
          chosen={state?.chosen ?? chosen}
          key={`tasks-${kept}`}
          header={maintenancePlan.machines.groupHeader}
          selectAll={maintenancePlan.machines.selectAll}
          openWithChoice={!!state}
        />
      </fieldset>
      {state && (
        <div id={rejectionId}>
          <Rejection>{tasksRejectionText(state)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
