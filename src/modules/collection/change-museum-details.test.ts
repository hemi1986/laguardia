import { describe, expect, it } from "vitest";
import { changeMuseumDetails, type MuseumDetails } from "./change-museum-details";

/** CMD-ChangeMuseumDetails' decision (ST-100): which details a save changes, the empty name, and a save without a change. */
const stored: MuseumDetails = {
  id: "museum-details",
  museumName: "Flipper- & Arcade Museum Eschbach",
  machinesListed: false,
};
const save = (museumName: string, machinesListed: boolean) =>
  changeMuseumDetails(stored, { version: 0, museumName, machinesListed });

describe("changing the museum details", () => {
  it.each([
    ["a new name", "Flippermuseum Eschbach", false, ["museum-name"], "Flippermuseum Eschbach"],
    ["the listing switched on", stored.museumName, true, ["machines-listed"], stored.museumName],
    ["both", "Flippermuseum Eschbach", true, ["museum-name", "machines-listed"], "Flippermuseum Eschbach"],
    ["a new name with spaces around it, saved trimmed", "  Flippermuseum  ", false, ["museum-name"], "Flippermuseum"],
  ] as const)("names what changed: %s", (_case, name, listed, changedDetails, savedName) => {
    const decision = save(name, listed);

    expect(decision).toMatchObject({
      ok: true,
      state: { museumName: savedName, machinesListed: listed },
      events: [{ type: "EVT-MuseumDetailsChanged", changedDetails }],
    });
  });

  it.each([
    ["the same values", stored.museumName],
    ["the same name with spaces around it", `  ${stored.museumName} `],
  ])("records nothing for %s – and keeps the stored state (HS-27)", (_case, name) => {
    expect(save(name, false)).toEqual({ ok: true, state: stored, events: [] });
  });

  it.each([[""], ["   "]])("rejects the empty name %j", (name) => {
    expect(save(name, true)).toEqual({ ok: false, error: "museum-name-required" });
  });
});
