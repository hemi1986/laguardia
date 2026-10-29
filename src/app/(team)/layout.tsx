import { cookies } from "next/headers";
import { DESIGN_COOKIE, deviceDesign } from "../design";
import { requireTeamMember } from "../team-session";
import { TeamNavigation } from "./navigation";

/** Every page in (team) requires login (ST-004). Pages check again themselves – layouts don't re-run on navigation. */
export default async function TeamLayout({ children }: LayoutProps<"/">) {
  const member = await requireTeamMember();
  const design = deviceDesign((await cookies()).get(DESIGN_COOKIE)?.value) ?? "dark";
  return (
    <>
      <TeamNavigation role={member.role} design={design} />
      {children}
    </>
  );
}
