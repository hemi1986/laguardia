import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { fixedClock } from "@/platform/clock";
import { aDefectWithHistory } from "@/test-support/defects";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { repairTimes, type Priority } from ".";

/**
 * RM-RepairTimes (ST-051): per priority the typical time from a defect's earliest problem report to its first work log
 * entry and to its resolution, over the last 30 or 90 days. A rule over all defects, so in a database of its own,
 * emptied before each test; the defects are set up through the commands (Q3).
 */
const isolated = isolatedTestDatabase("repair_times");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const NOW = new Date("2026-10-24T12:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The instant that many days (and hours) before now, as the commands' clock takes it. */
const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * DAY - hours * HOUR).toISOString();

const aDefect = (title: string, recordedAt: string, priority?: Priority) =>
  aDefectWithHistory(db, { by: tom, title, recordedAt, priority });

async function of(priority: Priority, days: 30 | 90 = 30) {
  const times = (await repairTimes(db, fixedClock(NOW.toISOString()), days)).find(
    (entry) => entry.priority === priority,
  );
  if (!times) throw new Error(`no entry for ${priority}`);
  return times;
}

beforeAll(async () => {
  db = await isolated.reset();
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

describe("RM-RepairTimes", () => {
  it("ST-051: Current priority counts", async () => {
    const displayFlickers = await aDefect("Display flickers", ago(10));
    await displayFlickers.prioritize("high", ago(9));
    await displayFlickers.resolve(ago(7));

    expect((await of("high")).toResolved).toEqual({ median: 3 * DAY, defects: 1 });
    expect((await of("normal")).toResolved).toBeUndefined();
  });
});
