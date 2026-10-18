import type { CorrectMachineModelInput } from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import { machineModelFields, machineModelInput } from "../../machine-model-input";

/** The form's own fields – the machine model's, and which one at which version (ST-073). */
export const correctMachineModelFields = [...machineModelFields, "machineModelId", "version"] as const;

type Fields = FormFields<(typeof correctMachineModelFields)[number]>;

/** Reads the correction form like the creation form (ST-036, Q19), with the machine model and the version seen. */
export function correctMachineModelInput(fields: Fields): CorrectMachineModelInput {
  return {
    ...machineModelInput(fields),
    machineModelId: fields.machineModelId ?? "",
    version: versionSeen(fields.version),
  };
}
