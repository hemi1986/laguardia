import type { Role } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import type { Named } from "./named";

/**
 * A defect's claimant as the team sees them (ST-025): by name – „unbekannt“ for an account that is gone – and whether
 * it is the team member looking at the page. Shared by the open defects list and a defect's page, like `reporter.ts`.
 */
export type ShownClaimant = { name: string; you: boolean };

/** The team member looking at a page – what a page's data function needs to know about them. */
export type Viewer = { id: string; role: Role };

/** The claimant by name (`named`, the page composes, ST-009). */
export function shownClaimant(
  claimedBy: string | undefined,
  { name }: Pick<Named, "name">,
  viewer: Viewer | undefined,
): ShownClaimant | undefined {
  return claimedBy ? { name: name(claimedBy), you: claimedBy === viewer?.id } : undefined;
}

/** The claimant in words – one's own claim is said as such. */
export function claimantText(claimant: ShownClaimant): string {
  const { defects } = teamMessages;
  return claimant.you ? defects.claimedByYou : defects.claimedBy(claimant.name);
}
