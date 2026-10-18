import { describe, expect, it } from "vitest";
import { machineModelInput } from "./machine-model-input";

/**
 * The input function of the machine model form (ST-073, Q19): it reads and converts the fields, it never validates
 * and never fills in a default – a missing or unknown value stays "no value given" and the decision decides.
 */
const typed = {
  title: "Medieval Madness",
  manufacturer: "Williams",
  year: "1997",
  machineCategory: "pinball",
  technology: "dmd",
};

describe("the machine model form's input", () => {
  it("passes the typed details on as they are", () => {
    expect(machineModelInput(typed)).toEqual({
      title: "Medieval Madness",
      manufacturer: "Williams",
      year: "1997",
      machineCategory: "pinball",
      technology: "dmd",
    });
  });

  it("makes an empty, missing or unknown value 'no value given' – free text stays an empty string", () => {
    const empty = { title: undefined, manufacturer: "", year: "", machineCategory: undefined, technology: "" };

    expect(machineModelInput(empty)).toEqual({
      title: "",
      manufacturer: "",
      year: "",
      machineCategory: undefined,
      technology: undefined,
    });
    expect(machineModelInput({ ...typed, machineCategory: "jukebox", technology: "steam" })).toMatchObject({
      machineCategory: undefined,
      technology: undefined,
    });
  });

  it("passes the year on as it was typed – whether it is a year at all is the decision's call", () => {
    for (const year of ["ca. 1997", "99999999999", " 1997 "]) {
      expect(machineModelInput({ ...typed, year }), year).toMatchObject({ year });
    }
  });

  it("does not trim or otherwise validate the free text – the decision does", () => {
    expect(machineModelInput({ ...typed, title: "  " })).toMatchObject({ title: "  " });
  });
});
