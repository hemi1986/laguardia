import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { loadAiSettings } from "./ai-settings-data";
import { AiSettingsSection } from "./ai-settings-section";
import { MuseumSettingsView } from "./museum-settings";
import { loadMuseumSettings } from "./museum-settings-data";

/**
 * „Einstellungen“ (ST-100, renamed in ST-104) – technicians only (G11, G19: behind „Mehr“ after „Teammitglieder“): the
 * museum settings' forms „Museum“, „Logo“, „Rechtstexte“ and, last, the AI settings' form „KI“, each saved on its own.
 */
export default async function SettingsPage({ searchParams }: PageProps<"/team/museum-settings">) {
  const technician = await requireTechnician();
  const params = await searchParams;
  const db = database();
  const [museum, ai] = await Promise.all([
    loadMuseumSettings(db, params, { viewer: technician.id }),
    loadAiSettings(db, params, { viewer: technician.id }),
  ]);

  return (
    <Page title={teamMessages.terms.Settings}>
      <MuseumSettingsView {...museum} />
      <AiSettingsSection {...ai} />
    </Page>
  );
}
