import { entriesOf, lastCommandBy, type Database, type Role, type TeamMemberId } from "@/platform/command";
import { changeDetailsRefusal } from "./change-defect-details";
import { assignRefusal, claimRefusal } from "./claim-defect";
import type { Defect } from "./defect";
import { repairEvents } from "./events";
import { logWorkRefusal, type LogWorkError } from "./log-work";
import { prioritizeRefusal } from "./prioritize-defect";
import { putOnHoldRefusal } from "./put-defect-on-hold";
import { releaseRefusal, type ReleaseClaimError } from "./release-claim";
import { reopenRefusal, type ReopeningFacts } from "./reopen-defect";
import { resolveRefusal, type ResolveDefectError } from "./resolve-defect";
import { resumeRefusal } from "./resume-defect";

/**
 * What a team member can do to a defect – one entry per action on AGG-Defect, in the order its page offers them
 * (G22): the work first – claiming it or, in the same place, releasing its claim –, then what manages it (assigning,
 * ST-026; CMD-ClaimDefect for someone else), changing its priority (ST-027) and its title or suitable-for-helpers
 * mark (ST-031). A new command on a defect adds its action here, its refusal below, its event to `actionOfEvent` and its journal projection to `repairEvents` (`./events.ts`); the
 * defect's page and the form pages read the answer and carry no rule of their own (G11).
 */
export const defectActions = [
  "claim",
  "release",
  "log-work",
  "put-on-hold",
  "resume",
  "resolve",
  "reopen",
  "assign",
  "prioritize",
  "change-details",
] as const;
export type DefectAction = (typeof defectActions)[number];

/** Per action: why the command would refuse this team member on the defect as it is – undefined when it would not. */
export type DefectActionRefusals = {
  claim: ReturnType<typeof claimRefusal>;
  release: ReleaseClaimError | undefined;
  "log-work": Exclude<LogWorkError, "what-was-done-required"> | undefined;
  /** Whether they may put it on hold at all – with which reason is the form's choice (ST-029). */
  "put-on-hold": ReturnType<typeof putOnHoldRefusal>;
  resume: ReturnType<typeof resumeRefusal>;
  resolve: Exclude<ResolveDefectError, "closing-note-required"> | undefined;
  /** Whether it can be reopened – its machine being retired included, when the asker knows the machine. */
  reopen: ReturnType<typeof reopenRefusal>;
  /** Whether they may assign it at all – whom to is asked per team member (`assigneeRefusal`). */
  assign: ReturnType<typeof assignRefusal>;
  /** Whether they may change its priority at all – to which one is the form's choice. */
  prioritize: ReturnType<typeof prioritizeRefusal>;
  /** Whether they may change its title or mark at all – to what is the form's. */
  "change-details": ReturnType<typeof changeDetailsRefusal>;
};

/** The team member a page asks for – the acting person of the commands, without the session. */
export type DefectTeamMember = { teamMemberId: TeamMemberId; role: Role };

/** Each command's own rule, asked for one team member – the decisions apply the same functions. */
export function defectActionRefusals(
  defect: Pick<Defect, "state" | "suitableForHelpers" | "claim" | "hold">,
  teamMember: DefectTeamMember,
  reopening?: ReopeningFacts,
): DefectActionRefusals {
  return {
    claim: claimRefusal(defect, teamMember),
    release: releaseRefusal(defect, teamMember),
    "log-work": logWorkRefusal(defect),
    "put-on-hold": putOnHoldRefusal(defect, teamMember),
    resume: resumeRefusal(defect, teamMember),
    resolve: resolveRefusal(defect, teamMember),
    reopen: reopenRefusal(defect, reopening),
    assign: assignRefusal(defect, teamMember),
    prioritize: prioritizeRefusal(defect, teamMember),
    "change-details": changeDetailsRefusal(defect, teamMember),
  };
}

const actionOfEvent = {
  "EVT-DefectClaimed": "claim",
  "EVT-DefectClaimReleased": "release",
  "EVT-WorkLogged": "log-work",
  "EVT-DefectPutOnHold": "put-on-hold",
  "EVT-DefectResumed": "resume",
  "EVT-DefectResolved": "resolve",
  "EVT-DefectReopened": "reopen",
  "EVT-DefectPrioritized": "prioritize",
  "EVT-DefectDetailsChanged": "change-details",
} as const satisfies Partial<Record<keyof typeof repairEvents.entries, DefectAction>>;

/**
 * What this team member just did to the defect – the action of the defect's latest event, if it is theirs; undefined
 * when someone else acted last, or nobody did. For the confirmation after an action (G3): the address alone cannot make
 * a page confirm anything. The journal is read for this one answer, never to rebuild state (ADR 0002). After a claim it
 * names whom the defect was taken over from, if anyone; a claim made for someone else is an assignment, and names whom
 * the defect was assigned to (ST-026). After a change of its details it names which changed and whose claim that
 * released, if anyone's (ST-031).
 */
export type LastDefectAction = {
  action: DefectAction;
  takenOverFrom: string | undefined;
  assignedTo: string | undefined;
  /** Only after a change of its details: which changed, and whose claim it released (ST-031). */
  changedDetails?: { title: boolean; suitableForHelpers: boolean; releasedClaimOf: string | undefined };
};

export async function lastDefectActionBy(
  db: Database,
  defectId: string,
  teamMemberId: string,
): Promise<LastDefectAction | undefined> {
  // The same rule as every confirmation (G3): the latest command on the defect, run by this team member.
  const command = await lastCommandBy(db, { aggregateId: defectId }, teamMemberId);
  const types = Object.keys(actionOfEvent) as (keyof typeof actionOfEvent)[];
  const latest =
    command &&
    entriesOf(repairEvents, command)
      .filter((entry) => entry.aggregate.id === defectId && types.some((type) => type === entry.type))
      .at(-1);
  if (!latest) return undefined;
  if (latest.type === "EVT-DefectDetailsChanged") {
    return {
      action: "change-details",
      takenOverFrom: undefined,
      assignedTo: undefined,
      changedDetails: {
        title: latest.data.titleChanged === true,
        suitableForHelpers: latest.data.suitableForHelpersChanged === true,
        releasedClaimOf: latest.data.releasedClaimOf,
      },
    };
  }
  if (latest.type !== "EVT-DefectClaimed") {
    return {
      action: actionOfEvent[latest.type as keyof typeof actionOfEvent],
      takenOverFrom: undefined,
      assignedTo: undefined,
    };
  }
  const assigned = latest.data.assignedBy !== undefined;
  return {
    action: assigned ? "assign" : "claim",
    takenOverFrom: latest.data.takenOverFrom,
    assignedTo: assigned ? latest.data.claimedBy : undefined,
  };
}
