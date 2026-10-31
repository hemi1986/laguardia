import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, expect, it } from "vitest";
import { changeMuseumDetailsCommand, museumName as museumNameIn, museumSettings } from "@/modules/collection";
import { executeCommand } from "@/platform/command";
import { visitorMessages, type VisitorLocale } from "@/platform/messages";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { UnknownMachineView } from "./m/[museumNumber]/unknown-machine";
import { UnknownAddressView } from "./unknown-address";
import { WelcomePageView } from "./welcome-page";

/**
 * The museum's name on the visitor pages that name the museum (ST-100): the welcome page and both pages for an address
 * that leads nowhere, in German and in English – rendered from what the museum settings hold. In a database of its own:
 * the museum settings exist once.
 */
const isolated = isolatedTestDatabase("visitor_museum_name");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

afterAll(() => isolated.close());

async function rendered(view: typeof WelcomePageView, locale: VisitorLocale) {
  const museumName = await museumNameIn(db);
  return renderToStaticMarkup(
    createElement(view, {
      museumName,
      locale,
      messages: visitorMessages(locale),
      machinesOnDisplay: [],
      imprintProvided: false,
    }),
  );
}

const heading = (html: string) => html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1];

it("ST-100: The museum's name replaces the hard-coded name on the visitor pages", async () => {
  const { museumDetailsVersion } = await museumSettings(db);
  const saved = await executeCommand(
    changeMuseumDetailsCommand,
    { version: museumDetailsVersion, museumName: "Flippermuseum Eschbach", machinesListed: false },
    { actor: tom, db, newId: randomUUID },
  );
  expect(saved.ok).toBe(true);

  for (const locale of ["de", "en"] as const) {
    expect(heading(await rendered(WelcomePageView, locale))).toBe("Flippermuseum Eschbach");
    expect(heading(await rendered(UnknownAddressView, locale))).toBe("Flippermuseum Eschbach");
    expect(heading(await rendered(UnknownMachineView, locale))).toBe("Flippermuseum Eschbach");
  }
});
