"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { GroupedChoice, type ChoiceGroup } from "@/components/ui/grouped-choice";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { machinesRejectionText } from "../../machines-rejection-text";
import { changeMachinesAction } from "./actions";
import { MACHINE_FIELD, SEEN_SEPARATOR } from "./change-machines-input";

const { maintenancePlan: texts } = teamMessages;

/**
 * The form „Geräte ändern“ (ST-095, G27): the machines in groups that fold – closed when the page opens, the machines the
 * task applies to ticked. It posts the machines as they were ticked when the page opened (`seen`) next to the machines
 * ticked now, so the command applies what the technician changed. A rejection keeps `seen` and every tick, opens the
 * groups with a choice in them and names the reason above the button (G8). Without a machine registered it says so and
 * offers „Gerät erfassen“ (G7).
 */
export function ChangeMachinesForm({
  maintenanceTaskId,
  groups,
  chosen,
  removed,
}: {
  maintenanceTaskId: string;
  groups: ChoiceGroup[];
  /** The machines the task applies to now. */
  chosen: string[];
  /** The task was removed when the page loaded: nothing to change. */
  removed: boolean;
}) {
  const [state, action, pending] = useActionState(changeMachinesAction, null);
  const rejectionId = useId();
  if (removed && !state) return <p>{teamMessages.maintenancePlan.notInPlan}</p>;
  if (groups.length === 0 && !state) {
    return (
      <>
        <p>{texts.changeMachines.noMachineYet}</p>
        <Link href="/team/machines/new" className={buttonVariants({ className: "self-start" })}>
          {texts.changeMachines.register}
        </Link>
      </>
    );
  }
  const kept = keptKey(state);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="maintenanceTaskId" value={maintenanceTaskId} />
      {/* What was ticked when the page opened: after a rejection what the first page showed, not what is stored now. */}
      <input type="hidden" name="seen" value={state?.values.seen ?? chosen.join(SEEN_SEPARATOR)} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{texts.machines.title}</legend>
        <GroupedChoice
          name={MACHINE_FIELD}
          groups={groups}
          chosen={state?.chosen ?? chosen}
          key={`machines-${kept}`}
          header={texts.machines.groupHeader}
          selectAll={texts.machines.selectAll}
          openWithChoice={!!state}
        />
      </fieldset>
      {state && (
        <div id={rejectionId}>
          <Rejection>{machinesRejectionText(state)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.changeMachines.submit}
      </Button>
    </form>
  );
}
