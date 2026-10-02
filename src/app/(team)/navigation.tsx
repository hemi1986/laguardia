import Link from "next/link";
import { widePageWidth } from "@/components/page";
import { Button } from "@/components/ui/button";
import type { Role } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { logOutAction } from "./team/actions";

const { team } = teamMessages;

const link = "text-sm font-medium underline-offset-4 hover:underline";

/**
 * The one navigation of the team area (ST-076), decided for the whole MVP in ST-008 (UX guideline G19, user
 * 2026-10-02): the daily destinations in one line – Übersicht, Geräte, Sichtung (technicians), Defekte, Wartung –,
 * everything that manages behind "Mehr" – Wartungsplan, Modelle, Teammitglieder (technicians), Passwort ändern,
 * Abmelden. A destination appears with the story that builds it (Sichtung ST-017, Defekte ST-021, Wartung ST-043,
 * Wartungsplan ST-040), at its place in this order. "Mehr" is a native `<details>`, so it opens without JavaScript.
 * Technician-only destinations are hidden from helpers; the pages and the modules check the role again (G11).
 */
export function TeamNavigation({ role }: { role: Role }) {
  const technician = role === "technician";
  return (
    <nav aria-label={team.menu} className="border-b">
      <div className={`${widePageWidth} flex flex-wrap items-center gap-x-4 gap-y-2`}>
        <Link href="/team" className={link}>
          {team.home}
        </Link>
        <Link href="/team/machines" className={link}>
          {team.machines}
        </Link>
        <details className="group relative ms-auto">
          <summary className={`${link} cursor-pointer list-none`}>
            {team.more} <span aria-hidden="true">▾</span>
          </summary>
          <ul className="bg-background absolute end-0 z-10 mt-2 flex min-w-48 flex-col gap-3 rounded-lg border p-3 shadow-sm">
            {technician && (
              <>
                <li>
                  <Link href="/team/machine-models" className={link}>
                    {team.machineModels}
                  </Link>
                </li>
                <li>
                  <Link href="/team/members" className={link}>
                    {team.accounts}
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link href="/team/password" className={link}>
                {team.ownPassword}
              </Link>
            </li>
            <li>
              <form action={logOutAction}>
                <Button type="submit" variant="outline" size="sm">
                  {team.logout}
                </Button>
              </form>
            </li>
          </ul>
        </details>
      </div>
    </nav>
  );
}
