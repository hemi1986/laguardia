"use client";

import { useActionState } from "react";
import { VersionField } from "@/app/_actions/form-parts";
import type { RetryFileIndexingState } from "@/app/(team)/team/museum-settings/retry-file-indexing-definition";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";

/**
 * „Erneut versuchen“ on the file details (ST-114): one tap posts the file and the version of its AI index entry the page
 * showed – the command decides, so a rejection (indexed meanwhile, AI turned off) is said here (G8). One-tap buttons keep
 * nothing, so the text is the command's.
 */
export function RetryFileForm({
  action,
  fileId,
  version,
}: {
  action: (previous: RetryFileIndexingState, formData: FormData) => Promise<RetryFileIndexingState>;
  fileId: string;
  version: number;
}) {
  const [state, submit, pending] = useActionState(action, null);
  return (
    <form action={submit} className="flex flex-col gap-2">
      {state && <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>}
      <input type="hidden" name="fileId" value={fileId} />
      <VersionField version={version} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {teamMessages.aiIndex.retry}
      </Button>
    </form>
  );
}
