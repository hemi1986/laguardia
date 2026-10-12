import { activeTeamMemberRole } from "@/modules/team";
import { aggregateCommand, journalOf, type Database } from "@/platform/command";
import {
  claimDefect,
  claimingActors,
  type ClaimDefectInput,
  type ClaimingFacts,
  type DefectClaimed,
} from "./claim-defect";
import { defects } from "./defects";

/**
 * EVT-DefectClaimed in the journal: references only. Whom the defect was taken over from is kept nowhere else – the
 * Claim value object holds who claims it now (events.yaml, data model) – so `takenOverFrom` below reads it back here.
 */
function journalDefectClaimed(event: DefectClaimed) {
  return {
    type: event.type,
    aggregate: { type: "AGG-Defect", id: event.defectId },
    machineId: event.machineId,
    data: {
      claimedBy: event.claimedBy,
      ...(event.takenOverFrom ? { takenOverFrom: event.takenOverFrom } : {}),
      ...(event.assignedBy ? { assignedBy: event.assignedBy } : {}),
    },
  } as const;
}

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
  journal: journalDefectClaimed,
  result: (defect) => ({ defectId: defect.id }),
});

/**
 * Whom the defect's claimant took it over from, if anyone – what the latest EVT-DefectClaimed says, the event that made
 * the claim as it is now. For the confirmation after taking over (G3); the journal is read for this one reference,
 * never to rebuild state (ADR 0002).
 */
export async function takenOverFrom(db: Database, defectId: string, claimedBy: string): Promise<string | undefined> {
  const claimed = (await journalOf(db, { aggregateId: defectId })).filter(
    (entry) => entry.type === "EVT-DefectClaimed",
  );
  const latest = claimed.at(-1)?.data;
  return latest?.claimedBy === claimedBy && typeof latest.takenOverFrom === "string" ? latest.takenOverFrom : undefined;
}
