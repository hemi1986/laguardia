"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registerMachineCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../../team-session";
import { registerMachineFields, registerMachineInput } from "./register-machine-input";

const MACHINES = "/team/machines";

/**
 * CMD-RegisterMachine from the registration page (ST-007) – through the Server Action runner (ST-073). After
 * registering, the technician lands back on the machine overview, which names the new machine (G2a, G3).
 */
const registerMachine = formAction(registerMachineCommand, {
  fields: registerMachineFields,
  input: registerMachineInput,
  onSuccess: async ({ machineId }) => {
    revalidatePath(MACHINES);
    redirect(`${MACHINES}?registered=${machineId}`);
  },
});

export type RegisterMachineState = Parameters<typeof registerMachine>[0];

export async function registerMachineAction(
  previous: RegisterMachineState,
  formData: FormData,
): Promise<RegisterMachineState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  return registerMachine(previous, formData);
}
