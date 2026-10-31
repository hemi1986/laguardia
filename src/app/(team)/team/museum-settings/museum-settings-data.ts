import { logoChangedBy, museumSettings, type MuseumSettings } from "@/modules/collection";
import { photoViewAddresses } from "@/photo";
import { systemClock, type Clock } from "@/platform/clock";
import type { Database, TeamMemberId } from "@/platform/command";
import { s3Storage, type ContentStorage } from "@/platform/storage";

/** Which form of the museum settings was just saved – „Museum“ (ST-100), „Logo“ (ST-102) and „Rechtstexte“ (ST-103). */
export type SavedSection = "museum" | "logo" | "legal-texts";

/** Where a saved form of the museum settings lands (G3) – what the page reads back as `saved`. */
export function savedLanding(section: SavedSection): string {
  return `/team/museum-settings?saved=${section}`;
}

/** The form „Logo“ as the page shows it (ST-102): the current logo's view address, and the change to confirm. */
export type LogoSection = {
  /** A view address of the current logo, valid 5 minutes – none without a logo, or when the store cannot sign. */
  address: string | undefined;
  hasLogo: boolean;
  version: number;
  /** Confirmed only when the latest change of the logo is the viewer's own (G3). */
  confirmed: "replaced" | "removed" | undefined;
};

export type MuseumSettingsData = {
  settings: MuseumSettings;
  /** „Museum“ or „Rechtstexte“ just saved – confirmed without the journal (see below). */
  saved: "museum" | "legal-texts" | undefined;
  logo: LogoSection;
};

/**
 * The museum settings page's data (ST-100, ST-102): what is stored now, and which form was just saved (`?saved=`).
 *
 * „Museum“ and „Rechtstexte“ (ST-103) are **an exception of the confirmation rule (G3)**, like `?machinesChanged=`: saving
 * without a change records no event and still lands like a save (HS-27, G33), so there is nothing to ask the journal. „Logo“ follows the rule: every
 * upload or removal records an event, so `?saved=logo` is confirmed only when the latest change of the logo is the
 * viewer's own – „Logo gespeichert.“ or „Logo entfernt.“ by what that change was.
 */
export async function loadMuseumSettings(
  db: Database,
  params: Record<string, string | string[] | undefined>,
  {
    viewer,
    storage = s3Storage(),
    clock = systemClock,
  }: { viewer?: TeamMemberId; storage?: ContentStorage; clock?: Clock } = {},
): Promise<MuseumSettingsData> {
  const settings = await museumSettings(db);
  const [addresses, confirmed] = await Promise.all([
    settings.logo ? photoViewAddresses(storage, clock, [settings.logo]) : new Map<string, string>(),
    params.saved === "logo" && viewer ? logoChangedBy(db, viewer) : undefined,
  ]);
  return {
    settings,
    saved: params.saved === "museum" || params.saved === "legal-texts" ? params.saved : undefined,
    logo: {
      address: settings.logo ? addresses.get(settings.logo) : undefined,
      hasLogo: !!settings.logo,
      version: settings.logoVersion,
      confirmed,
    },
  };
}
