import { activeTeamMembers, teamMemberRole, type ActiveTeamMember } from "@/modules/team";
import type { Database, TeamMemberId } from "@/platform/command";
import { claimReleasedByRemovingTheMark } from "./change-defect-details";
import { assigneeRefusal } from "./claim-defect";
import { priorities, type Defect, type Priority } from "./defect";
import type { DefectAction, DefectTeamMember } from "./defect-actions";
import { priorityRefusal } from "./prioritize-defect";
import { mayChangeMachineStatusWhileReopening } from "./reopen-defect";

/**
 * What the form of an action on a defect may offer the team member who asks (architecture review 2026-10-25) – the
 * choices its command would accept, from the command's own rules, so no form page carries one (G11). An action whose
 * form offers no choice has none.
 */
export type DefectFormOffers = {
  /**
   * The team members it can be assigned to (ST-026): everyone with an active account CMD-ClaimDefect would accept –
   * not its claimant, and not the technician asking, who claims it on the defect's page. Empty for someone who may not
   * assign.
   */
  assign: { assignees: ActiveTeamMember[] };
  /** The priorities CMD-PrioritizeDefect would accept (ST-027) – every one but the one it has, in the usual order. */
  prioritize: { priorities: Priority[] };
  /** Whether the team member may set its machine to a stricter status in the same step (ST-030) – technicians only. */
  reopen: { mayChangeMachineStatus: boolean };
  /** Whose claim removing the mark *suitable for helpers* would release (ST-031) – a helper's; none otherwise. */
  "change-details": { releasesClaimOf: TeamMemberId | undefined };
};

export type DefectFormOffer<Action extends DefectAction> = Action extends keyof DefectFormOffers
  ? DefectFormOffers[Action]
  : Record<never, never>;

/** The offer of the action's form; `refused` – the command refuses the team member anyway – leaves out what costs a read. */
export async function defectFormOffer<Action extends DefectAction>(
  db: Database,
  defect: Defect,
  teamMember: DefectTeamMember,
  action: Action,
  refused: boolean,
): Promise<DefectFormOffer<Action>> {
  const offer = action in offers ? offers[action as keyof DefectFormOffers] : undefined;
  // The table is keyed by action, so its entry is the offer of exactly this action – TypeScript cannot follow that.
  return ((await offer?.(db, defect, teamMember, refused)) ?? {}) as DefectFormOffer<Action>;
}

const offers: {
  [Action in keyof DefectFormOffers]: (
    db: Database,
    defect: Defect,
    teamMember: DefectTeamMember,
    refused: boolean,
  ) => Promise<DefectFormOffers[Action]>;
} = {
  assign: async (db, defect, teamMember, refused) => ({
    assignees: refused
      ? []
      : (await activeTeamMembers(db)).filter(
          ({ id, role }) =>
            id !== teamMember.teamMemberId && assigneeRefusal(defect, { teamMemberId: id, role }) === undefined,
        ),
  }),
  prioritize: async (_db, defect) => ({
    priorities: priorities.filter((priority) => priorityRefusal(defect, priority) === undefined),
  }),
  reopen: async (_db, _defect, teamMember) => ({
    mayChangeMachineStatus: mayChangeMachineStatusWhileReopening(teamMember),
  }),
  "change-details": async (db, defect) => ({
    releasesClaimOf:
      defect.claim && claimReleasedByRemovingTheMark(defect, await teamMemberRole(db, defect.claim.claimedBy)),
  }),
};
