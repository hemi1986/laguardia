import { inArray } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { teamMember } from "./schema";

/**
 * The names of team members, for pages that show who did something ("… by", ST-009). The one way another module's
 * page learns a name: the Team module keeps its table to itself (ADR 0002), the page composes. A deactivated account's
 * team member keeps their name on everything they did (CONTEXT.md, Account).
 */
export async function teamMemberNames(db: Database, ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: teamMember.id, name: teamMember.name })
    .from(teamMember)
    .where(inArray(teamMember.id, unique));
  return new Map(rows.map((row) => [row.id, row.name]));
}
