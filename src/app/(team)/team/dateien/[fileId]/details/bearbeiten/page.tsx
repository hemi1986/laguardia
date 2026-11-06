import { notFound } from "next/navigation";
import { database } from "@/platform/database";
import { requireTeamMember } from "@/app/team-session";
import { originValue } from "../../../file-navigation";
import { changeFileDetailsAction } from "./actions";
import { loadChangeFileDetails } from "./change-file-details-data";
import { ChangeFileDetailsView } from "./change-file-details-view";

/**
 * Correcting a file's title and file category (CMD-ChangeFileDetails, ST-116): its own form page, reached from „Datei
 * bearbeiten“ in the head of the file details. Every team member. An unknown file is not found; a removed one says that
 * it is gone.
 */
export default async function ChangeFileDetailsPage({
  params,
  searchParams,
}: PageProps<"/team/dateien/[fileId]/details/bearbeiten">) {
  const viewer = await requireTeamMember();
  const { fileId } = await params;
  const file = await loadChangeFileDetails(database(), fileId, { params: await searchParams, viewer });
  if (!file) notFound();
  return (
    <ChangeFileDetailsView file={file} action={changeFileDetailsAction.bind(null, file.id, originValue(file.origin))} />
  );
}
