import { randomUUID } from "node:crypto";
import {
  dismissProblemReportCommand,
  logWorkCommand,
  recordDefectCommand,
  reportProblemCommand,
  resolveDefectCommand,
  resolveProblemOnTheSpotCommand,
  type Priority,
} from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor, type Database } from "@/platform/command";

type TeamMember = Extract<Actor, { kind: "team-member" }>;

const WEEK = 7 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const titles = ["Left flipper weak", "Rubber cracked", "Display flickers", "Coin door jammed", "Pop bumper dead"];
const priorityOf: Priority[] = ["normal", "high", "normal", "low"];

/**
 * Five years of realistic repair history for one machine (ST-033, user 2026-10-14): one problem report a week, 260 in
 * all – about 150 become defects with 1–4 work log entries each, about 80 are resolved on the spot and about 30
 * dismissed. All through the commands (Q3), every one at its own point in time, ending the week before `until`; the
 * defects of the last six weeks stay open. Deterministic: the same machine gets the same history every run.
 */
export async function fiveYearsOfRepairHistory(
  db: Database,
  {
    machineId,
    technician,
    helper,
    until,
  }: { machineId: string; technician: TeamMember; helper: TeamMember; until: string },
): Promise<{ defects: number; resolvedOnTheSpot: number; dismissed: number }> {
  const weeks = 5 * 52;
  const end = new Date(until).getTime();
  const counts = { defects: 0, resolvedOnTheSpot: 0, dismissed: 0 };
  for (let week = 0; week < weeks; week++) {
    const reportedAt = end - (weeks - week) * WEEK;
    const as = (actor: Actor, hoursLater: number) => ({
      actor,
      db,
      clock: fixedClock(new Date(reportedAt + hoursLater * HOUR).toISOString()),
      newId: randomUUID,
    });
    const title = titles[week % titles.length];
    const { problemReportId } = await done(
      executeCommand(
        reportProblemCommand,
        { machineId, description: `${title} – week ${week}` },
        as({ kind: "visitor" }, 0),
      ),
    );
    if (week % 9 === 0) {
      await done(
        executeCommand(
          dismissProblemReportCommand,
          { problemReportId, version: 0, reason: "not-a-fault", reasonText: "" },
          as(technician, 2),
        ),
      );
      counts.dismissed++;
    } else if (week % 3 === 1) {
      await done(
        executeCommand(
          resolveProblemOnTheSpotCommand,
          { problemReportId, version: 0, note: "Ball freed, playfield cleaned" },
          as(helper, 1),
        ),
      );
      counts.resolvedOnTheSpot++;
    } else {
      const recorded = await done(
        executeCommand(
          recordDefectCommand,
          {
            problemReportId,
            version: 0,
            title,
            priority: priorityOf[week % priorityOf.length],
            suitableForHelpers: week % 2 === 0,
            machineStatus: undefined,
            machineVersion: undefined,
          },
          as(technician, 2),
        ),
      );
      const defectId = recorded.defectId!;
      const entries = 1 + (week % 4);
      for (let entry = 0; entry < entries; entry++) {
        await done(
          executeCommand(
            logWorkCommand,
            {
              defectId,
              version: entry,
              whatWasDone: `Step ${entry + 1}: measured the coil, checked the wiring and cleaned the contacts`,
              partsUsed: entry % 2 === 0 ? "Coil FL-11630" : "",
            },
            as(entry % 2 === 0 ? technician : helper, 24 * (entry + 1)),
          ),
        );
      }
      if (week < weeks - 6) {
        await done(
          executeCommand(
            resolveDefectCommand,
            { defectId, version: entries, closingNote: "Coil replaced, tested for an hour" },
            as(technician, 24 * (entries + 1)),
          ),
        );
      }
      counts.defects++;
    }
  }
  return counts;
}

async function done<Result>(outcome: Promise<{ ok: true; result: Result } | { ok: false; error: string }>) {
  const result = await outcome;
  if (!result.ok) throw new Error(result.error);
  return result.result;
}
