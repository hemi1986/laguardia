import { requireTeamMember } from "../team-session";

/** Every page in (team) requires login (ST-004). Pages check again themselves – layouts don't re-run on navigation. */
export default async function TeamLayout({ children }: LayoutProps<"/">) {
  await requireTeamMember();
  return children;
}
