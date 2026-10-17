import type { Role } from "@/platform/command";
import { teamMessages } from "@/platform/messages";

/**
 * A defect's claimant as the team sees them (ST-025): by name – and whether it is the team member looking at the page.
 * Shared by the open defects list and a defect's page, like `reporter.ts`.
 */
export type ShownClaimant = { name: string | undefined; you: boolean };

/** The team member looking at a page – what a page's data function needs to know about them. */
export type Viewer = { id: string; role: Role };

/** The claimant with their name from Team's `teamMemberNames` (the page composes, ST-009). */
export function shownClaimant(
  claimedBy: string | undefined,
  names: ReadonlyMap<string, string>,
  viewer: Viewer | undefined,
): ShownClaimant | undefined {
  return claimedBy ? { name: names.get(claimedBy), you: claimedBy === viewer?.id } : undefined;
}

/**
 * A team member's name from Team's `teamMemberNames` – or "unbekannt" for an account that is gone: one rule for every
 * page that names who did something (architecture review 2026-10-17).
 */
export function nameOf(names: ReadonlyMap<string, string>, teamMemberId: string): string {
  return names.get(teamMemberId) ?? teamMessages.machineRecord.unknownTeamMember;
}

/** A claimant's name – or "unbekannt" for an account that is gone. */
export function claimantName(claimant: ShownClaimant): string {
  return claimant.name ?? teamMessages.machineRecord.unknownTeamMember;
}

/** The claimant in words – one's own claim is said as such. */
export function claimantText(claimant: ShownClaimant): string {
  const { defects } = teamMessages;
  return claimant.you ? defects.claimedByYou : defects.claimedBy(claimantName(claimant));
}
