import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { machineFile, machineForTeamForm, removeFileRefusal } from "@/modules/collection";
import { isId } from "@/platform/command";
import { database } from "@/platform/database";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../../team-session";
import { removeFileAction } from "./actions";
import { RemoveFileButton } from "./remove-file-button";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";

const { removeFile: texts, machineRecord } = teamMessages;

/**
 * The question before removing a file (ST-038, G10, G10b): a page of its own, reached from the machine record's files
 * section, that names the file and what nobody sees from there – it is deleted for good. Technicians only (helpers are
 * sent away; the command refuses them anyway).
 */
export default async function RemoveFilePage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/datei-entfernen/[fileId]">) {
  const viewer = await requireTechnician();
  const { fileId } = await params;
  const museumNumber = await museumNumberOfPage(
    { params, searchParams },
    // The file ID comes from the address as it was – encoded already.
    teamMachinePage(`datei-entfernen/${fileId}`),
  );
  const db = database();
  const machine = await machineForTeamForm(db, museumNumber);
  const file = machine && isId(fileId) ? await machineFile(db, { fileId, machineId: machine.id }) : undefined;
  const refusal = file && removeFileRefusal(file, viewer);
  const back = `/team/machines/${encodeURIComponent(museumNumber)}`;

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : !file ? (
        <p>{texts.unknown(museumNumber)}</p>
      ) : (
        // Rendered for a removed file too: an action re-renders this page, and a rejection must stay and say so.
        <>
          <p className="font-medium [overflow-wrap:anywhere]">{texts.question(file.title, file.machineModel)}</p>
          <RemoveFileButton
            action={removeFileAction.bind(null, machine.museumNumber, file.id)}
            version={file.version}
            refusal={refusal && commandErrorText(teamMessages, refusal)}
            back={back}
          />
        </>
      )}
      {(!machine || !file) && <BackLink href={back}>{texts.backToMachine}</BackLink>}
    </Page>
  );
}
