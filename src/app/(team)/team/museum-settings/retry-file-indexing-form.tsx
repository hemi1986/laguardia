"use client";

import { useActionState } from "react";
import { VersionField } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";
import type { RetryFileIndexingState } from "./retry-file-indexing-definition";

const { aiIndex: texts } = teamMessages;

/** A failed file as its row shows it – the words already put together on the server. */
export type FailedFileRow = { fileId: string; version: number; text: string };

/**
 * The failed files of the overview „KI-Erfassung“, each with „Erneut versuchen“ (ST-109): one tap posts the file and
 * the version of its AI index entry. All rows share one action state, and the component is rendered by the section „KI“
 * in the same place whether the overview is shown or not – so after a rejection that takes the file off the list (it
 * was indexed meanwhile) or the whole overview away (AI turned off), the reason is still said (G8), not swallowed
 * (conventions *Server Actions and forms*, ST-108 #1). One-tap buttons keep nothing, so the text is the command's.
 */
export function FailedFiles({
  action,
  failed,
}: {
  action: (previous: RetryFileIndexingState, formData: FormData) => Promise<RetryFileIndexingState>;
  /** None while AI is off – a rejection still shows once it is there. */
  failed: readonly FailedFileRow[];
}) {
  const [state, submit, pending] = useActionState(action, null);
  if (failed.length === 0 && !state) return null;
  return (
    <div className="flex flex-col gap-2">
      {state && <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>}
      {failed.length > 0 && (
        <ul className="flex flex-col gap-2">
          {failed.map((file) => (
            <li key={file.fileId} className="flex flex-col gap-1">
              <span>{file.text}</span>
              <form action={submit}>
                <input type="hidden" name="fileId" value={file.fileId} />
                <VersionField version={file.version} />
                <Button type="submit" variant="outline" disabled={pending} className="self-start">
                  {texts.retry}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
