import { and, eq, isNull, ne } from "drizzle-orm";
import type { Database } from "@/platform/command";
import type { VisitorLocale } from "@/platform/messages";
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

/**
 * RM-WelcomePage (ST-101, ST-102): the museum name, whether there is a logo – never its content reference: visitors get
 * it through `/logo` –, and, if the museum settings list them, the machines on display.
 */
export type WelcomePage = {
  museumName: string;
  /**
   * Whether there is a logo, as the logo's version (HS-16) – undefined without one. The page asks `/logo?v=<version>`, so
   * a browser that keeps the sending-on for 60 seconds never follows a kept one to a replaced logo's deleted content.
   */
  logoVersion: number | undefined;
  machinesOnDisplay: MachinesOnDisplayGroup[];
};

/**
 * RM-WelcomePage (ST-101) – computed on every request, so a change is visible at the next page load. Machines on display
 * are the registered machines that are not retired and not Not on display, grouped by their machine model's machine
 * category in CONTEXT.md's order, a group only when it has a machine; within a group alphabetical by machine model title
 * in the visitor's language, ignoring case, then by location (its numbers as numbers – „Halle 2“ before „Halle 10“) and museum number.
 */
export async function welcomePage(db: Database, locale: VisitorLocale): Promise<WelcomePage> {
  const settings = await museumSettings(db);
  const { museumName, machinesListed } = settings;
  const logoVersion = settings.logo ? settings.logoVersion : undefined;
  if (!machinesListed) return { museumName, logoVersion, machinesOnDisplay: [] };
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
  const words = new Intl.Collator(locale, { sensitivity: "base" });
  const numbers = new Intl.Collator(locale, { numeric: true });
  const locations = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const ordered = rows.sort(
    (a, b) =>
      words.compare(a.machineModelTitle, b.machineModelTitle) ||
      locations.compare(a.location, b.location) ||
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
  return { museumName, logoVersion, machinesOnDisplay };
}
