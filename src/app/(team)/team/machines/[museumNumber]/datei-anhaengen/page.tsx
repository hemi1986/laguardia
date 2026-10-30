import { Page } from "@/components/page";
import { attachTargets, fileCategories, machineRecord } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { attachFileAction } from "./actions";
import { AttachFileForm } from "./attach-file-form-view";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";
import { BackToMachine } from "../machine-history";

const { machineRecord: recordTexts, attachFile: texts } = teamMessages;

/**
 * Attaching a file (ST-037) – its own page, reached from the machine record's files section (G21). Every team
 * member; also for a retired machine, whose manuals stay useful (user, 2026-10-18).
 */
export default async function AttachFilePage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/datei-anhaengen">) {
  await requireTeamMember();
  const museumNumber = await museumNumberOfPage({ params, searchParams }, teamMachinePage("datei-anhaengen"));
  const record = await machineRecord(database(), museumNumber);

  return (
    <Page title={texts.title(museumNumber)}>
      {record ? (
        <AttachFileForm
          action={attachFileAction.bind(null, { id: record.id, museumNumber: record.museumNumber })}
          machineId={record.id}
          museumNumber={record.museumNumber}
          machineModel={record.machineModel.title}
          fileCategories={fileCategories}
          attachTargets={attachTargets}
          texts={{ ...texts.form, fileCategories: teamMessages.fileCategories }}
        />
      ) : (
        <p>{recordTexts.unknown(museumNumber)}</p>
      )}
      <BackToMachine museumNumber={museumNumber} />
    </Page>
  );
}
