import type { ActorOf, Decision, DecisionContext, Role } from "@/platform/command";
import { museumNumberRefusal } from "./museum-numbers";
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

/** What the decision must know about the other machines: every museum number given out (HS-17, D11). */
export type CorrectionFacts = { museumNumbersGivenOut: readonly string[] };

export type CorrectMachineDetailsError =
  | "not-authorized"
  | "machine-retired"
  | "machine-details-unchanged"
  | "museum-number-format"
  | "museum-number-taken";

/**
 * Why a team member may not correct a machine's details – technicians only, never a retired machine. Asked by the
 * decision and by the machine record, which offers the action only when there is no reason (G11).
 */
export function correctDetailsRefusal(
  machine: { retired: boolean },
  teamMember: { role: Role },
): "not-authorized" | "machine-retired" | undefined {
  if (!correctingActors.some((actor) => actor === teamMember.role)) return "not-authorized";
  // A retired machine is final (AGG-Machine).
  return machine.retired ? "machine-retired" : undefined;
}

export function correctMachineDetails(
  machine: Machine,
  input: CorrectMachineDetailsInput,
  { actor }: DecisionContext<ActorOf<(typeof correctingActors)[number]>>,
  facts: CorrectionFacts,
): Decision<Machine, MachineDetailsCorrected, CorrectMachineDetailsError> {
  const refusal = correctDetailsRefusal({ retired: machine.retirement !== undefined }, actor);
  if (refusal) return { ok: false, error: refusal };
  const museumNumber = input.museumNumber.trim();
  const serialNumber = input.serialNumber.trim() || undefined;
  // No change without a change, as with the location (ST-034).
  if (museumNumber === machine.museumNumber && serialNumber === machine.serialNumber) {
    return { ok: false, error: "machine-details-unchanged" };
  }
  // Unique among all museum numbers ever given out – retired machines' and reserved ones included (D11).
  const numberRefusal =
    museumNumber === machine.museumNumber ? undefined : museumNumberRefusal(museumNumber, facts.museumNumbersGivenOut);
  if (numberRefusal) return { ok: false, error: numberRefusal };
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
