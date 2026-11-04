import { notFound, redirect } from "next/navigation";
import { fileDetailsAddress } from "@/app/(team)/team/dateien/[fileId]/details/file-origin";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";
import { isId } from "@/platform/command";
import { requireTeamMember } from "../../../../../../team-session";

/**
 * The former address of the removal question (ST-038) now leads to the file details (ST-121), where the file is removed.
 * It keeps bookmarks and pages left open working; the `datei-entfernen` page itself is gone. The origin is the machine,
 * so the details' way back leads there.
 */
export default async function FormerRemoveFilePage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/datei-entfernen/[fileId]">) {
  await requireTeamMember();
  const { fileId } = await params;
  if (!isId(fileId)) notFound();
  const museumNumber = await museumNumberOfPage({ params, searchParams }, teamMachinePage(`datei-entfernen/${fileId}`));
  redirect(fileDetailsAddress(fileId, { machine: museumNumber }));
}
