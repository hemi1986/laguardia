import { machineLabels } from "@/modules/collection";
import { teamMemberNames } from "@/modules/team";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";

/** How a page names a machine – its museum number and its machine model's title (Collection's `machineLabels`). */
export type MachineLabel = { museumNumber: string; machineModelTitle: string };

/** The names and labels of what a page shows, looked up once. */
export type Named = {
  /** A team member's name – „unbekannt“ for an account that is gone. */
  name(teamMemberId: string): string;
  /** A machine's label. Read models only return registered machines (foreign keys), so a missing one is a bug. */
  label(machineId: string): MachineLabel;
};

/** The IDs a part of a page refers to – missing ones are left out. */
export type References = {
  teamMembers?: Iterable<string | null | undefined>;
  machines?: Iterable<string | null | undefined>;
};

/**
 * Names the team members and machines a page's read models return by ID (architecture review 2026-10-25): Team's
 * `teamMemberNames` and Collection's `machineLabels` in one round for all the parts of the page, each ID once – the
 * page composes (ST-009), with one rule for every page.
 */
export async function named(db: Database, ...parts: References[]): Promise<Named> {
  const present = (ids: (part: References) => Iterable<string | null | undefined> | undefined) => [
    ...new Set(parts.flatMap((part) => [...(ids(part) ?? [])]).filter((id): id is string => !!id)),
  ];
  const [names, labels] = await Promise.all([
    teamMemberNames(
      db,
      present((part) => part.teamMembers),
    ),
    machineLabels(
      db,
      present((part) => part.machines),
    ),
  ]);
  return {
    name: (teamMemberId) => names.get(teamMemberId) ?? teamMessages.names.unknownTeamMember,
    label: (machineId) => {
      const label = labels.get(machineId);
      if (!label) throw new Error(`No machine ${machineId} to name`);
      return label;
    },
  };
}
