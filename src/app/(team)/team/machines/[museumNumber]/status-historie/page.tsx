import { redirect } from "next/navigation";
import { Page } from "@/components/page";
import { machineOfMuseumNumber } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { loadStatusHistory } from "./status-history-data";
import { StatusHistoryView } from "./status-history";

/**
 * The whole status history of one machine (ST-093) – reached from section 6 of its machine record. Every team member;
 * a reserved museum number redirects to the current one, as the machine record does (ST-035).
 */
export default async function StatusHistoryPage({
  params,
}: PageProps<"/team/machines/[museumNumber]/status-historie">) {
  await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const data = await loadStatusHistory(database(), museumNumber);
  if (!data) {
    const machine = await machineOfMuseumNumber(database(), museumNumber);
    if (machine && machine.museumNumber !== museumNumber) {
      redirect(`/team/machines/${encodeURIComponent(machine.museumNumber)}/status-historie`);
    }
  }

  return (
    <Page title={data ? data.title : teamMessages.terms.Machine}>
      <StatusHistoryView data={data} museumNumber={museumNumber} />
    </Page>
  );
}
