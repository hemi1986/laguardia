import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { changeFileDetailsCommand, fileToOpen } from "@/modules/collection";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { executeCommand } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { aFileAdded } from "@/test-support/files";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { viewAddressOf } from "@/upload";
import { loadFileDetails } from "./file-details-data";
import { FileDetailsView } from "./file-details-view";

/**
 * ST-119: the original file name – the name a file had on the team member's device. Kept next to the title, shown on the
 * file details and the name of what is saved or opened; a file from before the feature has none. Hostile names (quotes,
 * line breaks, path parts) reach neither the header nor the page unescaped.
 */
const isolated = isolatedTestDatabase("original_file_name");
let db: NodePgDatabase;
let storage: MemoryStorage;
const clock = steppingClock("2026-11-04T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
let machineId: string;

afterAll(() => isolated.close());

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  clock.set("2026-11-04T10:00:00Z");
  storage = memoryStorage();
  machineId = await aRegisteredMachine(db);
});

const { ai } = aiScenario({ db: () => db, storage: () => storage, clock, technician: tom });
const at = { actor: tom, clock };

async function detailsHtml(fileId: string) {
  const file = await loadFileDetails(db, fileId, { params: {}, viewer: { id: tom.teamMemberId, role: "technician" }, ai: ai() });
  return renderToStaticMarkup(
    createElement(FileDetailsView, { file: file!, retry: async () => null, detach: async () => null }),
  );
}

/** The address that opens the file, as the route builds it (`fileToOpen`, then the view address). */
async function openAddress(fileId: string) {
  const found = (await fileToOpen(db, fileId))!;
  return decodeURIComponent((await viewAddressOf(storage, clock, found.content, found))!);
}

describe("the original file name", () => {
  it("ST-119: The original file name is kept and is the name of a download", async () => {
    const first = await aFileAdded(db, at, {
      machineId,
      title: "MM Operations Manual",
      originalFileName: "medieval_manual-v2.pdf",
    });
    const early = await aFileAdded(db, at, { machineId, title: "Early manual" });

    const corrected = await executeCommand(
      changeFileDetailsCommand,
      { fileId: first, title: "MM Manual", fileCategory: "manual", version: 0 },
      { actor: tom, db, clock, newId: randomUUID },
    );
    expect(corrected.ok).toBe(true);

    expect(await detailsHtml(first)).toContain("Ursprünglicher Dateiname: medieval_manual-v2.pdf");
    expect(await openAddress(first)).toContain(`inline; filename="medieval_manual-v2.pdf"; filename*=UTF-8''medieval_manual-v2.pdf`);

    expect(await detailsHtml(early)).not.toContain("Ursprünglicher Dateiname");
    // The download name as today: nothing named – a PDF opens in the browser with no disposition of its own.
    expect(await openAddress(early)).not.toContain("content-disposition");
  });

  it("saves a file that opens in no browser under its original name", async () => {
    const zip = await aFileAdded(db, at, {
      machineId,
      originalFileName: "schematics.zip",
      content: { name: `files/${randomUUID()}`, size: 10, contentType: "application/zip" },
    });

    expect(await openAddress(zip)).toContain(`attachment; filename="schematics.zip"`);
  });

  it("leaves a hostile name harmless in the header and on the page", async () => {
    const hostile = await aFileAdded(db, at, {
      machineId,
      originalFileName: '../x"; filename=evil.exe\r\nSet-Cookie: a=b<img src=x onerror=alert(1)>.pdf',
    });

    const address = await openAddress(hostile);
    expect(address).not.toMatch(/[\r\n]/);
    expect(address).not.toContain("../");
    const html = await detailsHtml(hostile);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });
});
