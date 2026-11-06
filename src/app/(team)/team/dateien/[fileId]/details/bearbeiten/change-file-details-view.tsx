import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { fileCategories } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import type { ChangeFileDetailsData } from "./change-file-details-data";
import { ChangeFileDetailsForm } from "./change-file-details-form-view";
import type { ChangeFileDetailsState } from "./change-file-details-form";

/**
 * The page „Datei bearbeiten“ (CMD-ChangeFileDetails, ST-116): headed with the file (G34), the form with the current
 * values, and „Zurück zur Datei“ with the origin kept (G17).
 */
export function ChangeFileDetailsView({
  file,
  action,
}: {
  file: ChangeFileDetailsData;
  /** „Datei speichern“'s Server Action, the file and the origin already bound. */
  action: (previous: ChangeFileDetailsState, formData: FormData) => Promise<ChangeFileDetailsState>;
}) {
  return (
    <Page title={teamMessages.changeFileDetails.pageTitle(file.title)}>
      <ChangeFileDetailsForm file={file} fileCategories={fileCategories} action={action} />
      <BackLink href={file.back}>{teamMessages.fileDetails.backToFile}</BackLink>
    </Page>
  );
}
