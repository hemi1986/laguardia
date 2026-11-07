import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { AiModelProposalPage } from "@/modules/ai-assistance";
import { teamMessages } from "@/platform/messages";
import { tryAgainAddress } from "../../mit-ki-erstellen/request-ai-model-proposal-definition";

const { aiModelProposals: texts } = teamMessages;

/**
 * A failed AI model proposal (RM-AiModelProposal, ST-126, G7): the reason in plain German and „Nochmal versuchen“ – the
 * page „Mit KI erstellen“ with the description typed in. The description itself is on the proposal's page above. A
 * failed proposal is never written again automatically; it stays until it is discarded (ST-127).
 */
export function FailedAiModelProposal({ proposal }: { proposal: AiModelProposalPage }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{texts.failed}</p>
        {proposal.failureReason && <p>{texts.failureReasons[proposal.failureReason]}</p>}
      </div>
      <Link href={tryAgainAddress(proposal.id)} className={buttonVariants({ className: "self-start" })}>
        {texts.tryAgain}
      </Link>
    </>
  );
}
