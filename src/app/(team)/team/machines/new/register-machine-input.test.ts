import { describe, expect, it } from "vitest";
import { registerMachineInput } from "./register-machine-input";

/**
 * The input function of the registration form (ST-073, Q19): it reads and converts the fields, it never validates
 * and never fills in a default – a missing museum number stays "no museum number given" and the command assigns one.
 */
describe("the registration form's input", () => {
  it("passes the typed details on as they are", () => {
    expect(
      registerMachineInput({
        machineModelId: "4f0c1c8e-7b1a-4d6e-9a43-0c1f6f5b2a11",
        museumNumber: "LG-007",
        serialNumber: "MM-12345",
        location: "Hall 2, row 3",
        machineStatus: "out-of-order",
      }),
    ).toEqual({
      machineModelId: "4f0c1c8e-7b1a-4d6e-9a43-0c1f6f5b2a11",
      museumNumber: "LG-007",
      serialNumber: "MM-12345",
      location: "Hall 2, row 3",
      machineStatus: "out-of-order",
    });
  });

  it("makes an empty, missing or unknown value 'no value given' – the location stays an empty string", () => {
    expect(
      registerMachineInput({
        machineModelId: "",
        museumNumber: "",
        serialNumber: undefined,
        location: undefined,
        machineStatus: "broken",
      }),
    ).toEqual({
      machineModelId: undefined,
      museumNumber: undefined,
      serialNumber: undefined,
      location: "",
      machineStatus: undefined,
    });
  });
});
