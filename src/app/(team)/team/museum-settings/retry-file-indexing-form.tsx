"use client";

import { useActionState } from "react";
import { VersionField } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import type { RetryFileIndexingState } from "./retry-file-indexing-definition";

const { aiIndex: texts } = teamMessages;

/**
 * „Erneut versuchen“ under a failed file in the overview „KI-Erfassung“ (ST-109): one tap, the file and the version of
 * its AI index entry as hidden fields. A rejection is shown at the button (G8); it works without JavaScript.
 */
export function RetryFileIndexingForm({
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
      <input type="hidden" name="fileId" value={fileId} />
      <VersionField version={version} />
      {state && <Rejection>{rejectionText(state.error)}</Rejection>}
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {texts.retry}
      </Button>
    </form>
  );
}
