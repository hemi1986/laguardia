import type { Decision } from "@/platform/command";
import type { Machine } from "./register-machine";

/**
 * CMD-MoveMachine (AGG-Machine, ST-034): a team member gives a machine its new location. Any team member – the
 * location is informational (HS-18).
 */

/** Who may move a machine – the allowed actors of CMD-MoveMachine. */
export const movingActors = ["helper", "technician"] as const;

/** What the acting person gave (ST-073, Q19): the location as it was typed. */
export type MoveMachineInput = {
  machineId: string;
  /** The version of the machine the acting person saw (HS-16). */
  version: number;
  location: string;
};

export type MachineMoved = {
  type: "EVT-MachineMoved";
  machineId: string;
  location: string;
};

export type MoveMachineError = "machine-retired" | "location-required" | "location-unchanged";

export function moveMachine(
  machine: Machine,
  input: MoveMachineInput,
): Decision<Machine, MachineMoved, MoveMachineError> {
  // A retired machine is final (AGG-Machine).
  if (machine.retirement) return { ok: false, error: "machine-retired" };
  const location = input.location.trim();
  if (!location) return { ok: false, error: "location-required" };
  // No change without a change, as with the machine status (user, 2026-10-18).
  if (location === machine.location) return { ok: false, error: "location-unchanged" };
  return {
    ok: true,
    state: { ...machine, location },
    events: [{ type: "EVT-MachineMoved", machineId: machine.id, location }],
  };
}
