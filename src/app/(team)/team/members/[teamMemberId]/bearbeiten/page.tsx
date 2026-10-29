import { teamMemberAccount } from "@/modules/team";
import { isId } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../team-session";
import { EditAccountView } from "./edit-account-view";

/** The account edit page (ST-088, G28): one form for name, username, role and a new password. Technicians only. */
export default async function EditAccountPage({ params }: PageProps<"/team/members/[teamMemberId]/bearbeiten">) {
  const viewer = await requireTechnician();
  const { teamMemberId } = await params;
  const account = isId(teamMemberId) ? await teamMemberAccount(database(), teamMemberId, viewer.id) : undefined;
  return <EditAccountView account={account} />;
}
