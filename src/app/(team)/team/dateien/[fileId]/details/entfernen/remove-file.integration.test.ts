import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addFileCommand, createMachineModelCommand, fileDetails, registerMachineCommand } from "@/modules/collection";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadRemoveFile } from "./remove-file-data";
import { RemoveFileView } from "./remove-file-view";

/**
 * ST-121: removing a file on its details page. The question is the page data function of Collection's kept file record
 * rendered by its view; the removal itself runs through the Server Action runner with the real form definition, against
 * real PostgreSQL and the in-memory storage. Files are added through Collection's command.
 */
const isolated = isolatedTestDatabase("remove_file_page");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const at = () => ({ db, newId: randomUUID });
let medievalMadness: string;

afterAll(() => isolated.close());

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, ben, "Ben");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball" },
    { actor: tom, ...at() },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

async function aMachine(museumNumber: string): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus: "playable",
    },
    { actor: tom, ...at() },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

/** A file added with its attachments at once – the way the tests set them up before CMD-AttachFile. */
async function aFileAttachedTo(
  { machines = [], models = [] }: { machines?: string[]; models?: string[] },
  title: string,
): Promise<string> {
  const added = await executeCommand(
    addFileCommand,
    {
      title,
      fileCategory: "manual",
      originalFileName: undefined,
      machineIds: machines,
      machineModelIds: models,
      content: { name: `files/${randomUUID()}`, size: 4_200_000, contentType: "application/pdf" },
    },
    { actor: tom, ...at() },
  );
  if (!added.ok) throw new Error(added.error);
  return added.result.fileId;
}

type Viewer = typeof tom | typeof ben;

/** The question as a team member opens it – params are the address's query. */
async function question(
  fileId: string,
  { params = {}, person = tom }: { params?: Record<string, string>; person?: Viewer } = {},
) {
  const file = await loadRemoveFile(db, fileId, { params, viewer: { id: person.teamMemberId, role: person.role } });
  if (!file) return { file, html: "" };
  const html = renderToStaticMarkup(
    createElement(RemoveFileView, { file, action: async () => null, refusal: undefined }),
  );
  return { file, html };
}

/** The address of the link with this text in the markup. */
function hrefOf(html: string, linkText: string): string {
  const at = html.indexOf(`>${linkText}</a>`);
  if (at < 0) throw new Error(`No link „${linkText}“`);
  const start = html.lastIndexOf("<a ", at);
  return /href="([^"]+)"/.exec(html.slice(start, at))![1].replaceAll("&amp;", "&");
}

const lines = (html: string) =>
  [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));

describe("the question before removing a file (ST-121)", () => {
  it("ST-121: The question names everything the file disappears from", async () => {
    const machineId = await aMachine("LG-042");
    const manual = await aFileAttachedTo({ machines: [machineId], models: [medievalMadness] }, "MM Operations Manual");

    const { html } = await question(manual, { params: { from: "machine:LG-042" } });

    expect(html).toContain("Datei entfernen · MM Operations Manual</h1>");
    expect(html).toContain("„MM Operations Manual“ entfernen? Die Datei wird endgültig gelöscht.");
    expect(html).toContain("Sie verschwindet bei:");
    expect(lines(html)).toEqual(["LG-042 · Medieval Madness", "Alle Geräte des Modells Medieval Madness"]);
    expect(hrefOf(html, "Zurück")).toBe(`/team/dateien/${manual}/details?from=machine%3ALG-042`);
    expect(await fileDetails(db, manual)).toBeDefined();
  });
});
