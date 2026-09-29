import Link from "next/link";
import { pageWidth } from "@/components/page";
import { Button } from "@/components/ui/button";
import type { Role } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { logOutAction } from "./team/actions";

const { team } = teamMessages;

/**
 * The one navigation of the team area (ST-076), rendered by the `(team)` layout for every team page – so no page
 * builds its own links and every page can be left again. "Teammitglieder" is shown to technicians only; the
 * pages and the Team module check the role again themselves (ADR 0004).
 */
export function TeamNavigation({ role }: { role: Role }) {
  return (
    <nav aria-label={team.menu} className="border-b">
      <div className={`${pageWidth} flex flex-wrap items-center gap-x-4 gap-y-2`}>
        <Link href="/team" className="text-sm font-medium underline-offset-4 hover:underline">
          {team.home}
        </Link>
        {role === "technician" && (
          <Link href="/team/members" className="text-sm font-medium underline-offset-4 hover:underline">
            {team.accounts}
          </Link>
        )}
        <Link href="/team/password" className="text-sm font-medium underline-offset-4 hover:underline">
          {team.ownPassword}
        </Link>
        <form action={logOutAction} className="ms-auto">
          <Button type="submit" variant="outline" size="sm">
            {team.logout}
          </Button>
        </form>
      </div>
    </nav>
  );
}
