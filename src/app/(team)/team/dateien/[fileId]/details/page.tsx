import { notFound } from "next/navigation";
import { fileForRemoval } from "@/modules/collection";
import { database } from "@/platform/database";
import { isId } from "@/platform/command";
import { requireTeamMember } from "@/app/team-session";
import { detachFileFromDetailsAction, retryFileFromDetailsAction } from "./actions";
import { loadFileDetails } from "./file-details-data";
import { FileDetailsView } from "./file-details-view";
import { FileRemovedView } from "./file-removed-view";
import { originOf, originValue, wayBack } from "../../file-navigation";

/**
 * One file's details (ST-114, G18): what it is, what it is attached to and how far the AI index got – for the whole team.
 * `/team/dateien/<id>` opens the file (ST-037), so the details live below it. A removed or unknown file is not found; the
 * origin in the address – a closed set, G17 – only decides the way back and what „Erneut versuchen“ hands on. Opening the
 * page starts no AI work, and it does not refresh itself (user, 2026-11-02, G35 as narrowed). A detach that met a file
 * removed meanwhile lands here with `?detachFailed=file-removed`: the removed file has no details, but its rejection is
 * shown with a way back (ST-115).
 */
export default async function FileDetailsPage({ params, searchParams }: PageProps<"/team/dateien/[fileId]/details">) {
  const viewer = await requireTeamMember();
  const { fileId } = await params;
  const search = await searchParams;
  const file = await loadFileDetails(database(), fileId, { params: search, viewer });
  if (!file) {
    if (
      search.detachFailed === "file-removed" &&
      isId(fileId) &&
      (await fileForRemoval(database(), fileId)) !== undefined
    ) {
      const origin = await originOf(database(), search.from, viewer);
      return <FileRemovedView back={wayBack(origin)} />;
    }
    notFound();
  }
  return (
    <FileDetailsView
      file={file}
      retry={retryFileFromDetailsAction.bind(null, originValue(file.origin))}
      detach={detachFileFromDetailsAction.bind(null, file.id, originValue(file.origin))}
    />
  );
}
