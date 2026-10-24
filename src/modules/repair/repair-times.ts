import { eq, or, sql } from "drizzle-orm";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { hoursBefore } from "@/platform/time";
import { priorities, type DefectState, type Priority } from "./defect";
import { defect, defectResolution, defectWorkLogEntry, problemReport } from "./schema";

/** The periods the repair times are shown for (ST-051) – the last 30 or 90 days, each counted in elapsed hours. */
export const repairTimePeriods = [30, 90] as const;
export type RepairTimePeriod = (typeof repairTimePeriods)[number];

/** A typical time of one priority (CONTEXT.md: Repair times) – the median in milliseconds, and how many defects it is of. */
export type RepairTime = { median: number; defects: number };

/** The repair times of one priority – each time none when no defect of that priority belongs to the period. */
export type RepairTimesOfPriority = {
  priority: Priority;
  toFirstWorkLogEntry: RepairTime | undefined;
  toResolved: RepairTime | undefined;
};

/** The two times of one defect (CONTEXT.md: Time to first work log entry, Time to resolved), in milliseconds – each only once it exists. */
export type DefectRepairTimes = { toFirstWorkLogEntry: number | undefined; toResolved: number | undefined };

/** When the times of a defect start and end – what both the view and the defect's page compute them from. */
type DefectMilestones = {
  /** The earliest problem report of the defect, originating or linked. */
  reportedAt: Date;
  /** Its first work log entry (HS-9: the start of repair) – none while nobody has logged work. */
  firstWorkLogEntryAt: Date | undefined;
  /** Its latest resolution – none while it is not resolved: a reopened defect counts again once resolved again. */
  resolvedAt: Date | undefined;
};

/** The two times of a defect from its milestones. */
function timesOf({ reportedAt, firstWorkLogEntryAt, resolvedAt }: DefectMilestones): DefectRepairTimes {
  const since = (instant: Date | undefined) => instant && instant.getTime() - reportedAt.getTime();
  return { toFirstWorkLogEntry: since(firstWorkLogEntryAt), toResolved: since(resolvedAt) };
}

/**
 * The two times of one defect (ST-051) – from its earliest problem report to its first work log entry and to its
 * latest resolution; the time to resolved only while it is resolved, so a reopened or closed-on-retirement defect has
 * none.
 */
export function defectRepairTimes(defect: {
  state: DefectState;
  problemReports: readonly { reportedAt: Date }[];
  workLog: readonly { loggedAt: Date }[];
  resolutions: readonly { resolvedAt: Date }[];
}): DefectRepairTimes {
  const earliest = (instants: Date[]) =>
    instants.length === 0 ? undefined : new Date(Math.min(...instants.map((instant) => instant.getTime())));
  const reportedAt = earliest(defect.problemReports.map((report) => report.reportedAt));
  if (!reportedAt) return { toFirstWorkLogEntry: undefined, toResolved: undefined };
  return timesOf({
    reportedAt,
    firstWorkLogEntryAt: earliest(defect.workLog.map((entry) => entry.loggedAt)),
    resolvedAt:
      defect.state === "resolved"
        ? new Date(Math.max(...defect.resolutions.map((resolution) => resolution.resolvedAt.getTime())))
        : undefined,
  });
}

/**
 * RM-RepairTimes (ST-051): per priority – the defect's current one, in the order of `priorities` – the typical time to
 * the first work log entry of the defects whose first work log entry falls in the period, and the typical time to
 * resolved of the defects resolved in it (latest resolution, still resolved). The period is the last `days` × 24 hours
 * before now. Computed when it is read (ADR 0002).
 */
export async function repairTimes(
  db: Database,
  clock: Clock,
  days: RepairTimePeriod,
): Promise<RepairTimesOfPriority[]> {
  const now = clock.now();
  const since = hoursBefore(now, days * 24);
  const rows = await db
    .select({
      priority: defect.priority,
      reportedAt: sql`(SELECT min(${problemReport.reportedAt}) FROM ${problemReport} WHERE ${or(
        eq(problemReport.id, defect.problemReportId),
        eq(problemReport.triageDefectId, defect.id),
      )})`.mapWith(problemReport.reportedAt),
      firstWorkLogEntryAt: sql`(SELECT min(${defectWorkLogEntry.loggedAt}) FROM ${defectWorkLogEntry} WHERE ${eq(
        defectWorkLogEntry.defectId,
        defect.id,
      )})`.mapWith(defectWorkLogEntry.loggedAt),
      resolvedAt:
        sql`CASE WHEN ${defect.state} = 'resolved' THEN (SELECT max(${defectResolution.resolvedAt}) FROM ${defectResolution} WHERE ${eq(
          defectResolution.defectId,
          defect.id,
        )}) END`.mapWith(defectResolution.resolvedAt),
    })
    .from(defect);
  const inPeriod = (instant: Date | undefined) => instant !== undefined && instant >= since && instant <= now;
  const defects = rows.map((row) => {
    const milestones = {
      reportedAt: row.reportedAt,
      firstWorkLogEntryAt: row.firstWorkLogEntryAt ?? undefined,
      resolvedAt: row.resolvedAt ?? undefined,
    };
    return { priority: row.priority, milestones, times: timesOf(milestones) };
  });
  return priorities.map((priority) => {
    const ofPriority = defects.filter((entry) => entry.priority === priority);
    return {
      priority,
      toFirstWorkLogEntry: typical(
        ofPriority
          .filter((entry) => inPeriod(entry.milestones.firstWorkLogEntryAt))
          .map((entry) => entry.times.toFirstWorkLogEntry),
      ),
      toResolved: typical(
        ofPriority.filter((entry) => inPeriod(entry.milestones.resolvedAt)).map((entry) => entry.times.toResolved),
      ),
    };
  });
}

/** The median of the times and how many there are – none without any; of an even number the mean of the middle two. */
function typical(times: (number | undefined)[]): RepairTime | undefined {
  const sorted = times.filter((time) => time !== undefined).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { median, defects: sorted.length };
}
