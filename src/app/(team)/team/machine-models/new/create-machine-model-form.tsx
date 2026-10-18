"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import { keptKey } from "@/app/_actions/form-parts";
import { MachineModelFields, type Choices } from "../machine-model-fields";
import { createMachineModelAction } from "./actions";

const { machineModels: texts } = teamMessages;

/**
 * The form creating a machine model (ST-006), on its own page since ST-036 (G2a), run through the Server Action runner
 * (ST-073, Q9): a rejection shows the catalogue text of its error code, marks its field and keeps what was typed –
 * with and without JavaScript.
 */
export function CreateMachineModelForm(choices: Choices) {
  const [state, action, pending] = useActionState(createMachineModelAction, null);
  const rejectionId = useId();

  return (
    <form action={action} className="flex flex-col gap-5">
      <MachineModelFields {...choices} rejection={state ?? undefined} kept={keptKey(state)} rejectionId={rejectionId} />
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.create}
      </Button>
    </form>
  );
}
