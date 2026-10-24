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

    expect((await of("high")).toResolved).toEqual({ typical: 3 * DAY, defects: 1 });
    expect((await of("normal")).toResolved).toBeUndefined();
  });

  it("ST-051: The period is counted in elapsed hours", async () => {
    const coinDoorJammed = await aDefect("Coin door jammed", ago(40), "low");
    await coinDoorJammed.resolve(ago(29, 23));
    const lampOut = await aDefect("Lamp out", ago(40), "low");
    await lampOut.resolve(ago(30, 1));

    // Coin door jammed: 40 days − 29 days 23 hours = 10 days 1 hour from report to resolved; Lamp out would be 9 days 23 hours.
    expect((await of("low")).toResolved).toEqual({ typical: 10 * DAY + HOUR, defects: 1 });
  });

  it("ST-051: Defects closed on retirement are not counted as resolved", async () => {
    const displayDead = await aDefect("Display dead", ago(20));
    await displayDead.logWork(ago(15));
    await displayDead.retireMachine(ago(5));

    expect(await of("normal")).toEqual({
      priority: "normal",
      toFirstWorkLogEntry: { typical: 5 * DAY, defects: 1 },
      toResolved: undefined,
    });
  });

  it("ST-051: Defects without work log entries", async () => {
    const coinDoorJammed = await aDefect("Coin door jammed", ago(6));
    await coinDoorJammed.resolve(ago(4));

    expect(await of("normal")).toEqual({
      priority: "normal",
      toFirstWorkLogEntry: undefined,
      toResolved: { typical: 2 * DAY, defects: 1 },
    });
  });

  it("ST-051: The latest resolution counts after a reopen", async () => {
    const leftFlipperWeak = await aDefect("Left flipper weak", "2026-06-01T09:00:00Z");
    await leftFlipperWeak.resolve("2026-06-03T09:00:00Z");
    await leftFlipperWeak.reopen("2026-06-05T09:00:00Z");
    await leftFlipperWeak.resolve("2026-06-09T09:00:00Z");

    const times = await repairTimes(db, fixedClock("2026-06-20T09:00:00Z"), 30);

    expect(times.find((entry) => entry.priority === "normal")?.toResolved).toEqual({ typical: 8 * DAY, defects: 1 });
  });

  it("ST-051: Period membership", async () => {
    const displayFlickers = await aDefect("Display flickers", ago(40));
    await displayFlickers.logWork(ago(35));
    await displayFlickers.resolve(ago(10));

    expect(await of("normal")).toEqual({
      priority: "normal",
      toFirstWorkLogEntry: undefined,
      toResolved: { typical: 30 * DAY, defects: 1 },
    });
    expect((await of("normal", 90)).toFirstWorkLogEntry).toEqual({ typical: 5 * DAY, defects: 1 });
  });
});
