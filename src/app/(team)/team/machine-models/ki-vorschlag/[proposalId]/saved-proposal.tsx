import Link from "next/link";
import { Section } from "@/components/ui/section";
import type { AiModelProposalPage } from "@/modules/ai-assistance";
import { teamMessages } from "@/platform/messages";
import { fileDetailsAddress } from "@/app/(team)/team/dateien/file-navigation";
import { NO_VERSION_SEEN } from "@/app/_actions/version";
import { RetryProposedDocumentForm } from "./retry-form";

const { aiModelProposals: texts } = teamMessages;

/**
 * A saved AI model proposal (RM-AiModelProposal, ST-128, G3): „Gespeichert“, the machine model it created – named and
 * linked –, the existing files attached to it and, for each chosen link, that it is being loaded (the page refreshes
 * itself while one is, G35), loaded as the file it became (ST-129) or failed with its reason (ST-129) and „Nochmal versuchen“
 * (ST-130, named by the link's place among the documents as written) – offered for a failed link only (G11).
 */
export function SavedAiModelProposal({ proposal }: { proposal: AiModelProposalPage }) {
  const documents = proposal.documents ?? [];
  const files = documents.flatMap((document) => (document.kind === "file" ? [document] : []));
  const links = documents.flatMap((document) => (document.kind === "link" ? [document] : []));
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{texts.saved}</p>
        {proposal.machineModel && (
          <p>
            {texts.savedModel}:{" "}
            <Link href={`/team/machine-models/${proposal.machineModel.id}`} className="underline underline-offset-4">
              {proposal.machineModel.title}
            </Link>
          </p>
        )}
      </div>
      {files.length > 0 && (
        <Section title={texts.attachedFiles}>
          <ul className="flex flex-col gap-1">
            {files.map((document) => (
              <li key={document.fileId}>
                <Link href={fileDetailsAddress(document.fileId)} className="underline underline-offset-4">
                  {document.title}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {links.length > 0 && (
        <Section title={texts.documentsToLoad}>
          <ul className="flex flex-col gap-1">
            {links.map((document) => (
              <li key={document.link} className="flex flex-col">
                <span>{document.title}</span>
                {document.loading === "waiting" && (
                  <span className="text-muted-foreground text-sm">{texts.loading}</span>
                )}
                {document.loading === "loaded" && document.fileId && (
                  <span className="text-sm">
                    {texts.loaded}:{" "}
                    <Link href={fileDetailsAddress(document.fileId)} className="underline underline-offset-4">
                      {document.title}
                    </Link>
                  </span>
                )}
                {document.loading === "failed" && document.reason && (
                  <span className="text-destructive text-sm">{texts.documentFailures[document.reason]}</span>
                )}
                {document.loading === "failed" && document.index !== undefined && (
                  <RetryProposedDocumentForm
                    proposalId={proposal.id}
                    version={proposal.version ?? NO_VERSION_SEEN}
                    index={document.index}
                  />
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
