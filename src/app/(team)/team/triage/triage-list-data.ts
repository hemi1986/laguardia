import { machineForTeamForm, machineLabels, type MachineStatus } from "@/modules/collection";
import { defectTitle, triageList, type TriageListEntry } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { photoViewAddresses } from "@/photo";
import { blobStorage, type ContentStorage } from "@/platform/storage";
import { photoAt, type PhotoSource } from "../problem-report-photo";
import { shownReporter, type ShownReporter } from "../reporter";

/** One entry of the triage list as the page shows it (RM-TriageList, ST-017). */
export type TriageListItem = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  description: string;
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
  const [machines, names, photos] = await Promise.all([
    machineLabels(
      db,
      entries.map((entry) => entry.machineId),
    ),
    teamMemberNames(
      db,
      entries.flatMap((entry) => (entry.reporter.kind === "team-member" ? [entry.reporter.teamMemberId] : [])),
    ),
    photoViewAddresses(
      storage,
      clock,
      entries.flatMap((entry) => (entry.photo ? [entry.photo] : [])),
    ),
  ]);
  return entries.map((entry) => ({
    id: entry.id,
    museumNumber: machines.get(entry.machineId)?.museumNumber ?? "",
    machineModelTitle: machines.get(entry.machineId)?.machineModelTitle ?? "",
    description: entry.description,
    reporter: shownReporter(entry.reporter, names),
    reportedAt: entry.reportedAt,
    photo: photoAt(photos, entry.photo),
    waitingHours: entry.waitingHours,
    waitingLong: entry.waitingLong,
  }));
}

/** What the confirmation after recording a defect names (ST-018, G3): the defect, its machine and its new status. */
export type DefectRecordedConfirmation = { title: string; museumNumber: string; newStatus?: MachineStatus };

/**
 * The confirmation after recording a defect, from the defect's ID in the address. The machine's status is read now –
 * only when the form changed it in the same step; the address cannot make the page say anything that is not stored.
 */
export async function loadDefectRecorded(
  db: Database,
  defectId: string,
  statusChanged: boolean,
): Promise<DefectRecordedConfirmation | undefined> {
  const recorded = await defectTitle(db, defectId);
  if (!recorded) return undefined;
  const museumNumber = (await machineLabels(db, [recorded.machineId])).get(recorded.machineId)?.museumNumber ?? "";
  const machine = statusChanged ? await machineForTeamForm(db, museumNumber) : undefined;
  return { title: recorded.title, museumNumber, newStatus: machine?.machineStatus };
}
