import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { loadRepairHistory } from "./repair-history-data";
import { RepairHistoryView } from "./repair-history";

/**
 * The repair history of one machine (ST-033) – reached from section 7 of its machine record. Every team member sees
 * it; the year is chosen in the address (`?jahr=2026`), so the page works without JavaScript.
 */
export default async function RepairHistoryPage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/reparaturhistorie">) {
  await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const { jahr } = await searchParams;
  const data = await loadRepairHistory(database(), museumNumber, typeof jahr === "string" ? jahr : undefined);

  return (
    <Page title={data ? teamMessages.repairHistory.title(museumNumber) : teamMessages.terms.Machine}>
      <RepairHistoryView data={data} museumNumber={museumNumber} />
    </Page>
  );
}
