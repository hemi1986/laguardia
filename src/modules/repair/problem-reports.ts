import { desc, eq } from "drizzle-orm";
import type { Database } from "@/platform/command";
import type { ProblemReported } from "./report-problem";
import { problemReport } from "./schema";

export async function saveProblemReported(db: Database, event: ProblemReported): Promise<void> {
  await db.insert(problemReport).values({
    id: event.problemReportId,
    machineId: event.machineId,
    description: event.description,
    reporterKind: event.reporter.kind,
    reporterTeamMemberId: event.reporter.kind === "team-member" ? event.reporter.teamMemberId : null,
    reportedAt: event.reportedAt,
  });
}

export async function problemReportsOfMachine(db: Database, machineId: string) {
  return db
    .select({ id: problemReport.id, description: problemReport.description, reportedAt: problemReport.reportedAt })
    .from(problemReport)
    .where(eq(problemReport.machineId, machineId))
    .orderBy(desc(problemReport.reportedAt));
}
