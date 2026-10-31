"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeMuseumDetailsCommand } from "@/modules/collection";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTechnician } from "../../../team-session";
import { museumFormDefinition, type MuseumFormField } from "./museum-form-input";

const MUSEUM_SETTINGS = "/team/museum-settings";

export type MuseumFormState = FormState<CommandError<typeof changeMuseumDetailsCommand>, MuseumFormField>;

/**
 * CMD-ChangeMuseumDetails from the form „Museum“ (ST-100) – through the Server Action runner (ST-073). Afterwards the
 * technician is on the same page, with the confirmation and the saved values (G3) – also after a save without a change
 * (HS-27). The welcome page and the visitor pages show the name, so they are revalidated too.
 */
const saveMuseum = formAction(changeMuseumDetailsCommand, {
  ...museumFormDefinition,
  onSuccess: async () => {
    revalidatePath("/", "layout");
    redirect(`${MUSEUM_SETTINGS}?saved=museum`);
  },
});

export async function saveMuseumAction(previous: MuseumFormState, formData: FormData): Promise<MuseumFormState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  return saveMuseum(previous, formData);
}
