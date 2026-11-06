import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "@/app/team-session";
import { addFileAction } from "./actions";
import { loadAddFileForm } from "./add-file-data";
import { AddFileFormView } from "./add-file-form-view";

/**
 * „Datei hinzufügen“ (CMD-AddFile, ST-119, G2a): its own form page, reached from the heading of „Dateien“. For the whole
 * team; the file may be attached to machines and machine models at once, or to nothing yet.
 */
export default async function AddFilePage() {
  await requireTeamMember();
  const form = await loadAddFileForm(database());
  return (
    <Page title={teamMessages.addFileToOverview.title}>
      <AddFileFormView
        action={addFileAction}
        fileCategories={form.fileCategories}
        machineGroups={form.machineGroups}
        machineModelGroups={form.machineModelGroups}
        texts={{ ...teamMessages.addFileToOverview.form, fileCategories: teamMessages.fileCategories }}
      />
      <BackLink href={form.back}>{teamMessages.addFileToOverview.back}</BackLink>
    </Page>
  );
}
