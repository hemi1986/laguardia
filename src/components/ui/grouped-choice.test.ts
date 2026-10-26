import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GroupedChoice } from "./grouped-choice";

const groups = [
  { key: "em", label: "Flipper · EM", entries: [{ value: "a", label: "LG-005 · Fireball" }, { value: "b", label: "LG-006 · Gorgar" }] },
  { key: "crt", label: "Arcade · CRT", entries: [{ value: "c", label: "LG-020 · Galaxian" }] },
];
const props = {
  name: "machineId",
  groups,
  header: (group: string, chosen: number, total: number) => `${group} – ${chosen} von ${total}`,
  selectAll: "Alle auswählen",
};

describe("GroupedChoice (G27)", () => {
  it("renders every group closed, with the count in its header, when nothing is chosen", () => {
    const html = renderToStaticMarkup(createElement(GroupedChoice, { ...props, chosen: [] }));

    expect(html).toContain("Flipper · EM – 0 von 2");
    expect(html).toContain("Arcade · CRT – 0 von 1");
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).not.toContain("checked");
    // "Alle auswählen" needs JavaScript: the server renders none.
    expect(html).not.toContain("Alle auswählen");
  });

  it("opens the groups with a choice in them and ticks the choices – after a rejection", () => {
    const html = renderToStaticMarkup(createElement(GroupedChoice, { ...props, chosen: ["b"] }));

    expect(html).toContain("Flipper · EM – 1 von 2");
    const [, em, crt] = html.split("<details");
    expect(em).toMatch(/^[^>]* open/);
    expect(crt).not.toMatch(/^[^>]* open/);
    const input = (value: string) => em.match(new RegExp(`<input[^>]*value="${value}"[^>]*>`))?.[0];
    expect(input("b")).toContain("checked");
    expect(input("a")).not.toContain("checked");
  });
});
