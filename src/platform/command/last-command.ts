import { asc, desc, eq } from "drizzle-orm";
import { eventJournal } from "../schema";
import { journalEntryOf, type Database, type JournalEntry } from "./index";

/**
 * What a page may confirm (G3: "never from the address alone", architecture review 2026-10-18): the events of the
 * latest command on a machine or an aggregate – only when the given team member ran it. Anything someone else did
 * since, and anything the team member did not do, confirms nothing. One command is one transaction (ADR 0002), so the
 * answer holds every event it wrote – on other aggregates and by its policies too. Entries written before the journal
 * knew their transaction count as a command each.
 */
export async function lastCommandBy(
  db: Database,
  target: { aggregateId: string } | { machineId: string },
  teamMemberId: string,
): Promise<JournalEntry[] | undefined> {
  const [latest] = await db
    .select()
    .from(eventJournal)
    .where(
      "aggregateId" in target
        ? eq(eventJournal.aggregateId, target.aggregateId)
        : eq(eventJournal.machineId, target.machineId),
    )
    .orderBy(desc(eventJournal.position))
    .limit(1);
  if (!latest) return undefined;
  const command =
    latest.transactionId === null
      ? [latest]
      : await db
          .select()
          .from(eventJournal)
          .where(eq(eventJournal.transactionId, latest.transactionId))
          .orderBy(asc(eventJournal.position));
  // Who ran the command is who wrote its first event – its policies come after it, as the system.
  if (command[0].actorTeamMemberId !== teamMemberId) return undefined;
  return command.map(journalEntryOf);
}
