import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { replaceLogoCommand } from "@/modules/collection";
import { withoutLogo } from "@/modules/collection/museum-settings.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { museumSettings } from "@/modules/collection";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { logoRoute } from "./logo-route";

/**
 * The public address `/logo` (ST-102): a real request without any session, against the in-memory storage, whose view
 * address names its validity. In a database of its own – there is one logo.
 */
const isolated = isolatedTestDatabase("logo_route");
let db: NodePgDatabase;
const clock = fixedClock("2026-10-31T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

afterAll(() => isolated.close());

beforeEach(() => withoutLogo(db));

async function aLogo(name: string) {
  const { logoVersion } = await museumSettings(db);
  const replaced = await executeCommand(
    replaceLogoCommand,
    { version: logoVersion, logo: { name, contentType: "image/png" } },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!replaced.ok) throw new Error(replaced.error);
}

/** Someone not logged in opens the address – the route reads nothing of the request, no cookie, no session. */
const opened = () => logoRoute({ db, storage: memoryStorage(), clock })();

it("ST-102: Visitors get the logo without logging in", async () => {
  await aLogo("logo/4b0e7c4e-8f0a-4a63-9d43-1f1b7a0b1c11.png");

  const response = await opened();

  expect(response.status).toBe(307);
  expect(response.headers.get("Location")).toBe(
    "memory://logo/4b0e7c4e-8f0a-4a63-9d43-1f1b7a0b1c11.png?valid-until=2026-10-31T10:05:00.000Z",
  );
  expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");

  await withoutLogo(db);
  const without = await opened();
  expect(without.status).toBe(404);
  expect(without.headers.get("Location")).toBeNull();
});
