import { aggregateCommand } from "@/platform/command";
import { changeDefectDetails, changingDetailsActors } from "./change-defect-details";
import { defects } from "./defects";
import { repairEvents } from "./events";

/**
 * CMD-ChangeDefectDetails through the command layer: a change of AGG-Defect at the version the technician saw, emits
 * EVT-DefectDetailsChanged. Which details changed and the mark go into the journal, the title stays in the aggregate;
 * who changed them is the acting person of the journal entry.
 */
export const changeDefectDetailsCommand = aggregateCommand({
  id: "CMD-ChangeDefectDetails",
  allowedActors: changingDetailsActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  decide: changeDefectDetails,
  journal: repairEvents.journal,
  result: (defect) => ({ defectId: defect.id }),
});
