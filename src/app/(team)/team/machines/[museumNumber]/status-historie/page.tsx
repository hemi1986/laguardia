import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { loadStatusHistory } from "./status-history-data";
import { StatusHistoryView } from "./status-history";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";

/**
 * The whole status history of one machine (ST-093) – reached from section 6 of its machine record. Every team member;
 * a reserved museum number redirects to the current one, as the machine record does (ST-035).
 */
export default async function StatusHistoryPage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/status-historie">) {
  await requireTeamMember();
  const museumNumber = await museumNumberOfPage({ params, searchParams }, teamMachinePage("status-historie"));
  const data = await loadStatusHistory(database(), museumNumber);

  return (
    <Page title={data ? data.title : teamMessages.terms.Machine}>
      <StatusHistoryView data={data} museumNumber={museumNumber} />
    </Page>
  );
}
