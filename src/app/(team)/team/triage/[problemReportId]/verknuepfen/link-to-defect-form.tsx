"use client";

import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import type { MachineStatus } from "@/modules/collection";
import type { DefectsToLinkTo } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import type { LinkToDefectState } from "./actions";
import { triageRejectionText } from "../triage-rejection-text";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { MachineStatusChoice } from "../../../defect-fields";
import { DefectsToLinkToField } from "../../../defects-to-link-to";
import { aboutTheChosenDefect, anythingToLinkTo } from "../../../defect-to-link-to-input";

const { link: texts, triage } = teamMessages;

/**
 * The form „Mit Defekt verknüpfen“ (ST-022, story review 2026-10-03): the machine's open defects and – since ST-053 –
 * its recently resolved ones, which linking reopens. While a recently resolved defect is offered, the machine status
 * may become stricter in the same step, „Status nicht ändern“ preselected (ST-018's form), with a hint that it applies
 * only to a reopened defect (user, 2026-10-25). A rejection keeps the chosen defect, if it is still offered, and the
 * status, and is shown at the form (G8). Without anything to link to there is no form. A problem report already
 * triaged when the page loaded shows no form – but one triaged while the person chose keeps the form and the rejection.
 */
export function LinkToDefectForm({
  action: link,
  version,
  triaged,
  museumNumber,
  defects,
  machine,
}: {
  action: (previous: LinkToDefectState, formData: FormData) => Promise<LinkToDefectState>;
  version: number;
  triaged: boolean;
  museumNumber: string;
  defects: DefectsToLinkTo;
  machine: { status: MachineStatus; version: number; stricter: MachineStatus[] };
}) {
  const [state, action, pending] = useActionState(link, null);
  const rejectionId = useId();
  if (triaged && !state) return <p>{triage.alreadyTriaged}</p>;
  // Nothing to choose: the page says so (G7) – no form that could only be rejected. After a rejection it stays.
  if (!anythingToLinkTo(defects) && !state) return null;
  const kept = keptKey(state);
  const defectInvalid = aboutTheChosenDefect(state?.error);
  const statusInvalid =
    state?.error === "machine-status-not-stricter" || state?.error === "machine-status-without-reopening";

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <DefectsToLinkToField
        defects={defects}
        value={state?.values.defectId}
        kept={kept}
        invalid={defectInvalid}
        describedBy={defectInvalid ? rejectionId : undefined}
      />
      {defects.recentlyResolved.length > 0 && (
        <MachineStatusChoice
          museumNumber={museumNumber}
          machine={machine}
          value={state?.values.machineStatus}
          kept={kept}
          invalid={statusInvalid}
          note={texts.statusOnlyWhenReopening}
          aria={{
            "aria-invalid": statusInvalid || undefined,
            "aria-describedby": statusInvalid ? `machineStatus-hint ${rejectionId}` : "machineStatus-hint",
          }}
        />
      )}
      {state && (
        <div id={rejectionId} className="flex flex-col gap-2">
          <Rejection>{triageRejectionText(state)}</Rejection>
          {state.error === "already-triaged" && <BackLink href="/team/triage">{triage.back}</BackLink>}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
