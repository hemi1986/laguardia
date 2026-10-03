import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { machineForReporting } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import { aggregateStore, type Database } from "@/platform/command";
import { elapsedHours, elapsedMoreThanHours } from "@/platform/time";
import type { ProblemReport, Reporter, ReportingFacts } from "./report-problem";
import { problemReport } from "./schema";

/** How AGG-ProblemReport is stored: one row per problem report, versioned (HS-16). */
export const problemReports = aggregateStore({
  type: "AGG-ProblemReport",
  table: problemReport,
  toState: problemReportOf,
  toRow: (report: ProblemReport) => ({
    id: report.id,
    machineId: report.machineId,
    description: report.description,
    reporterKind: report.reporter.kind,
    reporterTeamMemberId: report.reporter.kind === "team-member" ? report.reporter.teamMemberId : null,
    reportedAt: report.reportedAt,
    triageOutcome: report.triage?.outcome ?? null,
    triagedBy: report.triage?.triagedBy ?? null,
    triagedAt: report.triage?.triagedAt ?? null,
    triageDefectId: report.triage?.defectId ?? null,
  }),
});

/** A stored row as the problem report it is – the store and the triage list read it alike. */
function problemReportOf(row: typeof problemReport.$inferSelect): ProblemReport {
  return {
    id: row.id,
    machineId: row.machineId,
    description: row.description,
    reporter:
      row.reporterKind === "team-member"
        ? { kind: "team-member", teamMemberId: row.reporterTeamMemberId ?? missing("reporter_team_member_id", row.id) }
        : { kind: "visitor" },
    reportedAt: row.reportedAt,
    triage: triageOf(row),
  };
}

/** The Triage value object – all three columns or none (the database checks it too, ST-017 review). */
function triageOf(row: typeof problemReport.$inferSelect): ProblemReport["triage"] {
  if (row.triageOutcome === null) return undefined;
  return {
    outcome: row.triageOutcome,
    triagedBy: row.triagedBy ?? missing("triaged_by", row.id),
    triagedAt: row.triagedAt ?? missing("triaged_at", row.id),
    defectId: row.triageDefectId ?? undefined,
  };
}

function missing(column: string, id: string): never {
  throw new Error(`problem_report ${id}: ${column} is missing`);
}

/** Read model: the problem reports of one machine, newest first. */
export async function problemReportsOfMachine(db: Database, machineId: string) {
  return db
    .select({ id: problemReport.id, description: problemReport.description, reportedAt: problemReport.reportedAt })
    .from(problemReport)
    .where(eq(problemReport.machineId, machineId))
    .orderBy(desc(problemReport.reportedAt));
}

/**
 * The facts of CMD-ReportProblem: the machine as the Collection module knows it now, read in the command's transaction
 * through its public interface (context map, Collection → Repair). Repair never stores the machine status itself.
 */
export async function reportingFacts(tx: Database, input: { machineId: string }): Promise<ReportingFacts> {
  return { machine: await machineForReporting(tx, input.machineId) };
}

/**
 * How many problem reports of a machine wait for triage – all of them, not only today's (HS-1, ST-013). The visitor
 * machine page shows only this number, never the texts.
 */
export async function untriagedProblemReportCount(db: Database, machineId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(problemReport)
    .where(and(eq(problemReport.machineId, machineId), isNull(problemReport.triageOutcome)));
  return row.count;
}

/** Waiting longer than 3 days: more than 72 hours since it was reported (HS-2, time convention ST-003). */
const LONG_WAIT_HOURS = 72;

/**
 * One untriaged problem report as the triage list shows it (RM-TriageList) – machine and reporter by ID, and how long
 * it has been waiting, computed when the page loads (ADR 0002). ST-048's dashboard reads the same long wait.
 */
export type TriageListEntry = {
  id: string;
  machineId: string;
  description: string;
  reporter: Reporter;
  reportedAt: Date;
  waitingHours: number;
  waitingLong: boolean;
};

function triageListEntry(report: ProblemReport, now: Date): TriageListEntry {
  const { id, machineId, description, reporter, reportedAt } = report;
  return {
    id,
    machineId,
    description,
    reporter,
    reportedAt,
    waitingHours: elapsedHours(reportedAt, now),
    waitingLong: elapsedMoreThanHours(reportedAt, now, LONG_WAIT_HOURS),
  };
}

/**
 * RM-TriageList (ST-017): every untriaged problem report, the oldest first – it has waited longest. The page adds the
 * machine's museum number and title (Collection) and the reporting team member's name (Team).
 */
export async function triageList(db: Database, clock: Clock): Promise<TriageListEntry[]> {
  const rows = await db
    .select()
    .from(problemReport)
    .where(isNull(problemReport.triageOutcome))
    .orderBy(asc(problemReport.reportedAt), asc(problemReport.id));
  const now = clock.now();
  return rows.map((row) => triageListEntry(problemReportOf(row), now));
}

/**
 * One problem report for its own page (ST-017), triaged or not – the page says when it is already triaged. Undefined
 * for an unknown ID, or an address that is no ID at all.
 */
export async function problemReportForTriage(
  db: Database,
  clock: Clock,
  problemReportId: string,
): Promise<(TriageListEntry & { triaged: boolean }) | undefined> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(problemReportId)) return undefined;
  const [row] = await db.select().from(problemReport).where(eq(problemReport.id, problemReportId));
  if (!row) return undefined;
  const report = problemReportOf(row);
  return { ...triageListEntry(report, clock.now()), triaged: report.triage !== undefined };
}
