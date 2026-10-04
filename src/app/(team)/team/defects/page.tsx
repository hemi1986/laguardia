import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { loadOpenDefects, openDefectsFilterOf } from "./open-defects-data";
import { OpenDefectsView } from "./open-defects";

/** The open defects list (RM-OpenDefects, ST-021) – every team member. How long a defect is open is computed now. */
export default async function OpenDefectsPage({ searchParams }: PageProps<"/team/defects">) {
  await requireTeamMember();
  const data = await loadOpenDefects(database(), systemClock, openDefectsFilterOf(await searchParams));

  return (
    <Page title={teamMessages.defects.title} wide>
      <OpenDefectsView data={data} />
    </Page>
  );
}
