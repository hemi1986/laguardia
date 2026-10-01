"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMachineModelCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../team-session";
import { createMachineModelFields, createMachineModelInput } from "./create-machine-model-input";

const MACHINE_MODELS = "/team/machine-models";

/** CMD-CreateMachineModel from the machine model page (ST-006) – through the Server Action runner (ST-073). */
const createMachineModel = formAction(createMachineModelCommand, {
  fields: createMachineModelFields,
  input: createMachineModelInput,
  onSuccess: async () => {
    revalidatePath(MACHINE_MODELS);
    redirect(MACHINE_MODELS);
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
