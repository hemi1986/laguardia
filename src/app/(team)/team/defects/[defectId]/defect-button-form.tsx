"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/_actions/form-action";
import { VersionField } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import type { DefectVersionField } from "./defect-version-input";

/** What a one-tap action on a defect answers: nothing, or its command's rejection – one that has a text. */
export type DefectButtonState<Error extends TeamCommandErrorCode> = FormState<Error, DefectVersionField>;

export type DefectButtonAction<Error extends TeamCommandErrorCode> = (
  previous: DefectButtonState<Error>,
  formData: FormData,
) => Promise<DefectButtonState<Error>>;

/** A button that names a team member wraps at 360 px instead of running out of the page (G16). */
export const longLabel = "h-auto min-h-8 max-w-full py-1 text-start whitespace-normal";

/**
 * An action on a defect that is one tap (G22): claiming it (ST-025) or releasing its claim (ST-026). One button that
 * says what will happen (G14) – „Übernehmen“, „Von Tom übernehmen“, „Abgeben“ – and posts the version of the defect the
 * page showed, so a change made meanwhile is answered with a conflict. A rejection is shown at the button (G8); it
 * works without JavaScript. Rendered also when the page can no longer offer the action, as long as there is a
 * rejection to show.
 */
export function DefectButtonForm<Error extends TeamCommandErrorCode>({
  action: run,
  version,
  label,
  offered,
  variant,
}: {
  action: DefectButtonAction<Error>;
  version: number;
  label: string;
  /** Whether the team member may do this to the defect as it is now (G11). */
  offered: boolean;
  variant?: "outline";
}) {
  const [state, action, pending] = useActionState(run, null);
  if (!offered && !state) return null;

  return (
    <form action={action} className="flex flex-col gap-2">
      <VersionField version={version} />
      {state && <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>}
      {offered && (
        <Button type="submit" variant={variant} disabled={pending} className={`self-start ${longLabel}`}>
          {label}
        </Button>
      )}
    </form>
  );
}
