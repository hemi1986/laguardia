import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createAccount, loggedInTeamMember, logIn } from "@/modules/team";
import { fixedClock } from "@/platform/clock";
import { memoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { uploadFile } from "@/upload/browser";
import { pendingUpload } from "@/upload/schema";
import { uploadRoute } from "./upload-route";

/**
 * The route that issues upload addresses (ST-085, ST-099, ADR 0009/0012). It is not behind the page proxy (`/api/` is not matched),
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

const MB = 1024 * 1024;
const askFor = (
  owner: object,
  { size = 3, contentType = "application/pdf", maximumSize = undefined as number | undefined } = {},
) => ({
  type: "laguardia.upload-address",
  owner,
  size,
  contentType,
  maximumSize,
});

afterEach(() => vi.unstubAllGlobals());

describe("the upload address route", () => {
  it("gives a team member a name for the content and an upload address for exactly that name, size and media type", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();

    const issued = await handle(post(askFor({ machineId }, { size: 1234, contentType: "image/jpeg" }), { cookie }));

    expect(issued.status).toBe(200);
    const { name, address } = (await issued.json()) as { name: string; address: { url: string; headers: object } };
    expect(name).toMatch(/^files\//);
    expect(address).toEqual({
      url: `memory://${name}?upload-until=2026-10-18T10:30:00.000Z&size=1234`,
      headers: { "Content-Type": "image/jpeg", "If-None-Match": "*" },
    });
  });

  it("ST-099: A declared size above the limit gets no upload address", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();
    const teamMember = await loggedInTeamMember({ db, headers: new Headers({ cookie }) });
    // The browser half asks this route, with the team member's session, as on the attaching form.
    vi.stubGlobal("fetch", (input: string, init: RequestInit) =>
      handle(
        new Request(new URL(input, ORIGIN), {
          ...init,
          headers: { ...(init.headers as Record<string, string>), cookie, origin: ORIGIN, host: "laguardia.example" },
        }),
      ),
    );
    const file = new File([new Uint8Array(2 * MB)], "manual.pdf", { type: "application/pdf" });

    const uploaded = await uploadFile(file, { owner: { machineId }, maximumSize: 1 * MB });

    expect(uploaded).toEqual({ ok: false, error: "too-large" });
    expect(await db.select().from(pendingUpload).where(eq(pendingUpload.issuedTo, teamMember!.id))).toEqual([]);
  });

  it("refuses a declared size above the file size limit with 413, whatever limit the request asks for", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();

    const refused = await handle(
      post(askFor({ machineId }, { size: 100 * MB + 1, maximumSize: 200 * MB }), { cookie }),
    );

    expect(refused.status).toBe(413);
    expect(await refused.text()).not.toContain("files/");
  });

  it("gives a request without a session no upload address", async () => {
    const handle = route();

    const issued = await handle(post(askFor({ machineId })));

    expect(issued.status).toBe(401);
    expect(await issued.text()).not.toContain("files/");
  });

  it("gives a request from another Origin, or without one, nothing – even with a session", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();

    for (const origin of ["https://evil.example", null]) {
      const issued = await handle(post(askFor({ machineId }), { cookie, origin }));
      expect(issued.status).toBe(403);
      expect(await issued.text()).not.toContain("files/");
    }
  });

  it("refuses an owner that does not exist and a request it does not know", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();

    expect((await handle(post(askFor({ machineId: randomUUID() }), { cookie }))).status).toBe(400);
    expect((await handle(post(askFor({ somethingElse: "x" }), { cookie }))).status).toBe(400);
    expect((await handle(post({ type: "blob.generate-presigned-url", payload: {} }, { cookie }))).status).toBe(400);
  });

  it("refuses a declared size or media type it cannot sign", async () => {
    const handle = route();
    const cookie = await aLoggedInTeamMember();

    for (const declared of [
      { size: -1 },
      { size: 1.5 },
      { size: "3" as unknown as number },
      { contentType: "" },
      { contentType: "text/html\r\nX-Injected: 1" },
      { contentType: "application/pdf; charset=binary" },
    ]) {
      expect((await handle(post(askFor({ machineId }, declared), { cookie }))).status).toBe(400);
    }
  });

  it("cleans up abandoned uploads after the response of every address it gives", async () => {
    const scheduled: (() => Promise<void>)[] = [];
    const handle = route((work) => void scheduled.push(work));
    const cookie = await aLoggedInTeamMember();

    await handle(post(askFor({ machineId }), { cookie }));

    expect(scheduled).toHaveLength(1);
  });
});
