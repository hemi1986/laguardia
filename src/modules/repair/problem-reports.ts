import { desc, eq } from "drizzle-orm";
import { aggregateStore, type Database } from "@/platform/command";
import type { ProblemReport } from "./report-problem";
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
  }),
  toRow: (report: ProblemReport) => ({
    id: report.id,
    machineId: report.machineId,
    description: report.description,
    reporterKind: report.reporter.kind,
    reporterTeamMemberId: report.reporter.kind === "team-member" ? report.reporter.teamMemberId : null,
    reportedAt: report.reportedAt,
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
