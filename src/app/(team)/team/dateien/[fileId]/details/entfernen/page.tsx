import { notFound } from "next/navigation";
import { removeFileRefusal } from "@/modules/collection";
import { database } from "@/platform/database";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../../team-session";
import { originValue } from "../../../file-navigation";
import { removeFileAction } from "./actions";
import { loadRemoveFile } from "./remove-file-data";
import { RemoveFileView } from "./remove-file-view";

/**
 * The question before removing a file (CMD-RemoveFile, ST-121, G10b): technicians only (helpers are sent back; the
 * command refuses them anyway). The page names the file, says that it is deleted for good and lists every machine and
 * machine model it disappears from. An unknown file is not found; a removed one keeps the question and says so, because
 * an action re-renders this page and its rejection must stay.
 */
export default async function RemoveFilePage({
  params,
  searchParams,
}: PageProps<"/team/dateien/[fileId]/details/entfernen">) {
  const viewer = await requireTechnician();
  const { fileId } = await params;
  const file = await loadRemoveFile(database(), fileId, { params: await searchParams, viewer });
  if (!file) notFound();
  const refusal = removeFileRefusal({ removed: file.removed }, viewer);
  return (
    <RemoveFileView
      file={file}
      action={removeFileAction.bind(null, originValue(file.origin), file.id)}
      refusal={refusal && commandErrorText(teamMessages, refusal)}
    />
  );
}
