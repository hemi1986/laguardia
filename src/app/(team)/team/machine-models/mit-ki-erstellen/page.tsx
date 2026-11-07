import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { aiDependencies, aiModelProposalRefusal } from "@/modules/ai-assistance";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { requestAiModelProposalAction } from "./actions";
import { descriptionToTryAgain } from "./description-to-try-again";
import { RequestAiModelProposalForm } from "./request-form";

const { aiModelProposals: texts } = teamMessages;

/**
 * „Mit KI erstellen“ (ST-123) – the request's own page (G2a), reached from the machine models page and back there via
 * „Abbrechen“ (G3). It shows CMD-RequestAiModelProposal's reason in place of the form where it would refuse (G11).
 */
export default async function RequestAiModelProposalPage({
  searchParams,
}: PageProps<"/team/machine-models/mit-ki-erstellen">) {
  await requireTechnician();
  const whyNot = await aiModelProposalRefusal(database(), aiDependencies());
  // „Nochmal versuchen“ (ST-126): the form starts with the failed proposal's description.
  const initialDescription = await descriptionToTryAgain(database(), await searchParams);

  return (
    <Page title={texts.createTitle}>
      <RequestAiModelProposalForm
        action={requestAiModelProposalAction}
        whyNot={whyNot}
        initialDescription={initialDescription}
      />
      <BackLink href="/team/machine-models">{texts.cancel}</BackLink>
    </Page>
  );
}
