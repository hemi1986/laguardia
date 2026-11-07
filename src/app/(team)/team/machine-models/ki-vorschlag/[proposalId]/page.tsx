import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { aiModelProposalLeftUnfinished, aiModelProposalPage, type AiModelProposalPage } from "@/modules/ai-assistance";
import { startAiWorkAfterResponse } from "@/app/ai-work";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../team-session";
import { Rejection } from "@/components/ui/message";
import { commandErrorText } from "@/platform/messages";
import { ALREADY_SAVED } from "./document-fields";
import { FailedAiModelProposal } from "./failed-proposal";
import { SavedAiModelProposal } from "./saved-proposal";
import { WrittenAiModelProposal } from "./written-proposal";

const { aiModelProposals: texts } = teamMessages;

/** A saved proposal refreshes itself while a chosen link is still being loaded (G35). */
const waitsForLinks = (proposal: AiModelProposalPage) =>
  proposal.state === "accepted" &&
  (proposal.documents ?? []).some((document) => document.kind === "link" && document.loading === "waiting");

/**
 * An AI model proposal's own page (ST-123: while it is being written, G35; ST-124 adds the written one, ST-126 the failed one, which says why).
 * The technician lands here at once after sending; the page refreshes itself – a meta refresh needs no JavaScript – and can be left, the proposal is found again under „KI-Vorschläge“.
 */
export default async function AiModelProposalPage({
  params,
  searchParams,
}: PageProps<"/team/machine-models/ki-vorschlag/[proposalId]">) {
  await requireTechnician();
  const { proposalId } = await params;
  const alreadySaved = (await searchParams)[ALREADY_SAVED] === "1";
  const proposal = await aiModelProposalPage(database(), proposalId);
  // A proposal being written whose hold ran out without a result starts a run that records the break-off (HS-33,
  // ADR 0015) – never before, so the five-second refresh does not start work on every load.
  if (proposal?.state === "requested" && (await aiModelProposalLeftUnfinished(database(), systemClock, proposal.id))) {
    startAiWorkAfterResponse();
  }

  return (
    <Page title={texts.proposal}>
      {!proposal ? (
        <p>{texts.unknown}</p>
      ) : (
        <div className="flex flex-col gap-3 [overflow-wrap:anywhere]">
          {(proposal.state === "requested" || waitsForLinks(proposal)) && <meta httpEquiv="refresh" content="5" />}
          <p>{proposal.description}</p>
          {proposal.state === "written" && <WrittenAiModelProposal proposal={proposal} />}
          {proposal.state === "failed" && <FailedAiModelProposal proposal={proposal} />}
          {proposal.state === "accepted" && (
            <>
              {alreadySaved && (
                <Rejection>{commandErrorText(teamMessages, "ai-model-proposal-already-accepted")}</Rejection>
              )}
              <SavedAiModelProposal proposal={proposal} />
            </>
          )}
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
