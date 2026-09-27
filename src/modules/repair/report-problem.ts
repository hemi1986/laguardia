/**
 * CMD-ReportProblem (AGG-ProblemReport): a visitor or team member reports a problem with a machine.
 * Pure domain rule – persistence lives in `problem-reports.ts`. The rules on who may report for which machine
 * (on display, retired) come with the machine's status (ST-013, ST-015).
 */

export type Reporter = { kind: "visitor" } | { kind: "team-member"; teamMemberId: string };

export type ReportProblemInput = {
  machineId: string;
  description: string;
  reporter: Reporter;
};

export type ProblemReported = {
  type: "EVT-ProblemReported";
  machineId: string;
  description: string;
  reporter: Reporter;
  reportedAt: Date;
};

export type ReportProblemResult = { ok: true; event: ProblemReported } | { ok: false; error: "description-required" };

export function reportProblem(input: ReportProblemInput, now: Date): ReportProblemResult {
  const description = input.description.trim();
  if (!description) return { ok: false, error: "description-required" };
  return {
    ok: true,
    event: {
      type: "EVT-ProblemReported",
      machineId: input.machineId,
      description,
      reporter: input.reporter,
      reportedAt: now,
    },
  };
}
