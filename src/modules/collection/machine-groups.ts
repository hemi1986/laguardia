import { machineCategories, technologiesOf, type MachineCategory, type Technology } from "./create-machine-model";

/** A group of machines of one machine category and technology – the technology none for a category without one. */
export type MachineGroup<Machine> = {
  machineCategory: MachineCategory;
  technology: Technology | undefined;
  /** Ordered by museum number. */
  machines: Machine[];
};

/**
 * Machines grouped for a choice (UX guideline G27, user 2026-10-25): by machine category and technology, in the order of
 * CONTEXT.md – Pinball (EM, Solid-state, DMD, LCD, without technology), Arcade (CRT, LCD, without technology), Other –,
 * the machines of a group by museum number. A group without a machine is not there. Maintenance asks it for the machines
 * of a task; the machines of other pages follow (ST-095 to ST-098).
 */
export function groupMachines<Machine extends { museumNumber: string; machineCategory: MachineCategory; technology?: Technology }>(
  machines: readonly Machine[],
): MachineGroup<Machine>[] {
  const groups: MachineGroup<Machine>[] = [];
  for (const machineCategory of machineCategories) {
    for (const technology of [...technologiesOf(machineCategory), undefined]) {
      const members = machines
        .filter((machine) => machine.machineCategory === machineCategory && machine.technology === technology)
        .sort((a, b) => a.museumNumber.localeCompare(b.museumNumber, "de", { numeric: true }));
      if (members.length > 0) groups.push({ machineCategory, technology, machines: members });
    }
  }
  return groups;
}
