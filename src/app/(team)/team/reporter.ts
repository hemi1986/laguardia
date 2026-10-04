import type { Reporter } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";

/**
 * Who reported a problem, as the team sees it: a visitor, or a team member by name. Shared by the pages that show
 * problem reports – the triage list and a problem report's page (ST-017), a defect's page (ST-021).
 */
export type ShownReporter = { kind: "visitor" } | { kind: "team-member"; name: string | undefined };

/** A reporter with the team member's name from Team's `teamMemberNames` (the page composes, ST-009). */
export function shownReporter(reporter: Reporter, names: ReadonlyMap<string, string>): ShownReporter {
  return reporter.kind === "visitor"
    ? { kind: "visitor" }
    : { kind: "team-member", name: names.get(reporter.teamMemberId) };
}

/** The reporter in words – "Besucher:in", the team member's name, or "unbekannt" for an account that is gone. */
export function reporterName(reporter: ShownReporter): string {
  return reporter.kind === "visitor"
    ? teamMessages.terms.Visitor
    : (reporter.name ?? teamMessages.machineRecord.unknownTeamMember);
}
