/** Public interface of the Team module (BC-Team: team members, roles, login) – ADR 0002. */
export { currentPerson, loggedInTeamMember, logIn, logOut, type LoginOutcome } from "./login";
export { setUpFirstTechnician, type FirstTechnicianOutcome } from "./first-technician";
