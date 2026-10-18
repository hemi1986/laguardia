"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { correctMachineModelCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../../../team-session";
import { correctMachineModelFields, correctMachineModelInput } from "./correct-machine-model-input";

/**
 * CMD-CorrectMachineModel from the correction form (ST-036) – through the Server Action runner (ST-073). After it the
 * technician is on the machine model's page, which names the model (G3). Every page showing its details is current.
 */
const correctMachineModel = formAction(correctMachineModelCommand, {
  fields: correctMachineModelFields,
  input: correctMachineModelInput,
  onSuccess: async ({ machineModelId }) => {
    const page = `/team/machine-models/${encodeURIComponent(machineModelId)}`;
    revalidatePath("/", "layout");
    redirect(`${page}?corrected=1`);
  },
});

export type CorrectMachineModelState = Parameters<typeof correctMachineModel>[0];

export async function correctMachineModelAction(
  previous: CorrectMachineModelState,
  formData: FormData,
): Promise<CorrectMachineModelState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  return correctMachineModel(previous, formData);
}
