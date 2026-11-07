import type { AiModelProposalPage } from "@/modules/ai-assistance";
import { fileDetailsAddress } from "@/app/(team)/team/dateien/file-navigation";
import { machineModelChoices } from "../../choices";
import { AcceptAiModelProposalForm } from "./accept-form";

/**
 * A written AI model proposal (RM-AiModelProposal, ST-124, ST-128): its fields, sources and documents as the form
 * „Modell speichern“. The choices of the selects and the addresses of the files are built here, on the server, so the
 * client form imports no server code. „Verwerfen“ comes with ST-127.
 */
export function WrittenAiModelProposal({ proposal }: { proposal: AiModelProposalPage }) {
  const fileAddresses = Object.fromEntries(
    (proposal.documents ?? []).flatMap((document) =>
      document.kind === "file" ? [[document.fileId, fileDetailsAddress(document.fileId)]] : [],
    ),
  );
  return <AcceptAiModelProposalForm proposal={proposal} choices={machineModelChoices} fileAddresses={fileAddresses} />;
}
