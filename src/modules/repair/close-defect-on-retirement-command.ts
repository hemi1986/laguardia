import { aggregateCommand } from "@/platform/command";
import { closeDefectOnRetirement, closingOnRetirementActors } from "./close-defect-on-retirement";
import { defects } from "./defects";
import { repairEvents } from "./events";

/**
 * CMD-CloseDefectOnRetirement through the command layer: run as the system without a version – the defect is loaded
 * with a row lock (ADR 0010) –, emits EVT-DefectClosedOnRetirement.
 */
export const closeDefectOnRetirementCommand = aggregateCommand({
  id: "CMD-CloseDefectOnRetirement",
  allowedActors: closingOnRetirementActors,
  store: defects,
  target: (input) => ({ id: input.defectId }),
  decide: closeDefectOnRetirement,
  journal: repairEvents.journal,
  result: (defect) => ({ defectId: defect.id }),
});
