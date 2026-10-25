"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { correctMachineDetailsCommand } from "@/modules/collection";
import { formAction } from "@/app/_actions/form-action";
import { requireTechnician } from "../../../../../team-session";
import { correctDetailsFields, correctDetailsInput } from "./correct-details-input";

/**
 * CMD-CorrectMachineDetails from the correction page (ST-035) – through the Server Action runner (ST-073). The
 * technician lands on the machine record under its museum number now, which confirms the correction (G3).
 */
const correctDetails = formAction(correctMachineDetailsCommand, {
  fields: correctDetailsFields,
  input: correctDetailsInput,
  onSuccess: async ({ museumNumber, previousMuseumNumber }) => {
    const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
    revalidatePath("/team/machines");
    revalidatePath(`/team/machines/${encodeURIComponent(previousMuseumNumber)}`);
    revalidatePath(record);
    redirect(`${record}?corrected=1`);
  },
});

export type CorrectDetailsState = Parameters<typeof correctDetails>[0];

export async function correctDetailsAction(
  previous: CorrectDetailsState,
  formData: FormData,
): Promise<CorrectDetailsState> {
  await requireTechnician(); // the page's access check; the command allows technicians only (HS-18)
  return correctDetails(previous, formData);
}
