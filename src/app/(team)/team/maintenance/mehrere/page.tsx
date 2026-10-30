import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { maintenanceForSeveral } from "@/modules/maintenance";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { recordForSeveralAction } from "./actions";
import { RecordForSeveralPage } from "./record-for-several-view";

const { recordForSeveral: texts, recordMaintenance } = teamMessages;

/**
 * „Für mehrere Geräte erfassen“ (ST-045) – reached from a maintenance task of the due maintenance list (`?task=<id>`);
 * every team member, the command decides who may record what where.
 */
export default async function RecordForSeveralRoute({ searchParams }: PageProps<"/team/maintenance/mehrere">) {
  const member = await requireTeamMember();
  const { task } = await searchParams;
  const data =
    typeof task === "string" ? await maintenanceForSeveral(database(), systemClock, task, member) : undefined;

  return (
    <Page title={data ? texts.title(data.maintenanceTask.name) : recordMaintenance.record}>
      {data ? (
        <RecordForSeveralPage data={data} action={recordForSeveralAction} />
      ) : (
        <>
          <p>{texts.unknown}</p>
          <BackLink href="/team/maintenance">{recordMaintenance.back}</BackLink>
        </>
      )}
    </Page>
  );
}
