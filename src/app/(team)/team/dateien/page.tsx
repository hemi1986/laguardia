import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { FileOverviewView } from "./file-overview";
import { loadFileOverview } from "./file-overview-data";

/**
 * „Dateien“ (RM-FileOverview, ST-117, G19 row 8a): finding a file – every file that is not removed, also one attached to
 * nothing, narrowed by the filters in the address and paged (G40). For the whole team.
 */
export default async function FileOverviewPage({ searchParams }: PageProps<"/team/dateien">) {
  const viewer = await requireTeamMember();
  const overview = await loadFileOverview(database(), { params: await searchParams, viewer });
  return (
    <Page title={teamMessages.fileOverview.title}>
      <FileOverviewView overview={overview} />
    </Page>
  );
}
