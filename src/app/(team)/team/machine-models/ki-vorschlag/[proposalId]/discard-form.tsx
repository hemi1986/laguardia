"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import type { AiModelProposalPage } from "@/modules/ai-assistance";
import { teamMessages } from "@/platform/messages";
import { VersionField } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { discardAiModelProposalAction } from "./actions";

const { aiModelProposals: texts } = teamMessages;

/**
 * „Verwerfen“ on a written or failed AI model proposal (ST-127): one button that posts the version the page showed. A
 * rejection is shown at the button (G8); it works without JavaScript.
 */
export function DiscardAiModelProposalForm({ proposal }: { proposal: AiModelProposalPage }) {
  const [state, action, pending] = useActionState(discardAiModelProposalAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="aiModelProposalId" value={proposal.id} />
      <VersionField version={proposal.version ?? -1} />
      {state && <Rejection>{rejectionText(state.error)}</Rejection>}
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {texts.discard}
      </Button>
    </form>
  );
}
