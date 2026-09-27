import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../team-session";
import { logOutAction } from "./actions";

const { team, terms } = teamMessages;

/** Team start page – the dashboards (ST-048 ff.) replace it. */
export default async function TeamStartPage() {
  const member = await requireTeamMember();
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{team.start}</h1>
      <p>
        {team.loggedInAs} {member.name} ({member.role === "technician" ? terms.Technician : terms.Helper})
      </p>
      <form action={logOutAction}>
        <button type="submit" className="border p-2">
          {team.logout}
        </button>
      </form>
    </main>
  );
}
