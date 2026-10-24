import Link from "next/link";
import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { recordForSeveralAction } from "./actions";
import { loadRecordForSeveral } from "./record-for-several-data";
import { RecordForSeveralPage } from "./record-for-several-view";

const { recordForSeveral: texts, recordMaintenance } = teamMessages;

/**
 * „Für mehrere Geräte erfassen“ (ST-045) – reached from a maintenance task of the due maintenance list (`?task=<id>`);
 * every team member, the command decides who may record what where.
 */
export default async function RecordForSeveralRoute({ searchParams }: PageProps<"/team/maintenance/mehrere">) {
  const member = await requireTeamMember();
  const { task } = await searchParams;
  const data = typeof task === "string" ? await loadRecordForSeveral(database(), systemClock, task, member) : undefined;

  return (
    <Page title={texts.title}>
      {data ? (
        <RecordForSeveralPage data={data} action={recordForSeveralAction} />
      ) : (
        <>
          <p>{texts.unknown}</p>
          <Link href="/team/maintenance" className="self-start text-sm underline underline-offset-4">
            {recordMaintenance.back}
          </Link>
        </>
      )}
    </Page>
  );
}
