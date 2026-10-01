import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import { createAccount, logIn } from "@/modules/team";
import { fixedClock } from "@/platform/clock";
import { journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { currentPersonOf } from "./current-person";
import { formRunner } from "./form-runner";

/**
 * The acting person comes from the session in one place (ST-069): the runner (ST-073) bound to the real session
 * lookup of `currentPerson()`, against real PostgreSQL – what `formAction` does in a request.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-01T10:00:00Z");
const PASSWORD = "secret-for-tests-10";
const accountManager = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

/** A team member account (through ST-005's interface) and the request headers of its logged-in phone. */
async function signedIn(role: "helper" | "technician") {
  const username = `${role}_${randomUUID().slice(0, 8)}`;
  const created = await createAccount(
    { name: `Test ${role}`, username, password: PASSWORD, role },
    { db, actor: accountManager },
  );
  if (!created.ok) throw new Error(created.error);
  const outcome = await logIn({ username, password: PASSWORD }, { db });
  if (!outcome.ok) throw new Error(outcome.error);
  const cookie = outcome.cookies.map((setCookie) => setCookie.split(";")[0]).join("; ");
  return { id: created.teamMemberId, headers: new Headers({ cookie }) };
}

function runnerWith(headers: Headers) {
  return formRunner({ currentPerson: () => currentPersonOf({ db, headers }), db, clock, newId: randomUUID });
}

function reportProblem(headers: Headers, machineId: string, reported: string[] = []) {
  return runnerWith(headers)(reportProblemCommand, {
    fields: ["description"],
    input: ({ description }) => ({ machineId, description: description ?? "" }),
    onSuccess: async ({ problemReportId }) => void reported.push(problemReportId),
  });
}

function post(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
}

describe("the acting person of a Server Action", () => {
  it("rejects a command sent with the session of a deactivated account – also a visitor-allowed one – and asks for the login", async () => {
    const helper = await signedIn("helper");
    await db.execute(sql`UPDATE team_member SET banned = true WHERE id = ${helper.id}`); // deactivated, session kept
    const machineId = randomUUID();

    await expect(reportProblem(helper.headers, machineId)(null, post({ description: "Ball stuck" }))).rejects.toThrow(
      expect.objectContaining({ digest: expect.stringContaining(";/login;") }),
    );

    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalOf(db, { machineId })).toEqual([]);
    // the session has ended – from now on the person can report as a visitor
    const reported: string[] = [];
    await reportProblem(helper.headers, machineId, reported)(null, post({ description: "Ball stuck" }));
    expect((await journalOf(db, { aggregateId: reported[0] })).map((e) => e.actor)).toEqual([{ kind: "visitor" }]);
  });
});
