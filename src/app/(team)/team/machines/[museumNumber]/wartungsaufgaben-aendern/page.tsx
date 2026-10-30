import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../team-session";
import { loadChangeTasks } from "./change-tasks-data";
import { ChangeTasksForm } from "./change-tasks-form";

const { machineRecord, changeTasks: texts } = teamMessages;

/**
 * Changing the maintenance tasks of one machine (ST-096) – reached by „Wartungsaufgaben ändern“ at the end of section 5 of
 * its machine record; a page with nothing but its form, headed „Wartungsaufgaben ändern · LG-042“ (G34). Technicians only
 * (G11). A retired machine's maintenance can no longer change, so its page shows no form.
 */
export default async function ChangeTasksPage({
  params,
}: PageProps<"/team/machines/[museumNumber]/wartungsaufgaben-aendern">) {
  await requireTechnician();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const { machine, groups, chosen } = await loadChangeTasks(database(), museumNumber);

  return (
    <Page title={machine ? texts.title(machine.museumNumber) : texts.open}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : machine.retired ? (
        <p>{texts.retired}</p>
      ) : (
        <ChangeTasksForm machineId={machine.id} groups={groups} chosen={chosen} />
      )}
      <BackLink href={`/team/machines/${encodeURIComponent(museumNumber)}`}>{texts.back}</BackLink>
    </Page>
  );
}
