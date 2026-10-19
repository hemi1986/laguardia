import {
  entriesOf,
  lastCommandBy,
  type CatalogueEntry,
  type Database,
  type Role,
  type TeamMemberId,
} from "@/platform/command";
import { changeDetailsRefusal } from "./change-defect-details";
import { assignRefusal, claimRefusal } from "./claim-defect";
import type { Defect } from "./defect";
import { repairEvents } from "./events";
import { logWorkRefusal } from "./log-work";
import { prioritizeRefusal } from "./prioritize-defect";
import { putOnHoldRefusal } from "./put-defect-on-hold";
import { releaseRefusal } from "./release-claim";
import { reopenRefusal, type ReopeningFacts } from "./reopen-defect";
import { resolveRefusal } from "./resolve-defect";
import { resumeRefusal } from "./resume-defect";

/** The team member a page asks for – the acting person of the commands, without the session. */
export type DefectTeamMember = { teamMemberId: TeamMemberId; role: Role };

/** The defect as the refusals read it. */
type AskedDefect = Pick<Defect, "state" | "suitableForHelpers" | "claim" | "hold">;

type RepairEntries = typeof repairEvents.entries;
type DefectEventType = keyof RepairEntries & string;

/** What a confirmation names besides the action – team members by ID; the page puts names to them. */
export type DefectActionDetails = {
  takenOverFrom: string | undefined;
  assignedTo: string | undefined;
  /** Only after a change of its details: which changed, and whose claim it released (ST-031). */
  changedDetails?: { title: boolean; suitableForHelpers: boolean; releasedClaimOf: string | undefined };
};

/**
 * One action on AGG-Defect, described once (architecture review 2026-10-18): its command's reason for refusing a team
 * member on the defect as it is (the decision applies the same function, G11), the event it ends in, and what its
 * confirmation names from that event's journal data – undefined when the event is not this action (a claim and an
 * assignment share EVT-DefectClaimed).
 */
type DefectActionDescription<Refusal, Type extends DefectEventType> = {
  refusal: (defect: AskedDefect, teamMember: DefectTeamMember, reopening: ReopeningFacts | undefined) => Refusal;
  event: Type;
  confirms: (data: CatalogueEntry<RepairEntries, Type>["data"]) => DefectActionDetails | undefined;
};

function described<Refusal, const Type extends DefectEventType>(
  description: DefectActionDescription<Refusal, Type>,
): DefectActionDescription<Refusal, Type> {
  return description;
}

const plain: DefectActionDetails = { takenOverFrom: undefined, assignedTo: undefined };

/**
 * What a team member can do to a defect – one entry per action, in the order its page offers them (G22): the work
 * first – claiming it or, in the same place, releasing its claim –, then what manages it (assigning, ST-026;
 * CMD-ClaimDefect for someone else), changing its priority (ST-027) and its title or suitable-for-helpers mark
 * (ST-031). **A new command on a defect** adds its entry here, its command in `defectActionCommands` and its journal
 * projection to `repairEvents` (`./events.ts`); the defect's page and the form pages read the answer and carry no rule
 * of their own (G11).
 */
