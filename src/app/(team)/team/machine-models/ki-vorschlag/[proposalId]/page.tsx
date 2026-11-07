import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { aiModelProposalPage } from "@/modules/ai-assistance";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../team-session";
import { WrittenAiModelProposal } from "./written-proposal";

const { aiModelProposals: texts } = teamMessages;

/**
 * An AI model proposal's own page (ST-123: while it is being written, G35; ST-124 adds the written one, ST-126 the failed one).
 * The technician lands here at once after sending; the page refreshes itself – a meta refresh needs no JavaScript – and can be left, the proposal is found again under „KI-Vorschläge“.
 */
export default async function AiModelProposalPage({
  params,
}: PageProps<"/team/machine-models/ki-vorschlag/[proposalId]">) {
  await requireTechnician();
  const { proposalId } = await params;
  const proposal = await aiModelProposalPage(database(), proposalId);

  return (
    <Page title={texts.proposal}>
      {!proposal ? (
        <p>{texts.unknown}</p>
      ) : (
        <div className="flex flex-col gap-3 [overflow-wrap:anywhere]">
          {proposal.state === "requested" && <meta httpEquiv="refresh" content="5" />}
          <p>{proposal.description}</p>
          {proposal.state === "written" && <WrittenAiModelProposal proposal={proposal} />}
          {proposal.state === "requested" && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{texts.running}</p>
              <p className="text-muted-foreground text-sm">{texts.runningHint}</p>
            </div>
          )}
        </div>
      )}
      <BackLink href="/team/machine-models">{texts.backToModels}</BackLink>
    </Page>
  );
}
