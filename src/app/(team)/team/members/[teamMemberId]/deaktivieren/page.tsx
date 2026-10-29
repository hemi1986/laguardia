import { redirect } from "next/navigation";
import { requireTechnician } from "../../../../../team-session";

/**
 * The old address of ST-081's question before deactivating. Deactivating is one tap on the team member's page since
 * ST-088 (G28, G10a), so the address leads there and deactivates nothing.
 */
export default async function FormerDeactivationQuestionPage({
  params,
}: PageProps<"/team/members/[teamMemberId]/deaktivieren">) {
  await requireTechnician();
  const { teamMemberId } = await params;
  redirect(`/team/members/${encodeURIComponent(teamMemberId)}`);
}
