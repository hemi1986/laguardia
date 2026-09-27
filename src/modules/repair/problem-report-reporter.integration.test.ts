import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { problemReportsOfMachine, reportProblemCommand } from ".";

const db = testDatabase();

async function columnType(table: string, column: string): Promise<string> {
  const { rows } = await db.execute<{ data_type: string }>(
    sql`SELECT data_type FROM information_schema.columns WHERE table_name = ${table} AND column_name = ${column}`,
  );
  return rows[0]?.data_type ?? "missing";
}

describe("the reporting team member of a problem report", () => {
  it("ST-004: Problem reports refer to existing team member accounts", async () => {
    // Better Auth generates UUIDs for team member accounts (ST-003 ID convention).
    expect(await columnType("team_member", "id")).toBe("uuid");
    expect(await columnType("problem_report", "reporter_team_member_id")).toBe(await columnType("team_member", "id"));

    const machineId = randomUUID();
    const withoutAccount = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await expect(
      executeCommand(reportProblemCommand, { machineId, description: "Ball stuck" }, { actor: withoutAccount, db }),
    ).rejects.toThrow();
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
  });
});
