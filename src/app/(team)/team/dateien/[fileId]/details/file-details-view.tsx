import Link from "next/link";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import { Section } from "@/components/ui/section";
import type { RetryFileIndexingState } from "@/app/(team)/team/museum-settings/retry-file-indexing-definition";
import { teamMachinePage } from "@/app/museum-number-address";
import { teamMessages } from "@/platform/messages";
import { attachedToText } from "./file-attachments";
import type { FileDetailsData } from "./file-details-data";
import { RetryFileForm } from "./retry-file-form";

const { fileDetails: texts, aiIndex } = teamMessages;

/**
 * The file details (RM-FileDetails, ST-114, G18) in the order of the guideline: the head, „Angehängt an“ and – while AI is
 * on – „KI-Erfassung“, under the file's title as the heading. A view receives everything it shows; the section „KI-Erfassung“ is absent when `ai` is none (G37).
 */
export function FileDetailsView({
  file,
  retry,
}: {
  file: FileDetailsData;
  /** „Erneut versuchen“'s Server Action, the origin already bound. */
  retry: (previous: RetryFileIndexingState, formData: FormData) => Promise<RetryFileIndexingState>;
}) {
  return (
    <Page title={file.title}>
      {file.retried && <Confirmation>{aiIndex.retrying(file.retried)}</Confirmation>}
      <div className="flex flex-col gap-2">
        <p>{texts.head(file.category, texts.mediaTypes[file.mediaType], file.size)}</p>
        <p className="text-muted-foreground text-sm">{texts.addedBy(file.addedBy, file.addedOn)}</p>
        <a href={`/team/dateien/${file.id}`} className="self-start underline underline-offset-4">
          {texts.open}
        </a>
      </div>
      <Section title={texts.attachedTo}>
        {file.attachedTo.length === 0 ? (
          <p className="text-sm">{texts.nowhere}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm [overflow-wrap:anywhere]">
            {file.attachedTo.map((target) =>
              target.kind === "machine" ? (
                <li key={target.machineId}>
                  <Link href={teamMachinePage()(target.museumNumber)} className="underline underline-offset-4">
                    {attachedToText(target)}
                  </Link>
                </li>
              ) : (
                <li key={target.machineModelId}>{attachedToText(target)}</li>
              ),
            )}
          </ul>
        )}
      </Section>
      {file.ai && (
        <Section title={aiIndex.title}>
          <p className="text-sm">
            {file.ai.state === "failed"
              ? aiIndex.fileState.failed(aiIndex.failureReasons[file.ai.reason])
              : aiIndex.fileState[file.ai.state]}
          </p>
          {file.retryOffered && file.ai.state === "failed" && (
            <RetryFileForm action={retry} fileId={file.id} version={file.ai.version} />
          )}
        </Section>
      )}
      {file.removalHref && (
        // At the end of the page, technicians only (G18, G11) – an ordinary secondary button, not red (G30).
        <div>
          <Link href={file.removalHref} className={buttonVariants({ variant: "outline" })}>
            {teamMessages.removeFile.button}
          </Link>
        </div>
      )}
      <BackLink href={file.back.href}>
        {file.back.kind === "machine"
          ? texts.backToMachine
          : file.back.kind === "settings"
            ? texts.backToSettings
            : texts.backToMachines}
      </BackLink>
    </Page>
  );
}
