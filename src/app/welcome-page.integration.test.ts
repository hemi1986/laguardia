import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import {
  changeMachineStatusCommand,
  changeMuseumDetailsCommand,
  correctMachineDetailsCommand,
  createMachineModelCommand,
  machineForTeamForm,
  moveMachineCommand,
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
import { retireMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadVisitorMachinePage } from "./m/[museumNumber]/visitor-machine-page-data";
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

/** The machine's version as a technician's form reads it (HS-16). */
async function versionOf(museumNumber: string) {
  const machine = await machineForTeamForm(db, museumNumber);
  if (!machine) throw new Error(`no machine ${museumNumber}`);
  return { machineId: machine.id, version: machine.version };
}

async function statusChanged(museumNumber: string, machineStatus: MachineStatus) {
  const changed = await executeCommand(
    changeMachineStatusCommand,
    { ...(await versionOf(museumNumber)), machineStatus, reason: "Checked" },
    as(),
  );
  if (!changed.ok) throw new Error(changed.error);
}

it("ST-101: Machines that are not playable say so", async () => {
  await listingSwitched(true);
  await aMachine("LG-042", "Medieval Madness", "pinball", "Halle 2", "out-of-order");
  await aMachine("LG-005", "Fireball", "pinball", "Halle 1", "limited");
  await aMachine("LG-020", "Pac-Man", "arcade", "Halle 3", "playable");

  const html = await opened("de");

  expect(text(entryOf(html, "Medieval Madness")!)).toContain("Außer Betrieb");
  expect(text(entryOf(html, "Fireball")!)).toContain("Eingeschränkt");
  expect(text(entryOf(html, "Pac-Man")!).trim()).toBe("Pac-Man Halle 3");
});

it("ST-101: Machines not on display and retired machines are not listed", async () => {
  await listingSwitched(true);
  await aMachine("LG-042", "Medieval Madness", "pinball");
  await aMachine("LG-030", "Twilight Zone", "pinball", "Lager", "not-on-display");
  await retireMachine(db, await aMachine("LG-007", "Gorgar", "pinball"));

  const html = await opened("de");

  expect(entryOf(html, "Medieval Madness")).toBeDefined();
  expect(html).not.toContain("Twilight Zone");
  expect(html).not.toContain("LG-030");
  expect(html).not.toContain("Gorgar");
  expect(html).not.toContain("LG-007");
});

it("ST-101: Tapping a machine opens its visitor machine page", async () => {
  await listingSwitched(true);
  await aMachine("LG-042", "Medieval Madness", "pinball");
  const corrected = await executeCommand(
    correctMachineDetailsCommand,
    { ...(await versionOf("LG-042")), museumNumber: "LG-043", serialNumber: "" },
    as(),
  );
  expect(corrected.ok).toBe(true);

  const html = await opened("de");

  const entry = entryOf(html, "Medieval Madness")!;
  expect(entry).toMatch(/^<a[^>]*href="\/m\/LG-043"/);
  const machinePage = await loadVisitorMachinePage(db, "LG-043");
  expect(machinePage).toMatchObject({ retired: false, machineModelTitle: "Medieval Madness", reportingPossible: true });
});

it("ST-101: The welcome page in English", async () => {
  await listingSwitched(true);
  await aMachine("LG-042", "Medieval Madness", "pinball", "Halle 2, Reihe 3", "out-of-order");

  const html = await opened("en");

  expect(groups(html).map((group) => group.heading)).toEqual(["Pinball"]);
  expect(text(entryOf(html, "Medieval Madness")!).trim()).toBe("Medieval Madness Halle 2, Reihe 3 Out of order");
  expect(text(html)).toContain("Something not working? Tap a machine and report the problem.");
  expect(text(html)).not.toContain("Etwas funktioniert nicht?");
});

it("ST-101: With the listing switched off only the museum is shown", async () => {
  await listingSwitched(false);
  await aMachine("LG-042", "Medieval Madness", "pinball");

  const html = await opened("de");

  expect(html).toMatch(/<h1[^>]*>Flipper- &amp; Arcade Museum Eschbach<\/h1>/);
  expect(text(html)).not.toContain("Etwas funktioniert nicht?");
  expect(html).not.toContain("Medieval Madness");
  expect(html).not.toContain("<section");
  const bottom = html.slice(html.indexOf("Anmeldung fürs Team"));
  expect(html).toContain('href="/login"');
  expect(bottom).toContain('href="/datenschutz"');
});

it("ST-101: No machine on display shows no list", async () => {
  await listingSwitched(true);
  await aMachine("LG-030", "Twilight Zone", "pinball", "Lager", "not-on-display");
  await retireMachine(db, await aMachine("LG-007", "Gorgar", "pinball"));

  const html = await opened("de");

  expect(text(html)).not.toContain("Etwas funktioniert nicht?");
  expect(html).not.toContain("<section");
  expect(html).not.toContain("<ul");
  expect(html).toMatch(/<h1[^>]*>Flipper- &amp; Arcade Museum Eschbach<\/h1>/);
  expect(text(html)).toContain("Anmeldung fürs Team");
  expect(html).toContain('href="/datenschutz"');
});

it("ST-101: Changes are visible at the next page load", async () => {
  await listingSwitched(true);
  await aMachine("LG-042", "Medieval Madness", "pinball", "Halle 2, Reihe 3", "playable");
  expect(text(entryOf(await opened("de"), "Medieval Madness")!).trim()).toBe("Medieval Madness Halle 2, Reihe 3");

  const moved = await executeCommand(moveMachineCommand, { ...(await versionOf("LG-042")), location: "Halle 4" }, as());
  expect(moved.ok).toBe(true);
  await statusChanged("LG-042", "out-of-order");

  expect(text(entryOf(await opened("de"), "Medieval Madness")!).trim()).toBe("Medieval Madness Halle 4 Außer Betrieb");
});

it("sorts titles ignoring case, „Ä“ with „A“ in German, and machines of one machine model by location, then museum number", async () => {
  await listingSwitched(true);
  await aMachine("LG-061", "ätna", "other", "Halle 1");
  await aMachine("LG-062", "Asteroids", "other", "Halle 1");
  await aMachine("LG-063", "Bally Hoo", "other", "Halle 1");
  const model = await executeCommand(
    createMachineModelCommand,
    { title: "Addams Family", manufacturer: "Bally", machineCategory: "other" },
    as(),
  );
  if (!model.ok) throw new Error(model.error);
  for (const [museumNumber, location] of [
    ["LG-012", "Halle 2"],
    ["LG-010", "Halle 3"],
    ["LG-011", "Halle 2"],
  ]) {
    const registered = await executeCommand(
      registerMachineCommand,
      {
        machineModelId: model.result.machineModelId,
        museumNumber,
        serialNumber: undefined,
        location,
        machineStatus: "playable",
      },
      as(),
    );
    if (!registered.ok) throw new Error(registered.error);
  }

  const [other] = groups(await opened("de"));

  expect(other.entries.map((entry) => entry.match(/href="\/m\/(LG-\d+)"/)?.[1])).toEqual([
    "LG-011",
    "LG-012",
    "LG-010",
    "LG-062",
    "LG-061",
    "LG-063",
  ]);
});
