import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { changeMuseumDetailsCommand, museumSettings } from "@/modules/collection";
import {
  DEFAULT_MUSEUM_NAME,
  museumDetailsJournal,
  withDefaultMuseumDetails,
} from "@/modules/collection/museum-settings.test-support";
import { fixedClock } from "@/platform/clock";
import type { Actor } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { post } from "@/test-support/forms";
import { anExistingTeamMember } from "@/test-support/team-members";
import { museumFormDefinition } from "./museum-form-input";
import { MuseumFormContent } from "./museum-form";
import { loadMuseumSettings, savedLanding } from "./museum-settings-data";
import { MuseumSettingsView } from "./museum-settings";

/**
 * The museum settings page and its form „Museum“ (ST-100): the form's fields and input function run through the Server
 * Action runner as the signed-in team member; the page shows what is stored. In a database of its own: the museum
 * settings exist once, and every test starts from their defaults.
 */
const isolated = isolatedTestDatabase("museum_settings_page");
let db: NodePgDatabase;
const clock = fixedClock("2026-10-31T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
});

afterAll(() => isolated.close());

beforeEach(() => withDefaultMuseumDetails(db));

/** The form „Museum“ as the actor sends it; `saved` counts the saves that landed back on the page. */
function museumFormOf(actor: Actor) {
  const landed: string[] = [];
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(
    changeMuseumDetailsCommand,
    { ...museumFormDefinition, onSuccess: async () => void landed.push("saved") },
  );
  return { action, landed };
}

/** The form as the page shows it now, filled in – a checkbox that is not ticked is not sent at all. */
async function filledIn(change: { museumName?: string; machinesListed?: boolean }, version?: number) {
  const now = await museumSettings(db);
  const listed = change.machinesListed ?? now.machinesListed;
  return post({
    version: String(version ?? now.museumDetailsVersion),
    museumName: change.museumName ?? now.museumName,
    ...(listed ? { machinesListed: "on" } : {}),
  });
}

/** The page the technician lands on – after a save it says so (`?saved=museum`). */
async function page(address = "/team/museum-settings") {
  const params = Object.fromEntries(new URL(address, "http://localhost").searchParams);
  return renderToStaticMarkup(createElement(MuseumSettingsView, await loadMuseumSettings(db, params)));
}

/** The form „Museum“ after a rejection: the page's version and what the action state kept. */
async function formAfter(state: Awaited<ReturnType<ReturnType<typeof museumFormOf>["action"]>>) {
  const { museumDetailsVersion, museumName, machinesListed } = await museumSettings(db);
  return renderToStaticMarkup(
    createElement(MuseumFormContent, { version: museumDetailsVersion, museumName, machinesListed, state }),
  );
}

const nameField = (html: string) => html.match(/<input[^>]*name="museumName"[^>]*>/)?.[0] ?? "";
const listingField = (html: string) => html.match(/<input[^>]*name="machinesListed"[^>]*>/)?.[0] ?? "";

it("ST-100: A technician changes the museum's name", async () => {
  expect((await museumSettings(db)).museumName).toBe(DEFAULT_MUSEUM_NAME);
  const { action, landed } = museumFormOf(tom);

  expect(await action(null, await filledIn({ museumName: "Flippermuseum Eschbach" }))).toBeNull();

  expect(landed).toEqual(["saved"]);
  const html = await page(savedLanding("museum"));
  expect(nameField(html)).toContain('value="Flippermuseum Eschbach"');
  expect(html).toContain("Museum gespeichert.");
  const [changed] = (await museumDetailsJournal(db)).slice(-1);
  expect(changed).toMatchObject({
    type: "EVT-MuseumDetailsChanged",
    actor: tom,
    data: { changedDetails: ["museum-name"] },
  });
  // The typed name stays out of the journal.
  expect(JSON.stringify(changed.data)).not.toContain("Flippermuseum");
});

it("ST-100: Before any change the museum settings hold the defaults", async () => {
  const html = await page();

  expect(html).toMatch(/<h2[^>]*>Museum<\/h2>/);
  expect(nameField(html)).toContain(`value="${DEFAULT_MUSEUM_NAME.replaceAll("&", "&amp;")}"`);
  expect(html).toContain("Geräteliste auf der Startseite anzeigen");
  expect(listingField(html)).not.toContain("checked");
  expect(html).not.toContain("Museum gespeichert.");
});

it("ST-100: A technician switches the listing of the machines on", async () => {
  const { action } = museumFormOf(tom);

  expect(await action(null, await filledIn({ machinesListed: true }))).toBeNull();

  expect(await museumSettings(db)).toMatchObject({
    museumName: DEFAULT_MUSEUM_NAME,
    machinesListed: true,
  });
  const html = await page(savedLanding("museum"));
  expect(listingField(html)).toContain("checked");
  expect(nameField(html)).toContain(`value="${DEFAULT_MUSEUM_NAME.replaceAll("&", "&amp;")}"`);
  expect((await museumDetailsJournal(db)).at(-1)).toMatchObject({
    data: { changedDetails: ["machines-listed"], machinesListed: true },
  });
});

it("ST-100: An emptied name is rejected", async () => {
  const before = await museumSettings(db);
  const { action, landed } = museumFormOf(tom);

  const state = await action(null, await filledIn({ museumName: "   ", machinesListed: true }));

  expect(state).toMatchObject({ error: "museum-name-required", values: { machinesListed: "on" } });
  expect(landed).toEqual([]);
  const form = await formAfter(state);
  expect(form).toContain("Bitte einen Namen angeben.");
  expect(nameField(form)).toContain('aria-invalid="true"');
  expect(listingField(form)).toContain("checked");
  expect(await museumSettings(db)).toEqual(before);
});

it("ST-100: Saving without a change is no rejection", async () => {
  const before = await museumSettings(db);
  const journalBefore = await museumDetailsJournal(db);
  const { action, landed } = museumFormOf(tom);

  expect(await action(null, await filledIn({}))).toBeNull();

  expect(landed).toEqual(["saved"]);
  const html = await page(savedLanding("museum"));
  expect(html).toContain("Museum gespeichert.");
  expect(nameField(html)).toContain(`value="${DEFAULT_MUSEUM_NAME.replaceAll("&", "&amp;")}"`);
  expect(listingField(html)).not.toContain("checked");
  expect(await museumSettings(db)).toEqual(before);
  expect(await museumDetailsJournal(db)).toEqual(journalBefore);
});

it("ST-100: A change made by someone else meanwhile is not overwritten", async () => {
  const opened = (await museumSettings(db)).museumDetailsVersion;
  expect(await museumFormOf(eva).action(null, await filledIn({ museumName: "Flippermuseum Eschbach" }))).toBeNull();

  const state = await museumFormOf(tom).action(null, await filledIn({ museumName: "Arcade Museum Eschbach" }, opened));

  expect(state).toMatchObject({ error: "version-conflict", values: { museumName: "Arcade Museum Eschbach" } });
  const form = await formAfter(state);
  expect(form).toContain("Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.");
  expect(nameField(form)).toContain('value="Arcade Museum Eschbach"');
  expect((await museumSettings(db)).museumName).toBe("Flippermuseum Eschbach");
});

it("refuses a helper's museum form and changes nothing (G11)", async () => {
  const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
  await anExistingTeamMember(db, anna, "Anna");
  const before = await museumSettings(db);

  const state = await museumFormOf(anna).action(null, await filledIn({ museumName: "Annas Museum" }));

  expect(state).toMatchObject({ error: "not-authorized" });
  expect(await museumSettings(db)).toEqual(before);
});
