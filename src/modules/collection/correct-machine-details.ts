import type { Decision } from "@/platform/command";
import type { Machine } from "./register-machine";

/**
 * CMD-CorrectMachineDetails (AGG-Machine, ST-035): a technician corrects a mistyped museum number or the serial
 * number of a machine (HS-18). Technicians only.
 */

/** Who may correct a machine's details – the allowed actors of CMD-CorrectMachineDetails. */
export const correctingActors = ["technician"] as const;

/** What the acting person gave (ST-073, Q19): both fields as they were typed – the form is filled in with both. */
export type CorrectMachineDetailsInput = {
  machineId: string;
  /** The version of the machine the acting person saw (HS-16). */
  version: number;
  museumNumber: string;
  /** Empty: the machine has no serial number (user, 2026-10-25 – a mistyped one may be removed). */
  serialNumber: string;
};

export type MachineDetailsCorrected = {
  type: "EVT-MachineDetailsCorrected";
  machineId: string;
  museumNumber: string;
  /** The museum number it had before – the same when only the serial number was corrected. */
  previousMuseumNumber: string;
  serialNumber?: string;
};

export type CorrectMachineDetailsError = "machine-retired" | "machine-details-unchanged";

export function correctMachineDetails(
  machine: Machine,
  input: CorrectMachineDetailsInput,
): Decision<Machine, MachineDetailsCorrected, CorrectMachineDetailsError> {
  // A retired machine is final (AGG-Machine).
  if (machine.retirement) return { ok: false, error: "machine-retired" };
  const museumNumber = input.museumNumber.trim();
  const serialNumber = input.serialNumber.trim() || undefined;
  // No change without a change, as with the location (ST-034).
  if (museumNumber === machine.museumNumber && serialNumber === machine.serialNumber) {
    return { ok: false, error: "machine-details-unchanged" };
  }
  return {
    ok: true,
    state: { ...machine, museumNumber, serialNumber },
    events: [
      {
        type: "EVT-MachineDetailsCorrected",
        machineId: machine.id,
        museumNumber,
        previousMuseumNumber: machine.museumNumber,
        serialNumber,
      },
    ],
  };
}
