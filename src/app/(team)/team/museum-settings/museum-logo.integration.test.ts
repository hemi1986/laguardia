import { randomUUID } from "node:crypto";
import { crc32 } from "node:zlib";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import {
  changeMuseumDetailsCommand,
  museumSettings,
  removeLogoCommand,
  replaceLogoCommand,
  welcomePage,
} from "@/modules/collection";
import { museumLogoJournal, withoutLogo } from "@/modules/collection/museum-settings.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { commandErrorText, teamMessages, visitorMessages } from "@/platform/messages";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { WelcomePageView } from "../../../welcome-page";
import { logoFormDefinition, removeLogoFormDefinition } from "./logo-form-input";
import { LogoFormContent } from "./logo-form";
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
    upload: runner(replaceLogoCommand, { ...logoFormDefinition, onSuccess: async () => void landed.push("saved") }),
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

/** The museum has a logo – Eva uploaded it; its stored name. */
async function aLogo() {
  const state = await logoFormsOf(eva).upload(null, await uploaded(await aPng(400, 200)));
  if (state) throw new Error(state.error);
  return (await museumSettings(db)).logo!;
}

it("ST-102: Without a logo the welcome page shows only the museum name", async () => {
  const html = await settingsPage();

  expect(html).toMatch(/<h2[^>]*>Logo<\/h2>/);
  expect(html).toContain("Noch kein Logo. Die Startseite zeigt nur den Namen.");
  expect(html).toContain("Logo hochladen");
  expect(html).not.toContain("Logo ersetzen");
  expect(html).not.toContain("Logo entfernen");
  expect(html).not.toContain("<img");
  // The section stands after „Museum“.
  expect(html).toMatch(/<h2[^>]*>Museum<\/h2>[\s\S]*<h2[^>]*>Logo<\/h2>/);
  const page = await welcome();
  expect(page).not.toContain("<img");
  expect(page).toMatch(/<main[^>]*><h1/);
});

it("ST-102: A technician replaces the logo", async () => {
  const previous = await aLogo();

  expect(await logoFormsOf(tom).upload(null, await uploaded(await aWebp()))).toBeNull();

  const { logo } = await museumSettings(db);
  expect(logo).toMatch(/^logo\/[0-9a-f-]{36}\.webp$/);
  expect(storage.read(logo!)?.contentType).toBe("image/webp");
  expect(storage.read(previous)).toBeUndefined();
  expect(storage.names()).toEqual([logo]);
  expect(await welcome()).toMatch(logoBeforeName);
  expect((await museumLogoJournal(db)).at(-1)).toMatchObject({
    type: "EVT-LogoReplaced",
    actor: tom,
    data: { logo, contentType: "image/webp", previousLogo: previous },
  });
});

it("ST-102: A technician removes the logo without being asked", async () => {
  const removed = await aLogo();
  const { remove, landed } = logoFormsOf(tom);

  expect(await remove(null, await removal())).toBeNull();

  expect(landed).toEqual(["removed"]);
  expect((await museumSettings(db)).logo).toBeUndefined();
  expect(storage.read(removed)).toBeUndefined();
  expect(await welcome()).not.toContain("<img");
  const html = await settingsPage(savedLanding("logo"));
  expect(html).toContain("Logo entfernt.");
  expect(html).toContain("Noch kein Logo. Die Startseite zeigt nur den Namen.");
  expect(html).toContain("Logo hochladen");
  expect(html).not.toContain("Logo entfernen");
  expect((await museumLogoJournal(db)).at(-1)).toMatchObject({
    type: "EVT-LogoRemoved",
    actor: tom,
    data: { removedLogo: removed },
  });
  // Upload again.
  expect(await logoFormsOf(tom).upload(null, await uploaded(await aPng(100, 50)))).toBeNull();
  expect((await museumSettings(db)).logo).toBeDefined();
});

