import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMachineModelCommand, machineModelsToChooseFrom } from "@/modules/collection";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import { changeRole, createAccount, logIn } from "@/modules/team";
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

/** CMD-CreateMachineModel – technicians only. */
function createMachineModel(headers: Headers) {
  return runnerWith(headers)(createMachineModelCommand, {
    fields: ["title"],
    input: ({ title }) => ({ title: title ?? "", manufacturer: "Bally", machineCategory: "pinball" as const }),
    onSuccess: async () => {},
  });
}

async function actorOfReport(headers: Headers, fields: Record<string, string> = {}) {
  const reported: string[] = [];
  await reportProblem(headers, randomUUID(), reported)(null, post({ description: "Ball stuck", ...fields }));
  return (await journalOf(db, { aggregateId: reported[0] })).map((e) => e.actor);
}

async function machineModelTitled(title: string) {
  return (await machineModelsToChooseFrom(db)).filter((model) => model.title === title);
}

function post(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
}

afterEach(() => {
  vi.useRealTimers();
});

const noSession = new Headers();

describe("the acting person of a Server Action", () => {
  it("journals a command of a signed-in helper with that helper's team member ID and the role helper", async () => {
    const helper = await signedIn("helper");

    expect(await actorOfReport(helper.headers)).toEqual([
      { kind: "team-member", teamMemberId: helper.id, role: "helper" },
    ]);
  });

  it("journals a command of a signed-in technician with the role technician", async () => {
    const technician = await signedIn("technician");

    expect(await actorOfReport(technician.headers)).toEqual([
      { kind: "team-member", teamMemberId: technician.id, role: "technician" },
    ]);
  });

  it("runs a command without a session as a visitor, and rejects a team-only command storing nothing", async () => {
    const title = `Visitor model ${randomUUID()}`;

    expect(await actorOfReport(noSession)).toEqual([{ kind: "visitor" }]);
    expect(await createMachineModel(noSession)(null, post({ title }))).toEqual({
      error: "not-authorized",
      values: { title },
    });
    expect(await machineModelTitled(title)).toEqual([]);
  });

  it("treats an expired, unknown or tampered session cookie like no session, and the rejection reveals nothing", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-06-01T08:00:00Z") });
    const expired = (await signedIn("technician")).headers;
    vi.useRealTimers();
    const signed = (await signedIn("technician")).headers.get("cookie")!;
    const [name, value] = [signed.slice(0, signed.indexOf("=")), signed.slice(signed.indexOf("=") + 1)];
    const unknown = new Headers({ cookie: `${name}=${randomUUID()}` });
    const tampered = new Headers({ cookie: `${name}=${value.slice(0, -2)}${value.endsWith("A") ? "BB" : "AA"}` });
    const title = `Forged session model ${randomUUID()}`;
    const withoutSession = await createMachineModel(noSession)(null, post({ title }));

    for (const headers of [expired, unknown, tampered]) {
      expect(await actorOfReport(headers)).toEqual([{ kind: "visitor" }]);
      expect(await createMachineModel(headers)(null, post({ title }))).toEqual(withoutSession);
    }
    expect(await machineModelTitled(title)).toEqual([]);
  });

  it("acts with the new role on the next command after a technician changed it, without logging in again", async () => {
    const helper = await signedIn("helper");

    expect(await changeRole({ teamMemberId: helper.id, role: "technician" }, { db, actor: accountManager })).toEqual({
      ok: true,
      teamMemberId: helper.id,
    });

    expect(await actorOfReport(helper.headers)).toEqual([
      { kind: "team-member", teamMemberId: helper.id, role: "technician" },
    ]);
  });

  it("runs a forged post of a signed-in helper as that helper – role and team member fields change nothing", async () => {
    const helper = await signedIn("helper");
    const technician = await signedIn("technician");
    const forged = { role: "technician", teamMemberId: technician.id, actor: "system", kind: "team-member" };
    const title = `Forged model ${randomUUID()}`;

    expect(await createMachineModel(helper.headers)(null, post({ title, ...forged }))).toEqual({
      error: "not-authorized",
      values: { title },
    });
    expect(await machineModelTitled(title)).toEqual([]);
    expect(await actorOfReport(helper.headers, forged)).toEqual([
      { kind: "team-member", teamMemberId: helper.id, role: "helper" },
    ]);
  });

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
