import { desc, eq, sql } from "drizzle-orm";
import { machineForReporting } from "@/modules/collection";
import { aggregateStore, type Database } from "@/platform/command";
import type { ProblemReport, ReportingFacts } from "./report-problem";
import { problemReport } from "./schema";

/** How AGG-ProblemReport is stored: one row per problem report, versioned (HS-16). */
export const problemReports = aggregateStore({
  type: "AGG-ProblemReport",
  table: problemReport,
  toState: (row): ProblemReport => ({
    id: row.id,
    machineId: row.machineId,
    description: row.description,
    reporter:
      row.reporterKind === "team-member"
        ? { kind: "team-member", teamMemberId: row.reporterTeamMemberId ?? missing("reporter_team_member_id", row.id) }
        : { kind: "visitor" },
    reportedAt: row.reportedAt,
    triage:
      row.triageOutcome && row.triagedBy && row.triagedAt
        ? { outcome: row.triageOutcome, triagedBy: row.triagedBy, triagedAt: row.triagedAt }
        : undefined,
  }),
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
  }),
});

function missing(column: string, id: string): never {
  throw new Error(`problem_report ${id}: ${column} is missing for a team member's report`);
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
 * machine page shows only this number, never the texts. Until triage exists (ST-018) every problem report is untriaged.
 */
export async function untriagedProblemReportCount(db: Database, machineId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(problemReport)
    .where(eq(problemReport.machineId, machineId));
  return row.count;
}
