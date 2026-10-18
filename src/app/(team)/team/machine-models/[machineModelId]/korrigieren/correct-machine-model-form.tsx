"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import type { MachineModel } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { MachineModelFields, type Choices } from "../../machine-model-fields";
import { correctMachineModelAction } from "./actions";

const { machineModels: texts } = teamMessages;

/**
 * The correction form (ST-036): the machine model's details filled in, posted with the version the page loaded. A
 * rejection keeps what was typed and marks its field (G8), with and without JavaScript.
 */
export function CorrectMachineModelForm({
  model,
  version,
  ...choices
}: Choices & { model: MachineModel; version: number }) {
  const [state, action, pending] = useActionState(correctMachineModelAction, null);
  const rejectionId = useId();
  const { id, ...given } = model;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="machineModelId" value={id} />
      <VersionField version={version} />
      <MachineModelFields
        {...choices}
        given={given}
        rejection={state ?? undefined}
        kept={keptKey(state)}
        rejectionId={rejectionId}
      />
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.correct}
      </Button>
    </form>
  );
}
