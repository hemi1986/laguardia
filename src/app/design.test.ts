import { describe, expect, it } from "vitest";
import { designOf, deviceDesign } from "./design";

describe("the design of a page (ST-090)", () => {
  it.each([
    ["/team", undefined, "dark"],
    ["/team/machines", "light", "light"],
    ["/team/machines", "dark", "dark"],
    ["/team/gibt-es-nicht", "light", "light"],
    ["/login", "light", "light"],
    ["/login", undefined, "dark"],
    ["/team/machines/stickers/print", undefined, "light"],
    ["/team/machines/stickers/print", "dark", "light"],
    ["/team/machines/stickers", "light", "light"],
    ["/", "light", "dark"],
    ["/m/LG-042", "light", "dark"],
    ["/m/LG-042/melden", "light", "dark"],
    ["/datenschutz", "light", "dark"],
    ["/impressum", "light", "dark"],
    ["/gibt-es-nicht", "light", "dark"],
    ["/teams", "light", "dark"],
    ["/loginx", "light", "dark"],
  ] as const)("%s with the device's choice %s is %s", (path, device, design) => {
    expect(designOf(path, device)).toBe(design);
  });

  it("reads only a design from the device's cookie", () => {
    expect(deviceDesign("light")).toBe("light");
    expect(deviceDesign("dark")).toBe("dark");
    expect(deviceDesign("blue")).toBeUndefined();
    expect(deviceDesign(undefined)).toBeUndefined();
  });
});
