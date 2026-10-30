import type { Locator, Page } from "@playwright/test";
import { aMachine, anOpenDefect, expect, logIn, openDefect, pageWidth, test } from "./fixtures";

/**
 * Sections, lists, filters and links take one shape on every page (ST-092, G29, G30, G32, G17): two things have the
 * same shape when they are drawn with the same component – the same colours, frame, size of text and heading level –,
 * checked against a named example on the pages that already have it (the machine record's sections, „Status ändern“,
 * „Zurück zum Gerät“, the due maintenance filter's checkbox). Needs the e2e technician each local run creates (ST-083).
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password, "needs the e2e technician account");
});

/** What makes a section look like one: its frame's colours and corners, its title's heading level and type. */
async function sectionShapes(page: Page) {
  return page
    .getByRole("main")
    .locator("section")
    .evaluateAll((sections) =>
      sections.map((section) => {
        const frame = section.querySelector(":scope > [data-slot=card]");
        const title = section.querySelector("h1, h2, h3, h4");
        const style = (element: Element | null, properties: string[]) => {
          if (!element) return undefined;
          const computed = getComputedStyle(element);
          return properties.map((property) => computed.getPropertyValue(property)).join(" ");
        };
        return {
          title: title?.textContent ?? "",
          frame: style(frame, ["background-color", "border-radius", "box-shadow"]),
          heading: title && `${title.tagName} ${style(title, ["font-size", "font-weight"])}`,
        };
      }),
    );
}

/** The shape of the machine record's sections – the named example (G29). */
async function machineRecordSection(page: Page, museumNumber: string) {
  await page.goto(`/team/machines/${museumNumber}`);
  const [first] = await sectionShapes(page);
  expect(first.frame).toBeTruthy();
  return { frame: first.frame, heading: first.heading };
}

async function expectFramedLikeTheMachineRecord(page: Page, example: { frame?: string; heading?: string | null }) {
  const shapes = await sectionShapes(page);
  expect(shapes.length).toBeGreaterThan(0);
  for (const shape of shapes) expect({ title: shape.title, ...example }).toEqual(shape);
}

async function logWork(page: Page, museumNumber: string, title: string, whatWasDone: string) {
  await openDefect(page, museumNumber, title);
  await page.getByRole("main").getByRole("link", { name: "Arbeitsschritt eintragen" }).click();
  await page.getByLabel("Was wurde gemacht?").fill(whatWasDone);
  await page.getByRole("button", { name: "Arbeitsschritt eintragen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(title);
}

test("ST-092: The defect page is built from framed sections and headed by its title", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await logWork(page, museumNumber, title, "Checked the coil");
  await logWork(page, museumNumber, title, "Replaced the coil stop");
  const example = await machineRecordSection(page, museumNumber);

  await openDefect(page, museumNumber, title);

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(title);
  const machineLink = page.getByRole("main").getByRole("link").first();
  await expect(machineLink).toHaveText(new RegExp(`^${museumNumber} · Medieval Madness`));
  await expectFramedLikeTheMachineRecord(page, example);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});
