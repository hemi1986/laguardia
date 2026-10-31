import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { MuseumSettingsView } from "./museum-settings";
import { loadMuseumSettings } from "./museum-settings-data";

/** The museum settings (ST-100) – technicians only (G11, G19: behind „Mehr“ after „Teammitglieder“). */
export default async function MuseumSettingsPage({ searchParams }: PageProps<"/team/museum-settings">) {
  await requireTechnician();
  const data = await loadMuseumSettings(database(), await searchParams);

  return (
    <Page title={teamMessages.terms["Museum settings"]}>
      <MuseumSettingsView {...data} />
    </Page>
  );
}
