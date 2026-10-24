import Link from "next/link";
import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { recordMaintenanceAction } from "./actions";
import { loadMaintenanceForRecording } from "./record-maintenance-data";
import { RecordMaintenancePage } from "./record-maintenance-view";
import { recordMaintenanceReturnOf } from "./record-maintenance-address";

const { recordMaintenance: texts } = teamMessages;

/**
 * „Wartung erfassen“ (ST-044) – reached from a machine of the due maintenance list (`?task=<id>&machine=<museum
 * number>`) or from the machine record (`&von=geraet`, ST-047); every team member, the command decides who may record
 * what where.
 */
export default async function RecordMaintenanceRoute({ searchParams }: PageProps<"/team/maintenance/erfassen">) {
  const member = await requireTeamMember();
  const { task, machine, von } = await searchParams;
  // Opened from the machine record (ST-047) or the due maintenance list – a fixed choice, never an address.
  const back = recordMaintenanceReturnOf(von);
  const data =
    typeof task === "string" && typeof machine === "string"
      ? await loadMaintenanceForRecording(database(), systemClock, task, machine, member)
      : undefined;

  return (
    <Page title={data ? texts.title(data.machine.museumNumber) : texts.record}>
      {data ? (
        <RecordMaintenancePage
          data={data}
          back={back}
          action={recordMaintenanceAction.bind(null, typeof von === "string" ? von : undefined)}
        />
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
