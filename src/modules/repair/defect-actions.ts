import { journalOf, type Database, type Role, type TeamMemberId } from "@/platform/command";
import { assignRefusal, claimRefusal } from "./claim-defect";
import type { Defect } from "./defect";
import { logWorkRefusal, type LogWorkError } from "./log-work";
import { prioritizeRefusal } from "./prioritize-defect";
import { releaseRefusal, type ReleaseClaimError } from "./release-claim";
import { resolveRefusal, type ResolveDefectError } from "./resolve-defect";

/**
 * What a team member can do to a defect – one entry per action on AGG-Defect, in the order its page offers them
 * (G22): the work first – claiming it or, in the same place, releasing its claim –, then what manages it (assigning,
 * ST-026; CMD-ClaimDefect for someone else) and changing its priority (ST-027). A new command on a defect adds its action here, its refusal below and its event to `actionOfEvent`; the
 * defect's page and the form pages read the answer and carry no rule of their own (G11).
 */
export const defectActions = ["claim", "release", "log-work", "resolve", "assign", "prioritize"] as const;
export type DefectAction = (typeof defectActions)[number];

/** Per action: why the command would refuse this team member on the defect as it is – undefined when it would not. */
export type DefectActionRefusals = {
  claim: ReturnType<typeof claimRefusal>;
  release: ReleaseClaimError | undefined;
  "log-work": Exclude<LogWorkError, "what-was-done-required"> | undefined;
  resolve: Exclude<ResolveDefectError, "closing-note-required"> | undefined;
  /** Whether they may assign it at all – whom to is asked per team member (`assigneeRefusal`). */
  assign: ReturnType<typeof assignRefusal>;
  /** Whether they may change its priority at all – to which one is the form's choice. */
  prioritize: ReturnType<typeof prioritizeRefusal>;
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
    release: releaseRefusal(defect, teamMember),
    "log-work": logWorkRefusal(defect),
    resolve: resolveRefusal(defect, teamMember),
    assign: assignRefusal(defect, teamMember),
    prioritize: prioritizeRefusal(defect, teamMember),
  };
}

const actionOfEvent: Record<string, DefectAction> = {
  "EVT-DefectClaimed": "claim",
  "EVT-DefectClaimReleased": "release",
  "EVT-WorkLogged": "log-work",
  "EVT-DefectResolved": "resolve",
  "EVT-DefectPrioritized": "prioritize",
};

/**
 * What this team member just did to the defect – the action of the defect's latest event, if it is theirs; undefined
 * when someone else acted last, or nobody did. For the confirmation after an action (G3): the address alone cannot make
 * a page confirm anything. The journal is read for this one answer, never to rebuild state (ADR 0002). After a claim it
 * names whom the defect was taken over from, if anyone; a claim made for someone else is an assignment, and names whom
 * the defect was assigned to (ST-026).
 */
export async function lastDefectActionBy(
  db: Database,
  defectId: string,
  teamMemberId: string,
): Promise<{ action: DefectAction; takenOverFrom: string | undefined; assignedTo: string | undefined } | undefined> {
  const latest = (await journalOf(db, { aggregateId: defectId })).at(-1);
  if (!latest || latest.actor.kind !== "team-member" || latest.actor.teamMemberId !== teamMemberId) return undefined;
  const event = actionOfEvent[latest.type];
  if (!event) return undefined;
  const reference = (name: string) => (typeof latest.data[name] === "string" ? latest.data[name] : undefined);
  if (event !== "claim") return { action: event, takenOverFrom: undefined, assignedTo: undefined };
  const assigned = reference("assignedBy") !== undefined;
  return {
    action: assigned ? "assign" : "claim",
    takenOverFrom: reference("takenOverFrom"),
    assignedTo: assigned ? reference("claimedBy") : undefined,
  };
}
