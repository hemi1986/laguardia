import { describe, expect, expectTypeOf, it } from "vitest";
import { createMachineModelCommand } from "@/modules/collection";
import { reportProblemCommand } from "@/modules/repair";
import type { CommandError } from "@/platform/command";
import { commandErrorText, teamMessages, visitorMessages, type CommandErrorCode, type TeamCommandErrorCode } from ".";

/** Q9 of the architecture review 2026-09-27: a rejected command shows the catalogue text of its kebab-case code. */
describe("command errors in the visitor catalogue", () => {
  it("every error of CMD-ReportProblem and of the command layer has a German and an English text", () => {
    const codes = ["description-required", "not-authorized", "not-found", "version-conflict"] as const;

    for (const locale of ["de", "en"] as const) {
      for (const code of codes) {
        expect(commandErrorText(visitorMessages(locale), code), `${locale}: ${code}`).toMatch(/\S/);
      }
    }
    expect(commandErrorText(visitorMessages("de"), "description-required")).toBe("Bitte beschreibe das Problem.");
    expect(commandErrorText(visitorMessages("en"), "version-conflict")).not.toBe(
      commandErrorText(visitorMessages("de"), "version-conflict"),
    );
  });

  it("the type check refuses a command whose error code has no text", () => {
    expectTypeOf<CommandError<typeof reportProblemCommand>>().toExtend<CommandErrorCode>();
  });
});

/** The same for the team UI (ST-006, the first team form; ST-007 adds the codes of CMD-RegisterMachine). */
describe("command errors in the team catalogue", () => {
  it("every error of CMD-CreateMachineModel and of the command layer has a German text", () => {
    const codes = [
      "title-required",
      "manufacturer-required",
      "year-must-be-four-digits",
      "machine-category-required",
      "technology-does-not-fit-machine-category",
      "not-authorized",
      "not-found",
      "version-conflict",
    ] as const;

    for (const code of codes) expect(commandErrorText(teamMessages, code), code).toMatch(/\S/);
    expect(commandErrorText(teamMessages, "manufacturer-required")).not.toBe(
      commandErrorText(teamMessages, "title-required"),
    );
  });

  it("the type check refuses a team command whose error code has no text", () => {
    expectTypeOf<CommandError<typeof createMachineModelCommand>>().toExtend<TeamCommandErrorCode>();
  });
});
