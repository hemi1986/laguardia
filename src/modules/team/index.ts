/** Public interface of the Team module (BC-Team: team members, roles, login) – ADR 0002. */
export {
  activateAccount,
  changeOwnPassword,
  changeRole,
  createAccount,
  deactivateAccount,
  resetPassword,
  teamMemberAccount,
  teamMemberAccounts,
  type AccountActions,
  type AccountError,
  type AccountOutcome,
  type TeamMemberAccount,
  type TeamMemberAccountWithActions,
} from "./accounts";
export { currentPerson, DeactivatedAccount, loggedInTeamMember, logIn, logOut, type LoginOutcome } from "./login";
export { setUpFirstTechnician, type FirstTechnicianOutcome } from "./first-technician";
export { renewedSessionCookie } from "./session-cookie";
export { teamMemberNames } from "./names";
export { activeTeamMemberRole, activeTeamMembers, teamMemberRole, type ActiveTeamMember } from "./active-team-members";
export { lastVisitOf, recordVisit } from "./visits";
