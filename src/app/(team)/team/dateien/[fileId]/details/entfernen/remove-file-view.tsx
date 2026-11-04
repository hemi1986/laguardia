import { Page } from "@/components/page";
import { teamMessages } from "@/platform/messages";
import { RemoveFileButton } from "./remove-file-button";
import type { RemoveFileData } from "./remove-file-data";
import type { RemoveFileState } from "./remove-file-form";

const { removeFile: texts, fileDetails } = teamMessages;

/**
 * The question before removing a file (CMD-RemoveFile, ST-121, G10b): the file by its title, that it is deleted for good,
 * and every machine and machine model it disappears from – in the wording of „Angehängt an“. „Endgültig entfernen“ is the
 * only red button (G30); „Zurück“ returns to the file details unchanged.
 */
export function RemoveFileView({
  file,
  action,
  refusal,
}: {
  file: RemoveFileData;
  /** „Endgültig entfernen“'s Server Action, the origin already bound. */
  action: (previous: RemoveFileState, formData: FormData) => Promise<RemoveFileState>;
  /** Why the file cannot be removed now, in words – the page's answer (G11). */
  refusal?: string;
}) {
  return (
    <Page title={texts.title(file.title)}>
      <p className="font-medium [overflow-wrap:anywhere]">{texts.question(file.title)}</p>
      {file.attachedTo.length > 0 && (
        <div className="flex flex-col gap-1">
          <p>{texts.disappearsFrom}</p>
          <ul className="flex flex-col gap-1 text-sm [overflow-wrap:anywhere]">
            {file.attachedTo.map((target) => (
              <li key={target.kind === "machine" ? target.machineId : target.machineModelId}>
                {target.kind === "machine"
                  ? target.retired
                    ? fileDetails.retiredMachine(target.museumNumber)
                    : fileDetails.machine(target.museumNumber, target.machineModelTitle)
                  : fileDetails.machineModel(target.title)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <RemoveFileButton action={action} version={file.version} refusal={refusal} back={file.back} />
    </Page>
  );
}
