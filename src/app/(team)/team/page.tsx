import Link from "next/link";
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
      <nav className="flex flex-col gap-2">
        {member.role === "technician" && (
          <Link href="/team/members" className="underline">
            {team.accounts}
          </Link>
        )}
        <Link href="/team/password" className="underline">
          {team.ownPassword}
        </Link>
      </nav>
      <form action={logOutAction}>
        <button type="submit" className="border p-2">
          {team.logout}
        </button>
      </form>
    </main>
  );
}
