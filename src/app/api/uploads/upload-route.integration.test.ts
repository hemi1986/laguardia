import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createAccount, loggedInTeamMember, logIn } from "@/modules/team";
import { fixedClock } from "@/platform/clock";
import { memoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { uploadRoute } from "./upload-route";

/**
 * The route that issues upload addresses (ST-085, ADR 0009). It is not behind the page proxy (`/api/` is not matched),
 * so it checks the request's Origin and a team session itself – independent of any page. Real requests with the
 * headers of a real login, real PostgreSQL, the in-memory storage adapter.
 */
const db = testDatabase();
const PASSWORD = "secret-for-tests-85";
const accountManager = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ORIGIN = "https://laguardia.example";
let machineId: string;

beforeAll(async () => {
  machineId = await aRegisteredMachine(db);
});

async function aLoggedInTeamMember(role: "helper" | "technician" = "helper"): Promise<string> {
  const username = `up_${randomUUID().slice(0, 8)}`;
  const created = await createAccount(
    { name: "Test", username, password: PASSWORD, role },
    { db, actor: accountManager },
  );
  if (!created.ok) throw new Error(created.error);
  const outcome = await logIn({ username, password: PASSWORD }, { db });
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.cookies[0].split(";")[0];
}

function route(afterResponse: (work: () => Promise<void>) => void = () => {}) {
  return uploadRoute({
    db,
    storage: memoryStorage(),
    clock: fixedClock("2026-10-18T10:00:00Z"),
    newId: randomUUID,
    teamMember: (headers) => loggedInTeamMember({ db, headers }),
    afterResponse,
  });
}

function post(body: unknown, { cookie, origin = ORIGIN }: { cookie?: string; origin?: string | null } = {}) {
  const headers = new Headers({ "content-type": "application/json", host: "laguardia.example" });
  if (origin) headers.set("origin", origin);
  if (cookie) headers.set("cookie", cookie);
  return new Request(`${ORIGIN}/api/uploads`, { method: "POST", headers, body: JSON.stringify(body) });
}

const startFor = (owner: object, maximumSize?: number) => ({ type: "laguardia.pending-upload", owner, maximumSize });
const addressFor = (name: string) => ({
  type: "blob.generate-presigned-url",
  payload: { pathname: name, multipart: true, clientPayload: null },
});

describe("the upload address route", () => {
  it("gives a team member a name for the content and then an upload address for exactly that name", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();

    const started = await handle(post(startFor({ machineId }), { cookie }));
    expect(started.status).toBe(200);
    const { name } = (await started.json()) as { name: string };
    expect(name).toMatch(/^files\//);

    const issued = await handle(post(addressFor(name), { cookie }));
    expect(issued.status).toBe(200);
    expect(await issued.json()).toEqual({
      type: "blob.generate-presigned-url",
      presignedUrlPayload: { name, maximumSize: 100 * 1024 * 1024, validUntil: "2026-10-18T10:30:00.000Z" },
    });
  });

  it("issues a stricter size limit when the request asks for one", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();
    const { name } = (await (await handle(post(startFor({ machineId }, 1024), { cookie }))).json()) as { name: string };

    const issued = (await (await handle(post(addressFor(name), { cookie }))).json()) as { presignedUrlPayload: object };

    expect(issued.presignedUrlPayload).toMatchObject({ maximumSize: 1024 });
  });

  it("gives a request without a session neither a name nor an upload address", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();
    const { name } = (await (await handle(post(startFor({ machineId }), { cookie }))).json()) as { name: string };

    const started = await handle(post(startFor({ machineId })));
    const issued = await handle(post(addressFor(name)));

    expect(started.status).toBe(401);
    expect(await started.text()).not.toContain("files/");
    expect(issued.status).toBe(401);
    expect(await issued.text()).not.toContain(name);
  });

  it("gives a request from another Origin, or without one, nothing – even with a session", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();
    const { name } = (await (await handle(post(startFor({ machineId }), { cookie }))).json()) as { name: string };

    for (const origin of ["https://evil.example", null]) {
      const started = await handle(post(startFor({ machineId }), { cookie, origin }));
      const issued = await handle(post(addressFor(name), { cookie, origin }));
      expect([started.status, issued.status]).toEqual([403, 403]);
      expect(await issued.text()).not.toContain("presignedUrlPayload");
    }
  });

  it("gives another team member no upload address for a name issued to someone else", async () => {
    const handle = route();
    const { name } = (await (
      await handle(post(startFor({ machineId }), { cookie: await aLoggedInTeamMember() }))
    ).json()) as { name: string };

    const issued = await handle(post(addressFor(name), { cookie: await aLoggedInTeamMember("technician") }));

    expect(issued.status).toBe(403);
  });

  it("refuses an owner that does not exist and a request it does not know", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();

    expect((await handle(post(startFor({ machineId: randomUUID() }), { cookie }))).status).toBe(400);
    expect((await handle(post(startFor({ somethingElse: "x" }), { cookie }))).status).toBe(400);
    expect((await handle(post({ type: "blob.upload-completed", payload: {} }, { cookie }))).status).toBe(400);
  });

  it("cleans up abandoned uploads after the response of every name it gives", async () => {
    const scheduled: (() => Promise<void>)[] = [];
    const handle = route((work) => void scheduled.push(work));
    const cookie = await aLoggedInTeamMember();

    await handle(post(startFor({ machineId }), { cookie }));

    expect(scheduled).toHaveLength(1);
  });
});
