import { describe, expect, it } from "vitest";
import { teamMessages } from "@/platform/messages";

/** The helper dashboard says each due maintenance task suitable for helpers in words (ST-049, G6). */
describe("a due maintenance task on the helper dashboard", () => {
  it.each([
    [1, 0, "„Clean glass“ ist an 1 Gerät fällig."],
    [1, 1, "„Clean glass“ ist an 1 Gerät überfällig."],
    [3, 0, "„Clean glass“ ist an 3 Geräten fällig."],
    [3, 1, "„Clean glass“ ist an 3 Geräten fällig, 1 davon überfällig."],
    [3, 3, "„Clean glass“ ist an 3 Geräten fällig – an allen überfällig."],
  ])("due on %i machines, overdue on %i", (machines, overdue, text) => {
    expect(teamMessages.helperDashboard.due("Clean glass", machines, overdue)).toBe(text);
  });
});
