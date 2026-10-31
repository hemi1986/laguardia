import type { Decision } from "@/platform/command";

/**
 * CMD-ChangeMuseumDetails (AGG-MuseumSettings, ST-100): a technician changes the museum details – the museum name and
 * whether the machines on display are listed on the welcome page. The other two parts of the museum settings (logo,
 * legal texts) have their own commands and versions.
 */

/** The ID of the museum details – the one record, inserted with the defaults by the migration `museum_details`. */
export const MUSEUM_DETAILS_ID = "7a1e0f40-0000-4000-8000-000000000100";

/** Who may change the museum details – the allowed actors of CMD-ChangeMuseumDetails. */
export const museumDetailsActors = ["technician"] as const;

/** The museum details part of AGG-MuseumSettings. */
export type MuseumDetails = {
  id: string;
  /** Never empty (invariant). */
  museumName: string;
  /** Whether the machines on display are listed on the welcome page. */
  machinesListed: boolean;
};

/** What the technician gave (ST-073, Q19): the name as typed and the checkbox. */
export type ChangeMuseumDetailsInput = {
  /** The version of the museum details the technician saw (HS-16). */
  version: number;
  museumName: string;
  machinesListed: boolean;
};

/** Which of the museum details a change touched – the journal names them instead of the typed name. */
export type MuseumDetail = "museum-name" | "machines-listed";

export type MuseumDetailsChanged = {
  type: "EVT-MuseumDetailsChanged";
  museumDetailsId: string;
  changedDetails: MuseumDetail[];
  museumName: string;
  machinesListed: boolean;
};

export type ChangeMuseumDetailsError = "museum-name-required";

export function changeMuseumDetails(
  details: MuseumDetails,
  input: ChangeMuseumDetailsInput,
): Decision<MuseumDetails, MuseumDetailsChanged, ChangeMuseumDetailsError> {
  // A name of only spaces counts as empty (invariant: the museum name is never empty).
  const museumName = input.museumName.trim();
  if (!museumName) return { ok: false, error: "museum-name-required" };
  const changedDetails: MuseumDetail[] = [
    ...(museumName !== details.museumName ? (["museum-name"] as const) : []),
    ...(input.machinesListed !== details.machinesListed ? (["machines-listed"] as const) : []),
  ];
  // Saving without a change records nothing and is no rejection (HS-27).
  if (changedDetails.length === 0) return { ok: true, state: details, events: [] };
  return {
    ok: true,
    state: { ...details, museumName, machinesListed: input.machinesListed },
    events: [
      {
        type: "EVT-MuseumDetailsChanged",
        museumDetailsId: details.id,
        changedDetails,
        museumName,
        machinesListed: input.machinesListed,
      },
    ],
  };
}
