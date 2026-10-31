"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formAction } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../team-session";
import {
  logoFormDefinition,
  removeLogoCommand,
  removeLogoFormDefinition,
  uploadLogoCommand,
  type RemoveLogoState,
  type UploadLogoState,
} from "./logo-form-input";
import { savedLanding } from "./museum-settings-data";

const landed = async () => {
  revalidatePath("/"); // the welcome page shows the logo
  redirect(savedLanding("logo"));
};

/**
 * CMD-ReplaceLogo from the form „Logo“ (ST-102) – through the runner's `logo` step: the image accepted and stored, the
 * command run with it, the image deleted if the command is rejected (ADR 0009); the previous logo's content is deleted
 * after the commit. Afterwards the technician is on the same page with the confirmation (G3).
 */
const uploadLogo = formAction(uploadLogoCommand, { ...logoFormDefinition, onSuccess: landed });

/** CMD-RemoveLogo from the form „Logo“ (ST-102) – one tap, no question first (G10c). */
const removeLogo = formAction(removeLogoCommand, { ...removeLogoFormDefinition, onSuccess: landed });

export async function uploadLogoAction(previous: UploadLogoState, formData: FormData): Promise<UploadLogoState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  return uploadLogo(previous, formData);
}

export async function removeLogoAction(previous: RemoveLogoState, formData: FormData): Promise<RemoveLogoState> {
  await requireTechnician();
  return removeLogo(previous, formData);
}
