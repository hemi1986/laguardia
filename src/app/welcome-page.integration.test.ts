import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import {
  changeMuseumDetailsCommand,
  createMachineModelCommand,
  museumSettings,
  registerMachineCommand,
  welcomePage,
  type MachineCategory,
  type MachineStatus,
} from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { withDefaultMuseumDetails } from "@/modules/collection/museum-settings.test-support";
import { executeCommand } from "@/platform/command";
import { visitorMessages, type VisitorLocale } from "@/platform/messages";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { WelcomePageView } from "./welcome-page";

/**
 * The welcome page with the machines on display (ST-101, RM-WelcomePage): its data as the page loads it, rendered by its
 * view. In a database of its own – the museum settings exist once, and the list is over all machines.
 */
const isolated = isolatedTestDatabase("welcome_page");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const as = () => ({ actor: tom, db, newId: randomUUID });

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

beforeEach(async () => {
  await withoutMachines(db);
  await withDefaultMuseumDetails(db);
});

afterAll(() => isolated.close());

async function listingSwitched(on: boolean) {
  const { museumDetailsVersion, museumName } = await museumSettings(db);
  const saved = await executeCommand(
    changeMuseumDetailsCommand,
    { version: museumDetailsVersion, museumName, machinesListed: on },
    as(),
  );
  if (!saved.ok) throw new Error(saved.error);
}

/** A machine of a machine model of its own, registered through the commands. */
async function aMachine(
  museumNumber: string,
  title: string,
  machineCategory: MachineCategory,
  location = "Halle 1",
  machineStatus: MachineStatus = "playable",
) {
  const model = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer: "Williams", machineCategory },
    as(),
  );
  if (!model.ok) throw new Error(model.error);
  const machine = await executeCommand(
    registerMachineCommand,
    { machineModelId: model.result.machineModelId, museumNumber, serialNumber: undefined, location, machineStatus },
    as(),
  );
  if (!machine.ok) throw new Error(machine.error);
  return machine.result.machineId;
}

/** The welcome page as a visitor with that browser language gets it. */
async function opened(locale: VisitorLocale = "de") {
  const page = await welcomePage(db, locale);
  return renderToStaticMarkup(createElement(WelcomePageView, { ...page, locale, messages: visitorMessages(locale) }));
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
/** The groups in their order, each with its heading and its entries' texts. */
function groups(html: string) {
  return [...html.matchAll(/<section[^>]*>\s*<h2[^>]*>(.*?)<\/h2>(.*?)<\/section>/g)].map(([, heading, list]) => ({
    heading,
    entries: [...list.matchAll(/<a[^>]*>(.*?)<\/a>/g)].map(([entry]) => entry),
  }));
}
const entryOf = (html: string, title: string) =>
  groups(html)
    .flatMap((group) => group.entries)
    .find((entry) => entry.includes(title));

it("ST-101: The machines on display are listed by machine category and title", async () => {
  await listingSwitched(true);
  await aMachine("LG-042", "Medieval Madness", "pinball", "Halle 2, Reihe 3");
  await aMachine("LG-005", "Fireball", "pinball", "Halle 1");
  await aMachine("LG-020", "Pac-Man", "arcade", "Halle 3");

  const html = await opened("de");

  expect(text(html)).toContain("Etwas funktioniert nicht? Gerät antippen und Problem melden.");
  expect(html.indexOf("Etwas funktioniert nicht?")).toBeLessThan(html.indexOf("<section"));
  const shown = groups(html);
  expect(shown.map((group) => group.heading)).toEqual(["Flipper", "Arcade"]);
  expect(shown[0].entries.map(text).map((entry) => entry.trim())).toEqual([
    "Fireball Halle 1",
    "Medieval Madness Halle 2, Reihe 3",
  ]);
  expect(shown[1].entries.map(text).map((entry) => entry.trim())).toEqual(["Pac-Man Halle 3"]);
  const entry = entryOf(html, "Medieval Madness")!;
  expect(entry.indexOf("Medieval Madness")).toBeLessThan(entry.indexOf("Halle 2, Reihe 3"));
  expect(text(html)).not.toMatch(/LG-\d{3}/);
  expect(text(html)).not.toContain("Sonstiges");
});
