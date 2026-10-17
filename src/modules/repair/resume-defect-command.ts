import { aggregateCommand } from "@/platform/command";
import { defects } from "./defects";
import { repairEvents } from "./events";
import { resumeDefect, resumingActors } from "./resume-defect";

/**
 * CMD-ResumeDefect through the command layer: a change of AGG-Defect at the version the team member saw (ST-003),
 * emits EVT-DefectResumed.
 */
export const resumeDefectCommand = aggregateCommand({
  id: "CMD-ResumeDefect",
  allowedActors: resumingActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  decide: resumeDefect,
  journal: repairEvents.journal,
  result: (defect) => ({ defectId: defect.id }),
});
