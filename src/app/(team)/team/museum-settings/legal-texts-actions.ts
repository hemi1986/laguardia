"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeLegalTextsCommand } from "@/modules/collection";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTechnician } from "../../../team-session";
import { legalTextsFormDefinition, type LegalTextsFormField } from "./legal-texts-form-input";
import { savedLanding } from "./museum-settings-data";

export type LegalTextsFormState = FormState<CommandError<typeof changeLegalTextsCommand>, LegalTextsFormField>;

/**
 * CMD-ChangeLegalTexts from the form „Rechtstexte“ (ST-103) – through the Server Action runner (ST-073). Afterwards the
 * technician is on the same page, with the confirmation and the saved texts (G3) – also after a save without a change
 * (HS-27). The visitor pages are rendered per request; the legal pages are revalidated all the same.
 */
const saveLegalTexts = formAction(changeLegalTextsCommand, {
  ...legalTextsFormDefinition,
  onSuccess: async () => {
    revalidatePath("/", "layout"); // every visitor page links the legal texts
    redirect(savedLanding("legal-texts"));
  },
});

export async function saveLegalTextsAction(
  previous: LegalTextsFormState,
  formData: FormData,
): Promise<LegalTextsFormState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  return saveLegalTexts(previous, formData);
}
