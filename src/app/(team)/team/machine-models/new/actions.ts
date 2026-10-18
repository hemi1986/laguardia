"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMachineModelCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../../team-session";
import { machineModelFields, machineModelInput } from "../machine-model-input";

const MACHINE_MODELS = "/team/machine-models";

/**
 * CMD-CreateMachineModel from its own page (ST-006, ST-036) – through the Server Action runner (ST-073). After it the
 * technician is back on the list, which names the new machine model (G3).
 */
const createMachineModel = formAction(createMachineModelCommand, {
  fields: machineModelFields,
  input: machineModelInput,
  onSuccess: async ({ machineModelId }) => {
    revalidatePath(MACHINE_MODELS);
    redirect(`${MACHINE_MODELS}?created=${encodeURIComponent(machineModelId)}`);
  },
});

export type CreateMachineModelState = Parameters<typeof createMachineModel>[0];

export async function createMachineModelAction(
  previous: CreateMachineModelState,
  formData: FormData,
): Promise<CreateMachineModelState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  return createMachineModel(previous, formData);
}
