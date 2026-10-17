import { activeTeamMemberRole } from "@/modules/team";
import { aggregateCommand, type Database } from "@/platform/command";
import {
  claimDefect,
  claimingActors,
  type ClaimDefectInput,
  type ClaimingFacts,
} from "./claim-defect";
import { defects } from "./defects";
import { repairEvents } from "./events";

/**
 * The facts of an assignment (ST-026): the role of the team member the defect is assigned to, as Team knows it now –
 * read in the command's transaction, without a lock (context map: Team → all contexts). Nothing is read for a claim of
 * one's own.
 */
async function claimingFacts(tx: Database, input: ClaimDefectInput): Promise<ClaimingFacts> {
  if (!input.assignTo) return { assignee: undefined };
  const role = await activeTeamMemberRole(tx, input.assignTo);
  return { assignee: role && { role } };
}

/**
 * CMD-ClaimDefect through the command layer: a change of AGG-Defect at the version the team member saw – of two
 * concurrent claims the second is rejected as a conflict, not silently turned into a takeover (ST-003) – emits
 * EVT-DefectClaimed.
 */
export const claimDefectCommand = aggregateCommand({
  id: "CMD-ClaimDefect",
  allowedActors: claimingActors,
  store: defects,
  target: (input) => ({ id: input.defectId, version: input.version }),
  facts: claimingFacts,
  decide: claimDefect,
  journal: repairEvents.journal,
  result: (defect) => ({ defectId: defect.id }),
});

