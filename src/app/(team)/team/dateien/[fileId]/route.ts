import { notFound } from "next/navigation";
import { fileToOpen } from "@/modules/collection";
import { systemClock } from "@/platform/clock";
import { isId } from "@/platform/command";
import { database } from "@/platform/database";
import { blobStorage } from "@/platform/storage";
import { viewAddressOf } from "@/upload";
import { requireTeamMember } from "../../../../team-session";

/**
 * The address of a file (ST-037): files are team-only, so this checks the team session itself – someone not logged in
 * is sent to the login page and gets nothing – and only then sends the browser on to a presigned address valid for 5
 * minutes from now (ADR 0006). So the link on the machine record never expires, and every other format than PDF and
 * images is downloaded, never opened.
 */
export async function GET(_request: Request, { params }: RouteContext<"/team/dateien/[fileId]">) {
  await requireTeamMember();
  const { fileId } = await params;
  const found = isId(fileId) ? await fileToOpen(database(), fileId) : undefined;
  if (!found) notFound();
  const address = await viewAddressOf(blobStorage(), systemClock, found.content, { download: found.download });
  if (!address) notFound();
  return new Response(null, { status: 303, headers: { Location: address, "Cache-Control": "private, no-store" } });
}