it("ST-102: The stored logo is scaled down, carries no metadata and keeps its transparency", async () => {
  // Transparent left half, red right half – and a camera's EXIF data with a location.
  const pixels = Buffer.alloc(2400 * 1200 * 4);
  for (let y = 0; y < 1200; y++)
    for (let x = 1200; x < 2400; x++) pixels.set([200, 0, 0, 255], (y * 2400 + x) * 4);
  const sent = await sharp(pixels, { raw: { width: 2400, height: 1200, channels: 4 } })
    .withExif({
      IFD0: { Make: "Fotokamera", Model: "Museum 1" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "48/1 9/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "7/1 51/1 0/1" },
    })
    .png()
    .toBuffer();
  expect((await sharp(sent).metadata()).exif).toBeDefined();

  const state = await logoFormsOf(tom).upload(
    null,
    await uploaded(new File([new Uint8Array(sent)], "logo.png", { type: "image/png" })),
  );

  expect(state).toBeNull();
  const stored = storage.read((await museumSettings(db)).logo!)!;
  expect(stored.contentType).toBe("image/png");
  const meta = await sharp(stored.bytes).metadata();
  expect(meta).toMatchObject({ format: "png", width: 1000, height: 500, hasAlpha: true });
  expect(meta.exif).toBeUndefined();
  expect(meta.icc).toBeUndefined();
  expect(meta.xmp).toBeUndefined();
  expect(meta.comments ?? []).toEqual([]);
  expect(Buffer.from(stored.bytes).includes("Fotokamera")).toBe(false);
  const { data } = await sharp(stored.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(data[3]).toBe(0); // top left: still transparent
  expect(data[(250 * 1000 + 999) * 4 + 3]).toBe(255); // right edge: still opaque
});

/** A PNG file that claims 20 000 × 20 000 pixels in its header – small, and never decoded. */
async function aHugePng() {
  const bytes = Buffer.from(await (await aPng(10, 10)).arrayBuffer());
  // The IHDR chunk: length (4), type (4), width (4), height (4), … and its CRC over type and data.
  bytes.writeUInt32BE(20_000, 16);
  bytes.writeUInt32BE(20_000, 20);
  bytes.writeUInt32BE(crc32(bytes.subarray(12, 29)), 29);
  return new File([new Uint8Array(bytes)], "logo.png", { type: "image/png" });
}

const svg = new File(
  ['<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50"/></svg>'],
  "logo.svg",
  { type: "image/svg+xml" },
);
const pdfNamedPng = new File(
  ["%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n"],
  "logo.png",
  { type: "image/png" },
);

it("ST-102: Anything but a PNG, JPEG or WebP image within the pixel limit is rejected", async () => {
  const kept = await aLogo();
  const huge = await aHugePng();
  expect(huge.size).toBeLessThan(2_000_000);
  expect(await sharp(Buffer.from(await huge.arrayBuffer()), { limitInputPixels: false }).metadata()).toMatchObject({ width: 20_000, height: 20_000 });

  for (const file of [svg, pdfNamedPng, huge]) {
    const state = await logoFormsOf(tom).upload(null, await uploaded(file));

    expect(state, file.name).toMatchObject({ error: "not-a-logo-image" });
    expect(commandErrorText(teamMessages, state!.error)).toBe("Bitte ein Bild als PNG, JPEG oder WebP wählen.");
    expect((await museumSettings(db)).logo).toBe(kept);
    expect(storage.names()).toEqual([kept]);
  }
  const form = renderToStaticMarkup(
    createElement(LogoFormContent, {
      version: 0,
      hasLogo: true,
      uploadState: { error: "not-a-logo-image", values: { version: "0" } },
      removeState: null,
    }),
  );
  expect(form).toContain("Bitte ein Bild als PNG, JPEG oder WebP wählen.");
  expect(form).not.toMatch(/erneut|noch einmal auswählen/);
});

it("ST-102: A logo larger than 2 MB is rejected", async () => {
  const kept = await aLogo();
  const jpeg = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#336699" } })
    .jpeg()
    .toBuffer();
  // A JPEG of 3 MB: the image, then bytes a decoder ignores after its end.
  const threeMb = new File([new Uint8Array(Buffer.concat([jpeg, Buffer.alloc(3_000_000 - jpeg.length)]))], "logo.jpg", {
    type: "image/jpeg",
  });
  expect(threeMb.size).toBe(3_000_000);

  const state = await logoFormsOf(tom).upload(null, await uploaded(threeMb));

  expect(state).toMatchObject({ error: "logo-too-large" });
  expect(commandErrorText(teamMessages, state!.error)).toBe("Das Logo darf höchstens 2 MB groß sein.");
  expect((await museumSettings(db)).logo).toBe(kept);
  expect(storage.names()).toEqual([kept]);
});

it("ST-102: A logo changed by someone else meanwhile is not overwritten", async () => {
  await aLogo();
  const opened = (await museumSettings(db)).logoVersion;
  expect(await logoFormsOf(eva).remove(null, await removal())).toBeNull();
  const conflict = "Jemand hat das inzwischen geändert. Bitte die Seite neu laden und noch einmal versuchen.";

  const uploading = await logoFormsOf(tom).upload(null, await uploaded(await aWebp(), opened));
  const removing = await logoFormsOf(tom).remove(null, await removal(opened));

  expect(uploading).toMatchObject({ error: "version-conflict" });
  expect(commandErrorText(teamMessages, uploading!.error)).toBe(conflict);
  expect(removing).toMatchObject({ error: "no-logo" });
  expect(commandErrorText(teamMessages, removing!.error)).toBe(conflict);
  expect((await museumSettings(db)).logo).toBeUndefined();
  expect(storage.names()).toEqual([]);
  const form = renderToStaticMarkup(
    createElement(LogoFormContent, { version: opened, hasLogo: true, uploadState: uploading, removeState: removing }),
  );
  expect(form.split(conflict)).toHaveLength(3);
});

it("ST-102: Helpers cannot replace or remove the logo", async () => {
  const kept = await aLogo();
  const { upload, remove, landed } = logoFormsOf(anna);

  expect(await upload(null, await uploaded(await aWebp()))).toMatchObject({ error: "not-authorized" });
  expect(await remove(null, await removal())).toMatchObject({ error: "not-authorized" });

  expect(landed).toEqual([]);
  expect((await museumSettings(db)).logo).toBe(kept);
  expect(storage.names()).toEqual([kept]);
});

it("a save of the museum details in between never rejects a change of the logo", async () => {
  await aLogo();
  const opened = (await museumSettings(db)).logoVersion;
  const { museumDetailsVersion, museumName } = await museumSettings(db);
  const saved = await executeCommand(
    changeMuseumDetailsCommand,
    { version: museumDetailsVersion, museumName, machinesListed: true },
    { actor: eva, db, clock, newId: randomUUID },
  );
  expect(saved.ok).toBe(true);

  expect(await logoFormsOf(tom).remove(null, await removal(opened))).toBeNull();
});
