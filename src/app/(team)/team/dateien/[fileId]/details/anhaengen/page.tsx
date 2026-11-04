import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "@/app/team-session";
import { originValue } from "../file-origin";
import { attachToFileAction } from "./actions";
import { loadAttachToFile } from "./attach-to-file-data";
import { AttachToFileForm } from "./attach-to-file-form-view";

/**
 * Attaching an existing file to further machines and machine models (CMD-AttachFile, ST-115, G27): its own form page,
 * reached from „Anhängen“ at the end of „Angehängt an“ (G21). Every team member. The heading is „Anhängen · <title>“
 * (G34); „Zurück zur Datei“ keeps the origin (G17). An unknown file is not found; a removed one says that it is gone.
 */
export default async function AttachToFilePage({
  params,
  searchParams,
}: PageProps<"/team/dateien/[fileId]/details/anhaengen">) {
  const viewer = await requireTeamMember();
  const { fileId } = await params;
  const file = await loadAttachToFile(database(), fileId, { params: await searchParams, viewer });
  if (!file) notFound();
  return (
    <Page title={teamMessages.attachToFile.title(file.title)}>
      <AttachToFileForm
        action={attachToFileAction.bind(null, file.id, originValue(file.origin))}
        removed={file.removed}
        machineGroups={file.machineGroups}
        machineModelGroups={file.machineModelGroups}
      />
      <BackLink href={file.back}>{teamMessages.fileDetails.backToFile}</BackLink>
    </Page>
  );
}