const descriptions = {
  claim: described({
    refusal: (defect, teamMember) => claimRefusal(defect, teamMember),
    event: "EVT-DefectClaimed",
    // A claim made for someone else is an assignment (ST-026).
    confirms: (data) =>
      data.assignedBy === undefined ? { takenOverFrom: data.takenOverFrom, assignedTo: undefined } : undefined,
  }),
  release: described({
    refusal: (defect, teamMember) => releaseRefusal(defect, teamMember),
    event: "EVT-DefectClaimReleased",
    confirms: () => plain,
  }),
  "log-work": described({
    refusal: (defect) => logWorkRefusal(defect),
    event: "EVT-WorkLogged",
    confirms: () => plain,
  }),
  /** Whether they may put it on hold at all – with which reason is the form's choice (ST-029). */
  "put-on-hold": described({
    refusal: (defect, teamMember) => putOnHoldRefusal(defect, teamMember),
    event: "EVT-DefectPutOnHold",
    confirms: () => plain,
  }),
  resume: described({
    refusal: (defect, teamMember) => resumeRefusal(defect, teamMember),
    event: "EVT-DefectResumed",
    confirms: () => plain,
  }),
  resolve: described({
    refusal: (defect, teamMember) => resolveRefusal(defect, teamMember),
    event: "EVT-DefectResolved",
    confirms: () => plain,
  }),
  /** Whether it can be reopened – its machine being retired included, when the asker knows the machine. */
  reopen: described({
    refusal: (defect, _teamMember, reopening) => reopenRefusal(defect, reopening),
    event: "EVT-DefectReopened",
    confirms: () => plain,
  }),
  /** Whether they may assign it at all – whom to is asked per team member (`assigneeRefusal`). */
  assign: described({
    refusal: (defect, teamMember) => assignRefusal(defect, teamMember),
    event: "EVT-DefectClaimed",
    confirms: (data) =>
      data.assignedBy !== undefined ? { takenOverFrom: data.takenOverFrom, assignedTo: data.claimedBy } : undefined,
  }),
  /** Whether they may change its priority at all – to which one is the form's choice. */
  prioritize: described({
    refusal: (defect, teamMember) => prioritizeRefusal(defect, teamMember),
    event: "EVT-DefectPrioritized",
    confirms: () => plain,
  }),
  /** Whether they may change its title or mark at all – to what is the form's. */
  "change-details": described({
    refusal: (defect, teamMember) => changeDetailsRefusal(defect, teamMember),
    event: "EVT-DefectDetailsChanged",
    confirms: (data) => ({
      ...plain,
      changedDetails: {
        title: data.titleChanged === true,
        suitableForHelpers: data.suitableForHelpersChanged === true,
        releasedClaimOf: data.releasedClaimOf,
      },
    }),
  }),
};

export type DefectAction = keyof typeof descriptions;

/** The actions in the order the defect's page offers them. */
export const defectActions = Object.keys(descriptions) as readonly DefectAction[];

/** Per action: why the command would refuse this team member on the defect as it is – undefined when it would not. */
export type DefectActionRefusals = { [A in DefectAction]: ReturnType<(typeof descriptions)[A]["refusal"]> };

/** Each command's own rule, asked for one team member – the decisions apply the same functions. */
export function defectActionRefusals(
  defect: AskedDefect,
  teamMember: DefectTeamMember,
  reopening?: ReopeningFacts,
): DefectActionRefusals {
  return Object.fromEntries(
    defectActions.map((action) => [action, descriptions[action].refusal(defect, teamMember, reopening)]),
  ) as DefectActionRefusals;
}

/**
 * What this team member just did to the defect – the action of the defect's latest event, if it is theirs; undefined
 * when someone else acted last, or nobody did. For the confirmation after an action (G3): the address alone cannot make
 * a page confirm anything. The journal is read for this one answer, never to rebuild state (ADR 0002). After a claim it
 * names whom the defect was taken over from, if anyone; a claim made for someone else is an assignment, and names whom
 * the defect was assigned to (ST-026). After a change of its details it names which changed and whose claim that
 * released, if anyone's (ST-031).
 */
export type LastDefectAction = DefectActionDetails & { action: DefectAction };

export async function lastDefectActionBy(
  db: Database,
  defectId: string,
  teamMemberId: string,
): Promise<LastDefectAction | undefined> {
  // The same rule as every confirmation (G3): the latest command on the defect, run by this team member.
  const command = await lastCommandBy(db, { aggregateId: defectId }, teamMemberId);
  const latest =
    command &&
    entriesOf(repairEvents, command)
      .filter(
        (entry) =>
          entry.aggregate.id === defectId && defectActions.some((action) => descriptions[action].event === entry.type),
      )
      .at(-1);
  if (!latest) return undefined;
  type Data = typeof latest.data;
  for (const action of defectActions) {
    const { event, confirms } = descriptions[action];
    if (event !== latest.type) continue;
    // The entry is of the action's own event type – its data typed by that type's projection.
    const details = (confirms as (data: Data) => DefectActionDetails | undefined)(latest.data);
    if (details) return { action, ...details };
  }
  return undefined;
}
