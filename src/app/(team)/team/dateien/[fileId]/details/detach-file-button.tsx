"use client";

import { useActionState } from "react";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import type { DetachFileState } from "./detach-file-form";

/**
 * „Lösen“ on one entry of „Angehängt an“ (ST-115, G10a): one tap, no question, on a machine or a machine model, a
 * retired machine too. The button stays mounted when the page changes meanwhile, so a rejection is said, not swallowed
 * (G8); it works without JavaScript.
 */
export function DetachFileButton({
  action,
  target,
}: {
  action: (previous: DetachFileState, formData: FormData) => Promise<DetachFileState>;
  target: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="flex flex-col gap-1">
      <input type="hidden" name="target" value={target} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {teamMessages.fileDetails.detach}
      </Button>
      {state && <Rejection>{rejectionText(state.error)}</Rejection>}
    </form>
  );
}
