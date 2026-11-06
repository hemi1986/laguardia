import Link from "next/link";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import { Section } from "@/components/ui/section";
import type { RetryFileIndexingState } from "@/app/(team)/team/museum-settings/retry-file-indexing-definition";
import { teamMachinePage } from "@/app/museum-number-address";
import { teamMessages } from "@/platform/messages";
import { DetachFileButton } from "./detach-file-button";
import type { DetachFileState } from "./detach-file-form";
import { targetValue, attachedToText } from "./file-attachments";
import type { FileDetailsData } from "./file-details-data";
import { RetryFileForm } from "./retry-file-form";

const { fileDetails: texts, aiIndex } = teamMessages;

/**
 * The file details (RM-FileDetails, ST-114, G18) in the order of the guideline: the head, „Angehängt an“ – with
 * „Anhängen“ at its end and „Lösen“ on each entry for technicians (ST-115) – and, while AI is on, „KI-Erfassung“, under
 * the file's title as the heading. A view receives everything it shows; the section „KI-Erfassung“ is absent when `ai`
 * is none (G37).
 */
export function FileDetailsView({
  file,
  retry,
  detach,
}: {
  file: FileDetailsData;
  /** „Erneut versuchen“'s Server Action, the origin already bound. */
  retry: (previous: RetryFileIndexingState, formData: FormData) => Promise<RetryFileIndexingState>;
  /** „Lösen“'s Server Action, file and origin already bound (ST-115). */
  detach: (previous: DetachFileState, formData: FormData) => Promise<DetachFileState>;
}) {
  return (
    <Page title={file.title}>
      {file.retried && <Confirmation>{aiIndex.retrying(file.retried)}</Confirmation>}
      {file.attachedConfirmation && <Confirmation>{file.attachedConfirmation}</Confirmation>}
      {file.detachedConfirmation && <Confirmation>{file.detachedConfirmation}</Confirmation>}
      {file.savedConfirmation && <Confirmation>{file.savedConfirmation}</Confirmation>}
      <div className="flex flex-col gap-2">
        <p>{texts.head(file.category, texts.mediaTypes[file.mediaType], file.size)}</p>
        <p className="text-muted-foreground text-sm">{texts.addedBy(file.addedBy, file.addedOn)}</p>
        {file.originalFileName && <p className="text-sm break-all">{texts.originalFileName(file.originalFileName)}</p>}
        <a href={`/team/dateien/${file.id}`} className="self-start underline underline-offset-4">
          {texts.open}
        </a>
        <div>
          <Link href={file.editHref} className={buttonVariants({ variant: "outline" })}>
            {texts.edit}
          </Link>
        </div>
      </div>
      <Section title={texts.attachedTo}>
        {file.attachedTo.length === 0 ? (
          <p className="text-sm">{texts.nowhere}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm [overflow-wrap:anywhere]">
            {file.attachedTo.map((target) => (
              <li
                key={target.kind === "machine" ? target.machineId : target.machineModelId}
                className="flex flex-wrap items-start justify-between gap-2"
              >
                {target.kind === "machine" ? (
                  <Link href={teamMachinePage()(target.museumNumber)} className="underline underline-offset-4">
                    {attachedToText(target)}
                  </Link>
                ) : (
                  <span>{attachedToText(target)}</span>
                )}
                {file.detachOffered && <DetachFileButton action={detach} target={targetValue(target)} />}
              </li>
            ))}
          </ul>
        )}
        <div>
          <Link href={file.attachHref} className={buttonVariants({ variant: "outline" })}>
            {texts.attach}
          </Link>
        </div>
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
            : texts.backToFiles}
      </BackLink>
    </Page>
  );
}
