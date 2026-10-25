import { triageList, type TriageListEntry } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { photoViewAddresses } from "@/photo";
import { blobStorage, type ContentStorage } from "@/platform/storage";
import { named } from "../named";
import { photoAt, type PhotoSource } from "../team-photos";
import { shownReporter, type ShownReporter } from "../reporter";

/** One entry of the triage list as the page shows it (RM-TriageList, ST-017). */
export type TriageListItem = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  /** None only on a problem report dismissed as spam (ST-020) – shown on its own page, never in the list. */
  description: string | undefined;
  reporter: ShownReporter;
  reportedAt: Date;
  /** The photo (ST-016) at a short-lived address – issued only here, behind the team pages' access check (HS-1). */
  photo: { address: string } | undefined;
  waitingHours: number;
  waitingLong: boolean;
};

/**
 * The triage list's data: Repair's untriaged problem reports with Collection's museum numbers and titles and Team's
 * names – the page composes the modules' public queries (ST-009). Repair computes the waiting time when the page loads.
 */
export async function loadTriageList(
  db: Database,
  clock: Clock,
  { storage = blobStorage() }: PhotoSource = {},
): Promise<{ entries: TriageListItem[] }> {
  return { entries: await withNames(db, await triageList(db, clock), { clock, storage }) };
}

/**
 * Problem reports of the triage list with their machine's museum number and title, the reporter's name and the photo's
 * short-lived address.
 */
export async function withNames(
  db: Database,
  entries: TriageListEntry[],
  { clock, storage }: { clock: Clock; storage: ContentStorage },
): Promise<TriageListItem[]> {
  const [shown, photos] = await Promise.all([
    named(db, {
      machines: entries.map((entry) => entry.machineId),
      teamMembers: entries.map((entry) =>
        entry.reporter.kind === "team-member" ? entry.reporter.teamMemberId : undefined,
      ),
    }),
    photoViewAddresses(
      storage,
      clock,
      entries.flatMap((entry) => (entry.photo ? [entry.photo] : [])),
    ),
  ]);
  return entries.map((entry) => ({
    id: entry.id,
    ...shown.label(entry.machineId),
    description: entry.description,
    reporter: shownReporter(entry.reporter, shown),
    reportedAt: entry.reportedAt,
    photo: photoAt(photos, entry.photo),
    waitingHours: entry.waitingHours,
    waitingLong: entry.waitingLong,
  }));
}
