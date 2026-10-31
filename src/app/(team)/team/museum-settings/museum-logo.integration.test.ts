import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { museumSettings, welcomePage } from "@/modules/collection";
import { museumLogoJournal, withoutLogo } from "@/modules/collection/museum-settings.test-support";
import { fixedClock } from "@/platform/clock";
import type { Actor } from "@/platform/command";
import { visitorMessages } from "@/platform/messages";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { WelcomePageView } from "../../../welcome-page";
import { logoFormDefinition, removeLogoFormDefinition, uploadLogoCommand, removeLogoCommand } from "./logo-form-input";
import { loadMuseumSettings, savedLanding } from "./museum-settings-data";
import { MuseumSettingsView } from "./museum-settings";

/**
 * The form „Logo“ of the museum settings and the logo on the welcome page (ST-102): the form's definitions run through
 * the Server Action runner as the signed-in team member, with the in-memory storage; the pages show what is stored. In a
 * database of its own: the museum settings exist once, and every test starts without a logo.
 */
const isolated = isolatedTestDatabase("museum_logo_page");
let db: NodePgDatabase;
let storage: MemoryStorage;
const clock = fixedClock("2026-10-31T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withoutLogo(db);
  storage = memoryStorage();
});

/** The upload and the removal of the form „Logo“ as the actor sends them. */
function logoFormsOf(actor: Actor) {
  const landed: string[] = [];
  const runner = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID, storage });
  return {
    upload: runner(uploadLogoCommand, { ...logoFormDefinition, onSuccess: async () => void landed.push("saved") }),
    remove: runner(removeLogoCommand, {
      ...removeLogoFormDefinition,
      onSuccess: async () => void landed.push("removed"),
    }),
    landed,
  };
}

/** The upload as the browser posts it: the file as chosen and the logo version the page showed. */
async function uploaded(file: File, version?: number) {
  const form = new FormData();
  form.append("version", String(version ?? (await museumSettings(db)).logoVersion));
  form.append("logo", file);
  return form;
}

async function removal(version?: number) {
  const form = new FormData();
  form.append("version", String(version ?? (await museumSettings(db)).logoVersion));
  return form;
}

/** A PNG image of the given size – of one colour, or of noise, which a PNG cannot compress (300 × 260 ≈ 300 KB). */
async function aPng(width: number, height: number, { noise = false } = {}) {
  const image = noise
    ? sharp(randomPixels(width * height * 4), { raw: { width, height, channels: 4 } })
    : sharp({ create: { width, height, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } });
  const bytes = await image.png().toBuffer();
  return new File([new Uint8Array(bytes)], "logo.png", { type: "image/png" });
}

function randomPixels(length: number) {
  const pixels = Buffer.alloc(length);
  for (let i = 0; i < length; i++) pixels[i] = Math.floor(Math.random() * 256);
  return pixels;
}

async function aWebp(width = 400, height = 200) {
  const bytes = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 200, alpha: 1 } } })
    .webp()
    .toBuffer();
  return new File([new Uint8Array(bytes)], "logo.webp", { type: "image/webp" });
}

/** The page the technician lands on, as the technician sees it. */
async function settingsPage(address = "/team/museum-settings", viewer: Actor = tom) {
  const params = Object.fromEntries(new URL(address, "http://localhost").searchParams);
  const teamMemberId = viewer.kind === "team-member" ? viewer.teamMemberId : "";
  const data = await loadMuseumSettings(db, params, { viewer: teamMemberId, storage, clock });
  return renderToStaticMarkup(createElement(MuseumSettingsView, data));
}

/** The welcome page as a visitor sees it. */
async function welcome() {
  const page = await welcomePage(db, "de");
  return renderToStaticMarkup(
    createElement(WelcomePageView, { ...page, locale: "de", messages: visitorMessages("de") }),
  );
}

/** The welcome page's logo is the public address `/logo`, above the museum name. */
const logoBeforeName = /<img[^>]*src="\/logo"[^>]*>[\s\S]*<h1/;

it("ST-102: A technician uploads the first logo", async () => {
  const { upload, landed } = logoFormsOf(tom);

  const png = await aPng(300, 260, { noise: true });
  expect(png.size).toBeGreaterThan(280_000);
  expect(png.size).toBeLessThan(330_000);

  expect(await upload(null, await uploaded(png))).toBeNull();

  expect(landed).toEqual(["saved"]);
  const { logo } = await museumSettings(db);
  expect(logo).toMatch(/^logo\/[0-9a-f-]{36}\.png$/);
  const html = await settingsPage(savedLanding("logo"));
  expect(html).toContain("Logo gespeichert.");
  expect(html).toContain(`src="memory://${logo}?valid-until=`);
  expect(html).toContain("Logo ersetzen");
  expect(html).toContain("Logo entfernen");
  expect(await welcome()).toMatch(logoBeforeName);
  expect((await museumLogoJournal(db)).at(-1)).toMatchObject({
    type: "EVT-LogoReplaced",
    actor: tom,
    data: { logo, contentType: "image/png", previousLogo: null },
  });
  // Someone else opening the same address gets no confirmation (G3).
  expect(await settingsPage(savedLanding("logo"), eva)).not.toContain("Logo gespeichert.");
});
