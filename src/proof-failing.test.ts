import { expect, it } from "vitest";

// Throwaway (ST-059 checklist): proves a red test blocks the merge into main. Never merged.
it("fails on purpose", () => {
  expect(1).toBe(2);
});
