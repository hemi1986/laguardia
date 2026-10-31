import { and, eq, isNull, ne } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { machineCategories, type MachineCategory } from "./create-machine-model";
import { museumSettings } from "./museum-settings";
import type { MachineStatus } from "./register-machine";
import { machine, machineModel } from "./schema";

/** A machine on display as the welcome page lists it (G5: no museum number shown – it is only for the address). */
export type MachineOnDisplay = {
  /** Only for the address of its visitor machine page, `/m/<museum number>`. */
  museumNumber: string;
  machineModelTitle: string;
  location: string;
  /** Named only when the problem may already be known (G6) – Playable machines say nothing. */
  machineStatus?: Extract<MachineStatus, "out-of-order" | "limited">;
};

/** The machines on display of one machine category – never empty. */
export type MachinesOnDisplayGroup = { machineCategory: MachineCategory; machines: MachineOnDisplay[] };

/** RM-WelcomePage (ST-101): the museum name and, if the museum settings list them, the machines on display. */
export type WelcomePage = { museumName: string; machinesOnDisplay: MachinesOnDisplayGroup[] };

/**
 * RM-WelcomePage (ST-101) – computed on every request, so a change is visible at the next page load. Machines on display
 * are the registered machines that are not retired and not Not on display, grouped by their machine model's machine
 * category in CONTEXT.md's order, a group only when it has a machine; within a group alphabetical by machine model title
 * in the visitor's language, ignoring case, then by location and museum number.
 */
export async function welcomePage(db: Database, language: "de" | "en"): Promise<WelcomePage> {
  const { museumName, machinesListed } = await museumSettings(db);
  if (!machinesListed) return { museumName, machinesOnDisplay: [] };
  const rows = await db
    .select({
      museumNumber: machine.museumNumber,
      machineModelTitle: machineModel.title,
      machineCategory: machineModel.machineCategory,
      location: machine.location,
      machineStatus: machine.machineStatus,
    })
    .from(machine)
    .innerJoin(machineModel, eq(machine.machineModelId, machineModel.id))
    .where(and(isNull(machine.retiredAt), ne(machine.machineStatus, "not-on-display")));
  const words = new Intl.Collator(language, { sensitivity: "base" });
  const numbers = new Intl.Collator(language, { numeric: true });
  const ordered = rows.sort(
    (a, b) =>
      words.compare(a.machineModelTitle, b.machineModelTitle) ||
      words.compare(a.location, b.location) ||
      numbers.compare(a.museumNumber, b.museumNumber),
  );
  const machinesOnDisplay = machineCategories
    .map((machineCategory) => ({
      machineCategory,
      machines: ordered
        .filter((row) => row.machineCategory === machineCategory)
        .map(({ machineStatus, museumNumber, machineModelTitle, location }): MachineOnDisplay => ({
          museumNumber,
          machineModelTitle,
          location,
          ...(machineStatus === "out-of-order" || machineStatus === "limited" ? { machineStatus } : {}),
        })),
    }))
    .filter((group) => group.machines.length > 0);
  return { museumName, machinesOnDisplay };
}
