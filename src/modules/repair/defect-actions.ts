import { journalOf, type Database, type Role, type TeamMemberId } from "@/platform/command";
import { claimRefusal, type ClaimDefectError } from "./claim-defect";
import type { Defect } from "./defect";
import { logWorkRefusal, type LogWorkError } from "./log-work";
import { resolveRefusal, type ResolveDefectError } from "./resolve-defect";

/**
 * What a team member can do to a defect – one entry per command on AGG-Defect, in the order its page offers them
 * (G21). A new command on a defect adds its action here, its refusal below and its event to `actionOfEvent`; the
 * defect's page and the form pages read the answer and carry no rule of their own (G11).
 */
export const defectActions = ["claim", "log-work", "resolve"] as const;
export type DefectAction = (typeof defectActions)[number];

/** Per action: why the command would refuse this team member on the defect as it is – undefined when it would not. */
export type DefectActionRefusals = {
  claim: ClaimDefectError | undefined;
  "log-work": Exclude<LogWorkError, "what-was-done-required"> | undefined;
  resolve: Exclude<ResolveDefectError, "closing-note-required"> | undefined;
};

/** The team member a page asks for – the acting person of the commands, without the session. */
export type DefectTeamMember = { teamMemberId: TeamMemberId; role: Role };

/** Each command's own rule, asked for one team member – the decisions apply the same functions. */
export function defectActionRefusals(
  defect: Pick<Defect, "state" | "suitableForHelpers" | "claim">,
  teamMember: DefectTeamMember,
): DefectActionRefusals {
  return {
    claim: claimRefusal(defect, teamMember),
    "log-work": logWorkRefusal(defect),
    resolve: resolveRefusal(defect, teamMember),
  };
}

const actionOfEvent: Record<string, DefectAction> = {
  "EVT-DefectClaimed": "claim",
  "EVT-WorkLogged": "log-work",
  "EVT-DefectResolved": "resolve",
};

/**
 * What this team member just did to the defect – the action of the defect's latest event, if it is theirs; undefined
 * when someone else acted last, or nobody did. For the confirmation after an action (G3): the address alone cannot make
 * a page confirm anything. The journal is read for this one answer, never to rebuild state (ADR 0002). After a claim it
 * names whom the defect was taken over from, if anyone.
 */
export async function lastDefectActionBy(
  db: Database,
  defectId: string,
  teamMemberId: string,
): Promise<{ action: DefectAction; takenOverFrom: string | undefined } | undefined> {
  const latest = (await journalOf(db, { aggregateId: defectId })).at(-1);
  if (!latest || latest.actor.kind !== "team-member" || latest.actor.teamMemberId !== teamMemberId) return undefined;
  const action = actionOfEvent[latest.type];
  if (!action) return undefined;
  const takenOverFrom = action === "claim" ? latest.data.takenOverFrom : undefined;
  return { action, takenOverFrom: typeof takenOverFrom === "string" ? takenOverFrom : undefined };
}
