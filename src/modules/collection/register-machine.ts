import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";

/**
 * CMD-RegisterMachine (AGG-Machine): a technician registers a machine with its machine model, museum number,
 * location and machine status. The pure decision of a creating command; what it must know about the other machines
 * (the museum numbers given out so far, HS-17) and the machine model comes in as its facts.
 */

/** The machine statuses (CONTEXT.md), in the order a choice offers them – Playable first, preselected (user 2026-10-01). */
export const machineStatuses = ["playable", "limited", "out-of-order", "not-on-display"] as const;
export type MachineStatus = (typeof machineStatuses)[number];

/** Who may register a machine – the allowed actors of CMD-RegisterMachine. */
export const registeringActors = ["technician"] as const;

type RegisteringPerson = ActorOf<(typeof registeringActors)[number]>;

/** One entry of a machine's status history; the first one is the machine status given at registration. */
export type StatusChange = {
  previousStatus: MachineStatus | undefined;
  newStatus: MachineStatus;
  /** Free text – except for the first entry, whose reason is "registration" (data model). */
  reason: string;
  changedBy: TeamMemberId;
  changedAt: Date;
};

/** AGG-Machine – current state (docs/architecture/data-model.md). */
export type Machine = {
  id: string;
  museumNumber: string;
  machineModelId: string;
  serialNumber?: string;
  location: string;
  machineStatus: MachineStatus;
  registeredAt: Date;
  statusHistory: StatusChange[];
  retirement?: { reason: string; retiredBy: TeamMemberId; retiredAt: Date };
};

export type MachineRegistered = {
  type: "EVT-MachineRegistered";
  machineId: string;
  machineModelId: string;
  museumNumber: string;
  serialNumber?: string;
  location: string;
  machineStatus: MachineStatus;
};

/**
 * What the acting person gave (ST-073, Q19): a missing machine model, museum number, serial number or machine status
 * is "no value given"; the location arrives as it was typed.
 */
export type RegisterMachineInput = {
  machineModelId: string | undefined;
  museumNumber: string | undefined;
  serialNumber: string | undefined;
  location: string;
  machineStatus: MachineStatus | undefined;
};

/** What the decision knows about the other machines and the machine model – read in the command's transaction. */
export type RegistrationFacts = {
  /** Every museum number given out so far: in use, of retired machines and reserved (D11) – never reused. */
  museumNumbersGivenOut: readonly string[];
  machineModelExists: boolean;
};

export type RegisterMachineError =
  | "machine-model-required"
  | "location-required"
  | "machine-status-required"
  | "museum-number-format"
  | "museum-number-taken"
  | "no-museum-number-free";

export function registerMachine(
  facts: RegistrationFacts,
  input: RegisterMachineInput,
  { actor, clock, newId }: DecisionContext<RegisteringPerson>,
): Decision<Machine, MachineRegistered, RegisterMachineError> {
  if (!input.machineModelId || !facts.machineModelExists) return { ok: false, error: "machine-model-required" };
  const location = input.location.trim();
  if (!location) return { ok: false, error: "location-required" };
  const { machineStatus } = input;
  if (!machineStatus) return { ok: false, error: "machine-status-required" };

  const givenOut = new Set(facts.museumNumbersGivenOut);
  const typed = input.museumNumber?.trim() ?? "";
  let museumNumber: string;
  if (typed) {
    if (!MUSEUM_NUMBER.test(typed)) return { ok: false, error: "museum-number-format" };
    if (givenOut.has(typed)) return { ok: false, error: "museum-number-taken" };
    museumNumber = typed;
  } else {
    const assigned = nextMuseumNumber(givenOut);
    if (!assigned) return { ok: false, error: "no-museum-number-free" };
    museumNumber = assigned;
  }

  const now = clock.now();
  const serialNumber = input.serialNumber?.trim() || undefined;
  const machine: Machine = {
    id: newId(),
    museumNumber,
    machineModelId: input.machineModelId,
    serialNumber,
    location,
    machineStatus,
    registeredAt: now,
    statusHistory: [
      {
        previousStatus: undefined,
        newStatus: machineStatus,
        reason: "registration",
        changedBy: actor.teamMemberId,
        changedAt: now,
      },
    ],
  };
  return {
    ok: true,
    state: machine,
    events: [
      {
        type: "EVT-MachineRegistered",
        machineId: machine.id,
        machineModelId: machine.machineModelId,
        museumNumber,
        serialNumber,
        location,
        machineStatus,
      },
    ],
  };
}

/** "LG-" plus three digits (user 2026-09-26) – the format La Guardia assigns and the stickers print. */
const MUSEUM_NUMBER = /^LG-\d{3}$/;
const HIGHEST = 999;

/**
 * The museum number La Guardia assigns (HS-19, D11): the next one above the highest given out so far; after LG-999
 * the next free one below it, counting down (user 2026-10-01). Undefined when LG-001 to LG-999 are all given out.
 */
function nextMuseumNumber(givenOut: ReadonlySet<string>): string | undefined {
  const numbers = [...givenOut].map((museumNumber) => Number(museumNumber.slice(3)));
  const highest = Math.max(0, ...numbers);
  if (highest < HIGHEST) return museumNumberOf(highest + 1);
  for (let number = HIGHEST - 1; number >= 1; number--) {
    if (!givenOut.has(museumNumberOf(number))) return museumNumberOf(number);
  }
  return undefined;
}

function museumNumberOf(number: number): string {
  return `LG-${String(number).padStart(3, "0")}`;
}
