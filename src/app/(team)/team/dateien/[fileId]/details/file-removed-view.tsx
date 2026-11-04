import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { Rejection } from "@/components/ui/message";
import { commandErrorText, teamMessages } from "@/platform/messages";
import type { wayBack } from "./file-origin";

const { fileDetails: texts } = teamMessages;

/**
 * The file details' answer after a detach on a file removed meanwhile (ST-115): a removed file has no details page
 * (ST-114), but the person must see why their tap did nothing – „Diese Datei wurde schon entfernt.“ – and a way back.
 * Reached only by the detach action's `?detachFailed=file-removed`; any other address of a removed file stays not found.
 */
export function FileRemovedView({ back }: { back: ReturnType<typeof wayBack> }) {
  return (
    <Page title={texts.removedTitle}>
      <Rejection>{commandErrorText(teamMessages, "file-removed")}</Rejection>
      <BackLink href={back.href}>
        {back.kind === "machine"
          ? texts.backToMachine
          : back.kind === "settings"
            ? texts.backToSettings
            : texts.backToMachines}
      </BackLink>
    </Page>
  );
}
