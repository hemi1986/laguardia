"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";
import type { ClaimDefectState } from "./actions";

/**
 * The claim button of a defect's page (ST-025): one button that says what will happen (G14) – „Übernehmen“, or „Von Tom
 * übernehmen“ – and posts the version of the defect the page showed, so a claim made meanwhile is answered with a
 * conflict, not silently taken over. A rejection is shown at the button (G8); it works without JavaScript. Rendered
 * also when the page can no longer offer the claim, as long as there is a rejection to show.
 */
export function ClaimDefectForm({
  action: claim,
  version,
  label,
  offered,
}: {
  action: (previous: ClaimDefectState, formData: FormData) => Promise<ClaimDefectState>;
  version: number;
  label: string;
  /** Whether the team member may claim the defect as it is now (G11). */
  offered: boolean;
}) {
  const [state, action, pending] = useActionState(claim, null);
  if (!offered && !state) return null;

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="version" value={version} />
      {state && <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>}
      {offered && (
        <Button type="submit" disabled={pending} className="self-start">
          {label}
        </Button>
      )}
    </form>
  );
}
