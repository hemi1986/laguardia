import { describe, expect, it } from "vitest";
import {
  attachLanding,
  attachToFileAddress,
  changeLanding,
  changeFileDetailsAddress,
  detachFailureLanding,
  detachLanding,
  fileDetailsAddress,
  originValue,
  removalLanding,
  removeFileAddress,
  wayBack,
} from "./file-navigation";

describe("the file pages' navigation: where a page was reached from (G17)", () => {
  it("writes an origin into an address – only the closed set", () => {
    expect(originValue({ machine: "LG-042" })).toBe("machine:LG-042");
    expect(originValue("settings")).toBe("settings");
    expect(originValue({ kind: "none" })).toBeUndefined();
    expect(originValue(undefined)).toBeUndefined();
  });

  it("builds the addresses of the file pages with the origin kept, in one order", () => {
    const origin = { kind: "files", query: { page: 2 } } as const;
    expect(fileDetailsAddress("f1", origin)).toBe("/team/dateien/f1/details?from=files%3Apage%3D2");
    expect(fileDetailsAddress("f1")).toBe("/team/dateien/f1/details");
    expect(attachToFileAddress("f1", "settings")).toBe("/team/dateien/f1/details/anhaengen?from=settings");
    expect(changeFileDetailsAddress("f1", "settings")).toBe("/team/dateien/f1/details/bearbeiten?from=settings");
    expect(removeFileAddress("f1", "settings")).toBe("/team/dateien/f1/details/entfernen?from=settings");
    expect(changeLanding("f1", { machine: "LG-042" })).toBe("/team/dateien/f1/details?from=machine%3ALG-042&saved=1");
    expect(fileDetailsAddress("f1", "settings", { retried: true, detached: "machine:m1", added: true })).toBe(
      "/team/dateien/f1/details?from=settings&retried=1&detached=machine%3Am1&added=1",
    );
    expect(attachLanding("f1", "settings")).toBe("/team/dateien/f1/details?from=settings&attached=1");
    expect(detachLanding("f1", "settings", "machine:m1")).toBe(
      "/team/dateien/f1/details?from=settings&detached=machine%3Am1",
    );
    expect(detachFailureLanding("f1", undefined)).toBe("/team/dateien/f1/details?detachFailed=file-removed");
    expect(fileDetailsAddress("f1", "files", { added: true })).toBe("/team/dateien/f1/details?from=files&added=1");
  });

  it("leads back to the place, and lands a removal there with the confirmation", () => {
    expect(wayBack({ kind: "settings" })).toEqual({ href: "/team/museum-settings", kind: "settings" });
    expect(removalLanding({ kind: "settings" }, "f1")).toBe("/team/museum-settings?fileRemoved=f1#ki");
    expect(wayBack({ kind: "none" })).toEqual({ href: "/team/dateien", kind: "none" });
    expect(removalLanding({ kind: "none" }, "f1")).toBe("/team/dateien?fileRemoved=f1");
    expect(wayBack({ kind: "files", query: { page: 3 } }).href).toBe("/team/dateien?page=3");
    expect(removalLanding({ kind: "files", query: { page: 3 } }, "f1")).toBe("/team/dateien?page=3&fileRemoved=f1");
    expect(wayBack({ kind: "machine", museumNumber: "LG-042" })).toEqual({ href: "/team/machines/LG-042", kind: "machine" });
    expect(removalLanding({ kind: "machine", museumNumber: "LG-042" }, "f1")).toBe("/team/machines/LG-042?fileRemoved=f1");
  });
});
