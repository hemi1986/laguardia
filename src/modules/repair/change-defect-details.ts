import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import type { Defect } from "./defect";

/**
 * CMD-ChangeDefectDetails (AGG-Defect, ST-031): a technician changes the title or the suitable-for-helpers mark of an
 * open defect, so that visitors see an understandable title and helpers get the defects they can handle once more is
 * known (HS-18).
 */

/** Who may change a defect's details – technicians only (HS-18). */
export const changingDetailsActors = ["technician"] as const;

type ChangingDetailsPerson = ActorOf<(typeof changingDetailsActors)[number]>;

export type ChangeDefectDetailsInput = {
  defectId: string;
  /** The version of the defect the technician saw (HS-16). */
  version: number;
  title: string;
  suitableForHelpers: boolean;
};

/** The details of a defect a technician can change. */
export type DefectDetail = "title" | "suitable-for-helpers";

export type DefectDetailsChanged = {
  type: "EVT-DefectDetailsChanged";
  defectId: string;
  machineId: string;
  /** Which details changed – so the journal can say so without repeating the title (story review 2026-10-17). */
  changed: DefectDetail[];
  /** Typed text: in the aggregate, never in the journal (ST-003). */
  title: string;
  suitableForHelpers: boolean;
  changedBy: TeamMemberId;
};

export type ChangeDefectDetailsError = never;

export function changeDefectDetails(
  defect: Defect,
  input: ChangeDefectDetailsInput,
  { actor }: DecisionContext<ChangingDetailsPerson>,
): Decision<Defect, DefectDetailsChanged, ChangeDefectDetailsError> {
  const title = input.title.trim();
  const changed: DefectDetail[] = [
    ...(title !== defect.title ? (["title"] as const) : []),
    ...(input.suitableForHelpers !== defect.suitableForHelpers ? (["suitable-for-helpers"] as const) : []),
  ];
  return {
    ok: true,
    state: { ...defect, title, suitableForHelpers: input.suitableForHelpers },
    events: [
      {
        type: "EVT-DefectDetailsChanged",
        defectId: defect.id,
        machineId: defect.machineId,
        changed,
        title,
        suitableForHelpers: input.suitableForHelpers,
        changedBy: actor.teamMemberId,
      },
    ],
  };
}
