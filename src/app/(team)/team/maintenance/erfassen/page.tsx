import Link from "next/link";
import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { recordMaintenanceAction } from "./actions";
import { loadMaintenanceForRecording } from "./record-maintenance-data";
import { RecordMaintenancePage } from "./record-maintenance-view";

const { recordMaintenance: texts } = teamMessages;

/**
 * „Wartung erfassen“ (ST-044) – reached from a machine of the due maintenance list (`?task=<id>&machine=<museum
 * number>`); every team member, the command decides who may record what where.
 */
export default async function RecordMaintenanceRoute({ searchParams }: PageProps<"/team/maintenance/erfassen">) {
  const member = await requireTeamMember();
  const { task, machine } = await searchParams;
  const data =
    typeof task === "string" && typeof machine === "string"
      ? await loadMaintenanceForRecording(database(), systemClock, task, machine, member)
      : undefined;

  return (
    <Page title={data ? texts.title(data.machine.museumNumber) : texts.record}>
      {data ? (
        <RecordMaintenancePage data={data} action={recordMaintenanceAction} />
      ) : (
        <>
          <p>{texts.unknown}</p>
          <Link href="/team/maintenance" className="self-start text-sm underline underline-offset-4">
            {texts.back}
          </Link>
        </>
      )}
    </Page>
  );
}
