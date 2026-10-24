import type { Reporter } from "@/modules/repair";
import { teamMessages } from "@/platform/messages";
import type { Named } from "./named";

/**
 * Who reported a problem, as the team sees it: a visitor, or a team member by name („unbekannt“ for an account that is
 * gone). Shared by the pages that show problem reports – the triage list and a problem report's page (ST-017), a
 * defect's page (ST-021).
 */
export type ShownReporter = { kind: "visitor" } | { kind: "team-member"; name: string };

/** A reporter by name (`named`, the page composes, ST-009). */
export function shownReporter(reporter: Reporter, { name }: Pick<Named, "name">): ShownReporter {
  return reporter.kind === "visitor" ? { kind: "visitor" } : { kind: "team-member", name: name(reporter.teamMemberId) };
}

/** The reporter in words – "Besucher:in" or the team member's name. */
export function reporterName(reporter: ShownReporter): string {
  return reporter.kind === "visitor" ? teamMessages.terms.Visitor : reporter.name;
}
