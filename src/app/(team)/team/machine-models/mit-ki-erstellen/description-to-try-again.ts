import { aiModelProposalPage } from "@/modules/ai-assistance";
import type { Database } from "@/platform/command";
import { TRY_AGAIN_PARAMETER } from "./request-ai-model-proposal-definition";

/**
 * „Nochmal versuchen“ (ST-126, HS-42): the description of the failed AI model proposal the address names – read on the
 * server, so the typed words are not in the address. Only a failed proposal offers its description; a parameter given
 * twice, an unknown proposal or one that is not failed types nothing in.
 */
export async function descriptionToTryAgain(
  db: Database,
  query: Record<string, string | string[] | undefined>,
): Promise<string | undefined> {
  const id = query[TRY_AGAIN_PARAMETER];
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const proposal = await aiModelProposalPage(db, id);
  return proposal?.state === "failed" ? proposal.description : undefined;
}
