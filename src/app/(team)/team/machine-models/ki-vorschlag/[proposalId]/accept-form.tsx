"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Rejection } from "@/components/ui/message";
import type { AiModelProposalPage } from "@/modules/ai-assistance";
import { teamMessages } from "@/platform/messages";
import { keptKey, VersionField } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import type { Choices } from "../../machine-model-fields";
import { acceptAiModelProposalAction } from "./actions";
import { WrittenProposalFields } from "./written-proposal-fields";

const { aiModelProposals: texts } = teamMessages;

/**
 * „Speichern“ on a written AI model proposal (ST-128, G8, G8a): the proposal's fields and documents as a form. A
 * rejection says its reason, keeps what was typed and ticked and – for a file removed meanwhile (HS-38) – names the
 * document; the page shows that document as removed and not ticked. Works without JavaScript.
 */
export function AcceptAiModelProposalForm({
  proposal,
  choices,
  fileAddresses,
}: {
  proposal: AiModelProposalPage;
  choices: Choices;
  fileAddresses: Readonly<Record<string, string>>;
}) {
  const [state, action, pending] = useActionState(acceptAiModelProposalAction, null);
  const rejectionId = useId();
  const removed = (state?.subjects ?? []).flatMap((fileId) =>
    (proposal.documents ?? []).flatMap((document) =>
      document.kind === "file" && document.fileId === fileId ? [`„${document.title}“`] : [],
    ),
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="aiModelProposalId" value={proposal.id} />
      <VersionField version={proposal.version ?? -1} />
      <WrittenProposalFields
        proposal={proposal}
        choices={choices}
        fileAddresses={fileAddresses}
        kept={state ?? undefined}
        keptKey={keptKey(state)}
        rejectionId={rejectionId}
      />
      {state && (
        <div id={rejectionId}>
          <Rejection>
            {rejectionText(state.error, {
              "ai-model-proposal-document-removed": `${removed.join(", ")} ${removed.length > 1 ? "wurden" : "wurde"} inzwischen entfernt. Es wurde nichts gespeichert.`,
            })}
          </Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.save}
      </Button>
    </form>
  );
}
