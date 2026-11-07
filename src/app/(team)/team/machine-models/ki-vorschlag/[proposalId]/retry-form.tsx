"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { VersionField } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { retryProposedDocumentAction } from "./actions";

const { aiModelProposals: texts } = teamMessages;

/**
 * „Nochmal versuchen“ beside a failed link of a saved AI model proposal (ST-130): one tap posts the proposal, the version the page showed and the
 * link's place. A rejection is shown at the button (G8); it works without JavaScript.
 */
export function RetryProposedDocumentForm({
  proposalId,
  version,
  index,
}: {
  proposalId: string;
  version: number;
  index: number;
}) {
  const [state, action, pending] = useActionState(retryProposedDocumentAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="aiModelProposalId" value={proposalId} />
      <VersionField version={version} />
      <input type="hidden" name="index" value={index} />
      {state && <Rejection>{rejectionText(state.error)}</Rejection>}
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {texts.retry}
      </Button>
    </form>
  );
}
