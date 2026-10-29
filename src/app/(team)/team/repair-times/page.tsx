import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { RepairTimesView } from "./repair-times";
import { loadRepairTimes } from "./repair-times-data";

/** The repair times (ST-051) – technicians only, behind „Mehr“ right after „Wartungsplan“ (G19). */
export default async function RepairTimesPage({ searchParams }: PageProps<"/team/repair-times">) {
  await requireTechnician();
  const data = await loadRepairTimes(database(), systemClock, await searchParams);

  return (
    <Page title={teamMessages.terms["Repair times"]}>
      <RepairTimesView {...data} />
    </Page>
  );
}
