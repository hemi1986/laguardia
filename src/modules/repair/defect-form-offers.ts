import { activeTeamMembers, teamMemberRole } from "@/modules/team";
import type { Database, Role, TeamMemberId } from "@/platform/command";
import { claimReleasedByRemovingTheMark } from "./change-defect-details";
import { assigneeRefusal, assignRefusal } from "./claim-defect";
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
   * not its claimant, and not the technician asking, who claims it on the defect's page; by ID with the role the rule
   * read, in Team's order – the page names them. Empty for someone who may not assign.
   */
  assign: { assignees: { teamMemberId: TeamMemberId; role: Role }[] };
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

/** The offer of the action's form – none for an action whose form offers no choice. */
export async function defectFormOffer<Action extends DefectAction>(
  db: Database,
  defect: Defect,
  teamMember: DefectTeamMember,
  action: Action,
): Promise<DefectFormOffer<Action>> {
  const offer = Object.hasOwn(offers, action) ? offers[action as keyof DefectFormOffers] : undefined;
  // The table is keyed by action, so its entry is the offer of exactly this action – TypeScript cannot follow that.
  return ((await offer?.(db, defect, teamMember)) ?? {}) as DefectFormOffer<Action>;
}

const offers: {
  [Action in keyof DefectFormOffers]: (
    db: Database,
    defect: Defect,
    teamMember: DefectTeamMember,
  ) => Promise<DefectFormOffers[Action]>;
} = {
  assign: async (db, defect, teamMember) => ({
    // Whom it can be assigned to is read only for someone who may assign at all.
    assignees:
      assignRefusal(defect, teamMember) === undefined
        ? (await activeTeamMembers(db))
            .filter(
              ({ id, role }) =>
                id !== teamMember.teamMemberId && assigneeRefusal(defect, { teamMemberId: id, role }) === undefined,
            )
            .map(({ id, role }) => ({ teamMemberId: id, role }))
        : [],
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
