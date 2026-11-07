/**
 * The machine model form's own fields – creating, correcting (ST-036) and saving an AI model proposal (ST-128). Only the
 * names, free of module code, so a client form may import them.
 */
export const machineModelFields = ["title", "manufacturer", "year", "machineCategory", "technology"] as const;

export type MachineModelField = (typeof machineModelFields)[number];
