import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { memoryStorage } from "@/platform/storage";
import { viewAddressOf } from "./view-address";

/** Opening uploaded content (ST-085, ADR 0006): an address valid for 5 minutes, only for names the server gives. */
describe("the address to open uploaded content", () => {
  const clock = fixedClock("2026-10-18T10:00:00Z");

  it("is valid for 5 minutes from now", async () => {
    const name = "files/0b6f3c1e-8f7a-4c55-9d2e-1a2b3c4d5e6f";

    expect(await viewAddressOf(memoryStorage(), clock, name)).toBe(
      `memory://${name}?valid-until=2026-10-18T10:05:00.000Z`,
    );
  });

  it("is not issued for a name the server does not give to uploaded content", async () => {
    expect(await viewAddressOf(memoryStorage(), clock, "problem-reports/a.jpg")).toBeUndefined();
    expect(await viewAddressOf(memoryStorage(), clock, "files/../problem-reports/a.jpg")).toBeUndefined();
  });
});
