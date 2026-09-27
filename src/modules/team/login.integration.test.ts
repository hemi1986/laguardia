import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reportProblemCommand } from "@/modules/repair";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { currentPerson, logIn, logOut, renewedSessionCookie } from ".";
import { aTeamMemberAccount, cookieHeader } from "./accounts.test-support";
import { failedLogin } from "./schema";

const db = testDatabase();
const DAY = 24 * 3_600_000;

afterEach(() => {
  vi.useRealTimers();
});

async function anna() {
  const username = `anna_${randomUUID().slice(0, 8)}`;
  const account = await aTeamMemberAccount(db, { name: "Anna", username, role: "helper", password: "anna-secret-10" });
  return { ...account, username, password: "anna-secret-10" };
}

async function loggedIn(username: string, password: string) {
  const outcome = await logIn({ username, password }, { db });
  if (!outcome.ok) throw new Error(outcome.error);
  return new Headers({ cookie: cookieHeader(outcome.cookies) });
}

describe("logging in", () => {
  it("ST-004: Team member logs in", async () => {
    const { id, username, password } = await anna();

    const headers = await loggedIn(username, password);
    const person = await currentPerson({ db, headers });

    expect(person).toEqual({ kind: "team-member", teamMemberId: id, role: "helper" });
    const machineId = randomUUID();
    await executeCommand(reportProblemCommand, { machineId, description: "Ball stuck" }, { actor: person, db });
    expect((await journalOf(db, { machineId })).map((e) => e.actor)).toEqual([
      { kind: "team-member", teamMemberId: id, role: "helper" },
    ]);
  });

  it("ST-004: Wrong password is rejected without revealing which part was wrong", async () => {
    const { username } = await anna();

    const wrongPassword = await logIn({ username, password: "not-the-password" }, { db });
    const unknownUsername = await logIn(
      { username: `nobody_${randomUUID().slice(0, 8)}`, password: "not-the-password" },
      { db },
    );

    expect(wrongPassword).toEqual({ ok: false, error: "login-failed" });
    expect(unknownUsername).toEqual(wrongPassword);
  });

  it("ST-004: Team member stays logged in on the phone", async () => {
    const { id, username, password } = await anna();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-01T08:00:00Z") });
    const headers = await loggedIn(username, password);

    vi.setSystemTime(new Date("2026-09-01T08:00:00Z").getTime() + 30 * DAY);

    expect(await currentPerson({ db, headers })).toEqual({ kind: "team-member", teamMemberId: id, role: "helper" });
  });

  it("ST-004: Session expires after 90 days without use", async () => {
    const { username, password } = await anna();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-01T08:00:00Z") });
    const headers = await loggedIn(username, password);

    vi.setSystemTime(new Date("2026-09-01T08:00:00Z").getTime() + 91 * DAY);

    expect(await currentPerson({ db, headers })).toEqual({ kind: "visitor" });
  });

  it("ST-004: Repeated failed logins are slowed down", async () => {
    const { id, username, password } = await anna();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-01T08:00:00Z") });
    for (let attempt = 0; attempt < 10; attempt++) {
      vi.setSystemTime(new Date("2026-09-01T08:00:00Z").getTime() + attempt * 60_000); // within 10 minutes
      await logIn({ username, password: "not-the-password" }, { db });
    }

    vi.setSystemTime(new Date("2026-09-01T08:14:00Z"));
    // Rejected even with the correct password – the password is not checked while the username is locked.
    expect(await logIn({ username, password }, { db })).toEqual({ ok: false, error: "login-locked" });

    vi.setSystemTime(new Date("2026-09-01T08:30:00Z")); // more than 15 minutes after the 10th failure (08:09)
    const later = await logIn({ username, password }, { db });
    expect(later.ok).toBe(true);
    if (later.ok) {
      const headers = new Headers({ cookie: cookieHeader(later.cookies) });
      expect(await currentPerson({ db, headers })).toMatchObject({ teamMemberId: id });
    }
  });

  it("ST-004: Team member logs out", async () => {
    const { username, password } = await anna();
    const headers = await loggedIn(username, password);

    await logOut({ db, headers });

    // The session is gone: the same cookie makes her a visitor, so a team page asks for the login again.
    expect(await currentPerson({ db, headers })).toEqual({ kind: "visitor" });
  });

  it("keeps a team member logged in while she uses La Guardia – 90 days counted from the last use", async () => {
    const { id, username, password } = await anna();
    const start = new Date("2026-09-01T08:00:00Z").getTime();
    vi.useFakeTimers({ toFake: ["Date"], now: start });
    const headers = await loggedIn(username, password);

    vi.setSystemTime(start + 60 * DAY); // she uses it on day 60 …
    expect(await currentPerson({ db, headers })).toMatchObject({ teamMemberId: id });
    vi.setSystemTime(start + 120 * DAY); // … so on day 120 she is still logged in
    expect(await currentPerson({ db, headers })).toMatchObject({ teamMemberId: id });
  });

  it("renews the session cookie in the browser on every request, so it slides like the session", async () => {
    const { username, password } = await anna();
    const headers = await loggedIn(username, password);

    const renewed = await renewedSessionCookie({ db, cookieHeader: headers.get("cookie") ?? "" });

    expect(renewed).toMatchObject({
      value: headers.get("cookie")?.split("=").slice(1).join("="),
      attributes: { maxAge: 90 * 24 * 60 * 60, httpOnly: true, sameSite: "lax", path: "/" },
    });
    expect(await renewedSessionCookie({ db, cookieHeader: "" })).toBeUndefined();
  });

  it("cannot be bypassed by sending many failed logins at the same time", async () => {
    const { username } = await anna();

    const outcomes = await Promise.all(
      Array.from({ length: 15 }, () => logIn({ username, password: "not-the-password" }, { db })),
    );

    expect(outcomes.filter((o) => !o.ok && o.error === "login-failed")).toHaveLength(10);
    expect(outcomes.filter((o) => !o.ok && o.error === "login-locked")).toHaveLength(5);
  });

  it("forgets failed logins after 30 minutes – they only matter for the lock", async () => {
    const { username } = await anna();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-01T08:00:00Z") });
    await logIn({ username, password: "not-the-password" }, { db });

    vi.setSystemTime(new Date("2026-09-01T08:31:00Z"));
    await logIn({ username: "someone_else", password: "not-the-password" }, { db });

    expect(await db.select().from(failedLogin).where(eq(failedLogin.username, username))).toEqual([]);
  });
});
