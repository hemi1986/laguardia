import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  correctMachineDetailsCommand,
  createMachineModelCommand,
  machineForTeamForm,
  registerMachineCommand,
} from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember, TEST_TECHNICIAN } from "@/test-support/team-members";
import { pageUnderCurrentMuseumNumber, teamMachinePage, visitorMachinePage } from "./museum-number-address";

/**
 * The museum number in the address of a machine's page (CONTEXT.md: a reserved museum number still leads to its
 * machine, ST-035): every page of a machine – the machine record and its pages, the visitor's – leads from a reserved
 * museum number to the same page under the current one, its query kept. In a database of its own, because a test can
 * only arrange "LG-024" where no other test registers machines.
 */
const isolated = isolatedTestDatabase("museum_number_address");
let db: NodePgDatabase;
let machineModelId: string;
const dependencies = () => ({ actor: TEST_TECHNICIAN, db, newId: randomUUID });

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, TEST_TECHNICIAN);
  const model = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    dependencies(),
  );
  if (!model.ok) throw new Error(model.error);
  machineModelId = model.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withoutMachines(db);
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber: "LG-024", serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    dependencies(),
  );
  if (!registered.ok) throw new Error(registered.error);
  const shown = (await machineForTeamForm(db, "LG-024"))!;
  const corrected = await executeCommand(
    correctMachineDetailsCommand,
    { machineId: shown.id, version: shown.version, museumNumber: "LG-042", serialNumber: "" },
    dependencies(),
  );
  if (!corrected.ok) throw new Error(corrected.error);
});

describe("the page of a machine under its current museum number", () => {
  it.each([
    // [museum number in the address, page, query, where it leads – none: the page shows itself]
    ["LG-024", teamMachinePage(), {}, "/team/machines/LG-042"],
    ["LG-024", teamMachinePage("standort"), {}, "/team/machines/LG-042/standort"],
    ["LG-024", teamMachinePage("reparaturhistorie"), { jahr: "2026" }, "/team/machines/LG-042/reparaturhistorie?jahr=2026"],
    ["LG-024", teamMachinePage("datei-entfernen/abc"), {}, "/team/machines/LG-042/datei-entfernen/abc"],
    ["LG-024", visitorMachinePage(), { gemeldet: "1" }, "/m/LG-042?gemeldet=1"],
    ["LG-024", visitorMachinePage("melden"), {}, "/m/LG-042/melden"],
    ["LG-024", teamMachinePage("status"), { a: ["1", "2"], b: undefined }, "/team/machines/LG-042/status?a=1&a=2"],
    ["LG-042", teamMachinePage("status"), {}, undefined],
    ["LG-999", teamMachinePage("status"), {}, undefined],
    ["lg 042", visitorMachinePage(), {}, undefined],
  ] as const)("row %# – %s", async (museumNumber, page, query, expected) => {
    expect(await pageUnderCurrentMuseumNumber(db, museumNumber, page, query)).toBe(expected);
  });
});
