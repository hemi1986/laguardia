import { activeTeamMemberRole } from "@/modules/team";
import { aggregateCommand, readJournal, type Database } from "@/platform/command";
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

/**
 * Whom the defect's claimant took it over from, if anyone – what the latest EVT-DefectClaimed says, the event that made
 * the claim as it is now. For the confirmation after taking over (G3); the journal is read for this one reference,
 * never to rebuild state (ADR 0002).
 */
export async function takenOverFrom(db: Database, defectId: string, claimedBy: string): Promise<string | undefined> {
  const latest = (await readJournal(db, repairEvents, { types: ["EVT-DefectClaimed"], aggregateIds: [defectId] })).at(
    -1,
  )?.data;
  return latest?.claimedBy === claimedBy ? latest.takenOverFrom : undefined;
}
