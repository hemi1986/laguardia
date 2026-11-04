"use client";

import { useActionState } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { TeamGroupedChoice } from "@/app/(team)/team/team-grouped-choice";
import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";
import type { AttachToFileState } from "./attach-to-file-form";

const { attachToFile: texts } = teamMessages;

/**
 * The form „Anhängen“ (ST-115, G27): „Geräte“ and „Modelle“, each in groups that fold by machine category and technology,
 * nothing ticked when the page opens. A rejection keeps the choice and opens the groups with one (G8, G27). Nothing left
 * to offer says so and has no submit (G7); a removed file says that it is gone. Works without JavaScript.
 */
export function AttachToFileForm({
  action,
  removed,
  machineGroups,
  machineModelGroups,
}: {
  action: (previous: AttachToFileState, formData: FormData) => Promise<AttachToFileState>;
  removed: boolean;
  machineGroups: ChoiceGroup[];
  machineModelGroups: ChoiceGroup[];
}) {
  const [state, run, pending] = useActionState(action, null);
  const kept = keptKey(state);
  const nothingLeft = machineGroups.length === 0 && machineModelGroups.length === 0;

  return (
    <form action={run} className="flex flex-col gap-5">
      {removed ? (
        <Rejection>{commandErrorText(teamMessages, state?.error ?? "file-removed")}</Rejection>
      ) : nothingLeft ? (
        <p>{texts.nothingLeft}</p>
      ) : (
        <>
          {machineGroups.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">{texts.machines}</h2>
              <TeamGroupedChoice
                key={`machines-${kept}`}
                name="targets"
                groups={machineGroups}
                chosen={state?.chosen ?? []}
              />
            </section>
          )}
          {machineModelGroups.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">{texts.machineModels}</h2>
              <TeamGroupedChoice
                key={`models-${kept}`}
                name="targets"
                groups={machineModelGroups}
                chosen={state?.chosen ?? []}
              />
            </section>
          )}
        </>
      )}
      {state && !removed && <Rejection>{rejectionText(state.error)}</Rejection>}
      {!removed && !nothingLeft && (
        <Button type="submit" disabled={pending}>
          {texts.submit}
        </Button>
      )}
    </form>
  );
}
