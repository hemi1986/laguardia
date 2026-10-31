import { museumSettings, type MuseumSettings } from "@/modules/collection";
import type { Database } from "@/platform/command";

/** Which form of the museum settings was just saved – so far only „Museum“ (ST-100); the logo and the legal texts follow. */
export type SavedSection = "museum";

/** Where a saved form of the museum settings lands (G3) – what the page reads back as `saved`. */
export function savedLanding(section: SavedSection): string {
  return `/team/museum-settings?saved=${section}`;
}

export type MuseumSettingsData = { settings: MuseumSettings; saved: SavedSection | undefined };

/**
 * The museum settings page's data (ST-100): what is stored now, and which form was just saved (`?saved=museum`).
 *
 * **An exception of the confirmation rule (G3)**, like `?machinesChanged=`: saving without a change records no event
 * and still lands like a save (HS-27, G33), so there is nothing to ask the journal. „Museum gespeichert.“ says what is
 * true whoever opens the address – the page shows the values as they are stored.
 */
export async function loadMuseumSettings(
  db: Database,
  params: Record<string, string | string[] | undefined>,
): Promise<MuseumSettingsData> {
  return { settings: await museumSettings(db), saved: params.saved === "museum" ? "museum" : undefined };
}
