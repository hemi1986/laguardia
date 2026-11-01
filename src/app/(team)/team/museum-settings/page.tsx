import { Page } from "@/components/page";
import { startAiWorkWhenLeftUnfinished } from "@/app/ai-work";
import { FILE_INDEXING_KIND } from "@/modules/ai-assistance";
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
 * Opened with AI on, it starts a run of the AI work after its response when a file's indexing was left unfinished
 * (HS-35, ST-109) – never otherwise, so opening it does not start work on every load; the file shows as failed
 * (*broken off*) on the next load.
 */
export default async function SettingsPage({ searchParams }: PageProps<"/team/museum-settings">) {
  const technician = await requireTechnician();
  const params = await searchParams;
  const db = database();
  const [museum, ai] = await Promise.all([
    loadMuseumSettings(db, params, { viewer: technician.id }),
    loadAiSettings(db, params, { viewer: technician.id }),
  ]);

  if (ai.overview) await startAiWorkWhenLeftUnfinished(FILE_INDEXING_KIND);

  return (
    <Page title={teamMessages.terms.Settings}>
      <MuseumSettingsView {...museum} />
      <AiSettingsSection {...ai} />
    </Page>
  );
}
