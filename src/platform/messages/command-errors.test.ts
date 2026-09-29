import { describe, expect, expectTypeOf, it } from "vitest";
import { reportProblemCommand } from "@/modules/repair";
import type { CommandError } from "@/platform/command";
import { commandErrorText, visitorMessages, type CommandErrorCode } from ".";

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
