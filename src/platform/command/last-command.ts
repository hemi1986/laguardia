import { asc, desc, eq } from "drizzle-orm";
import { eventJournal } from "../schema";
import { journalEntryOf, type Database, type JournalEntry } from "./index";

/**
 * What a page may confirm (G3: "never from the address alone", architecture review 2026-10-18): the events of the
 * latest command on a machine or an aggregate – only when the given team member ran it. Anything someone else did
 * since, and anything the team member did not do, confirms nothing. The command layer gives every entry its command's
 * ID, so the answer holds every event the command wrote – on other aggregates, by the commands it ran and by its
 * policies too. Entries written before the journal knew their command count as a command each.
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
    latest.commandId === null
      ? [latest]
      : await db
          .select()
          .from(eventJournal)
          .where(eq(eventJournal.commandId, latest.commandId))
          .orderBy(asc(eventJournal.position));
  // Who ran the command is who wrote its first event: the layer journals the command's own events first, then those of
  // the commands it runs (the same person) and of its policies (the system) – `runInTransaction` in ./index.ts.
  if (command[0].actorTeamMemberId !== teamMemberId) return undefined;
  return command.map(journalEntryOf);
}
