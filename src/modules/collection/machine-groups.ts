import { machineCategories, technologiesOf, type MachineCategory, type Technology } from "./create-machine-model";

/** A group of machines of one machine category and technology – the technology none for a category without one. */
export type MachineGroup<Machine> = {
  machineCategory: MachineCategory;
  technology: Technology | undefined;
  /** Ordered by museum number. */
  machines: Machine[];
};

/** A group of machine models of one machine category and technology (ST-115) – the technology none for a category without one. */
export type MachineModelGroup<Model> = {
  machineCategory: MachineCategory;
  technology: Technology | undefined;
  /** Ordered by title. */
  machineModels: Model[];
};

/**
 * Machines grouped for a choice (UX guideline G27, user 2026-10-25): by machine category and technology, in the order of
 * CONTEXT.md – Pinball (EM, Solid-state, DMD, LCD, without technology), Arcade (CRT, LCD, without technology), Other –,
 * the machines of a group by museum number. A group without a machine is not there. Maintenance asks it for the machines
 * of a task; the machines of other pages follow (ST-095 to ST-098).
 */
export function groupMachines<
  Machine extends { museumNumber: string; machineCategory: MachineCategory; technology?: Technology },
>(machines: readonly Machine[]): MachineGroup<Machine>[] {
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

/**
 * Machine models grouped for a choice (ST-115, G27): by machine category and technology, in the order of CONTEXT.md, the
 * models of a group by title. A group without a model is not there.
 */
export function groupMachineModels<
  Model extends { title: string; machineCategory: MachineCategory; technology?: Technology },
>(models: readonly Model[]): MachineModelGroup<Model>[] {
  const groups: MachineModelGroup<Model>[] = [];
  for (const machineCategory of machineCategories) {
    for (const technology of [...technologiesOf(machineCategory), undefined]) {
      const members = models
        .filter((model) => model.machineCategory === machineCategory && model.technology === technology)
        .sort((a, b) => a.title.localeCompare(b.title, "de"));
      if (members.length > 0) groups.push({ machineCategory, technology, machineModels: members });
    }
  }
  return groups;
}
