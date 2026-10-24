import { describe, expect, it } from "vitest";
import { decideVisit, type StoredVisit } from "./visit";

const at = (instant: string) => new Date(instant);
const visit = (currentVisitStartedAt: string, lastVisit: string): StoredVisit => ({
  currentVisitStartedAt: at(currentVisitStartedAt),
  lastVisit: at(lastVisit),
});

/** One round on the floor is one visit (ST-050, decision 2 of the story review 2026-10-17; ADR 0011). */
describe("the Last visit", () => {
  it.each([
    [
      "the first visit begins a round and marks nothing",
      undefined,
      "2026-06-10T12:00:00Z",
      visit("2026-06-10T12:00:00Z", "2026-06-10T12:00:00Z"),
      true,
    ],
    [
      "opening again within the hour belongs to the current visit",
      visit("2026-06-10T12:00:00Z", "2026-06-09T18:00:00Z"),
      "2026-06-10T12:20:00Z",
      visit("2026-06-10T12:00:00Z", "2026-06-09T18:00:00Z"),
      false,
    ],
    [
      "exactly one hour after the round began still belongs to it",
      visit("2026-06-10T12:00:00Z", "2026-06-09T18:00:00Z"),
      "2026-06-10T13:00:00Z",
      visit("2026-06-10T12:00:00Z", "2026-06-09T18:00:00Z"),
      false,
    ],
    [
      "more than one hour after the round began is a new visit – the Last visit is where the round began",
      visit("2026-06-10T12:00:00Z", "2026-06-09T18:00:00Z"),
      "2026-06-10T13:30:00Z",
      visit("2026-06-10T13:30:00Z", "2026-06-10T12:00:00Z"),
      true,
    ],
  ])("%s", (_, stored, now, expected, changed) => {
    expect(decideVisit(stored, at(now))).toEqual({ visit: expected, changed });
  });
});
